# Shared MongoDB (group VPS)

NovelHub's development database runs on the group VPS in Docker as a
single-node replica set (`rs0`) on MongoDB 8.3. It is a replica set because the
finance and moderation code depends on multi-document transactions. A `mongot`
container next to it provides MongoDB Search and Vector Search (`$vectorSearch`)
for moderation similarity matching.

Credentials are distributed to authorized teammates out of band and belong only
in the ignored `backend/.env` file. Never commit database passwords.

## Connection

|             | Value                                                                        |
| ----------- | ---------------------------------------------------------------------------- |
| Host        | `129.150.37.207:27017`                                                       |
| Replica set | `rs0` (connect with `directConnection=true`)                                 |
| Databases   | `novelhub` (app), `novelhub_test` (scratch)                                  |
| App user    | Request the `readWrite` application credential from the project owner        |
| Admin user  | Restricted to infrastructure administration; never use it in the application |

Application connection string (already in `backend/.env.example`):

```
mongodb://USERNAME:PASSWORD@129.150.37.207:27017/novelhub?authSource=admin&directConnection=true
```

`directConnection=true` is required: the replica-set member is registered as
`mongodb:27017`, a name that only resolves inside the compose network (mongot
syncs through it), so drivers must not try to discover other members.

Quick check:

```bash
mongosh "$env:MONGODB_URI" --eval 'db.hello().setName'
# prints: rs0
```

## Server layout

Files live in `/opt/novelhub/mongo` on the VPS:

| File                 | Purpose                                                                                                 | In this repo |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| `docker-compose.yml` | `mongo:8.3.13` `novelhub_mongo` (port 27017) and `mongot` `novelhub_mongot` (internal only)             | yes          |
| `mongot.conf`        | mongot sync source `mongodb:27017`, gRPC `mongot:27028`, health `mongot:8080`                           | yes          |
| `init-rs.sh`         | Idempotent: initiates `rs0` and creates/updates the app user and the `mongotUser` (`searchCoordinator`) | yes          |
| `.env`               | `MONGO_ROOT_*` / `MONGO_APP_*` credentials (values above)                                               | no           |
| `mongo-keyfile`      | Replica-set internal auth key                                                                           | no           |
| `mongot-password`    | `mongotUser` password, no trailing newline, mode 400                                                    | no           |

Common operations (on the VPS):

```bash
cd /opt/novelhub/mongo
docker compose ps                # status (both containers report healthy)
docker compose logs -f mongodb   # mongod logs
docker compose logs -f mongot    # search/vector index logs
docker compose restart mongodb   # restart; mongot reconnects on its own
./init-rs.sh                     # re-run safely after a reset
```

The moderation vector index `embedding_vectors` on `embeddingArtifacts`
(1536-dimension cosine vectors with filter fields `revisionId`,
`authorAccountId`, `model` and `chunkingVersion`) is created or updated with
`npm run db:sync-search-indexes --workspace backend` using the app user (its
`readWrite` role is enough); the command waits until `listSearchIndexes`
reports the index `READY` and queryable. Regular indexes on this shared
database are previewed with `npm run db:diff-indexes --workspace backend` and
created with `npm run db:create-indexes --workspace backend -- --models <names>`,
never with `db:sync-indexes`, which drops indexes other branches may rely on.
See [Moderation evidence worker](../../docs/moderation-evidence.md). mongot
keeps its index files in the `novelhub-mongo_mongot_data` volume and rebuilds
them from mongod if the volume is lost.

## Version history

On 2026-10-29 the server was upgraded 8.0.32 → 8.2.12 (FCV 8.2) → 8.3.13 because
self-managed `mongot` needs MongoDB 8.3+. The feature compatibility version is
deliberately left at `8.2` so a downgrade to 8.2 stays possible; raise it with
`db.adminCommand({ setFeatureCompatibilityVersion: "8.3", confirm: true })`
only if an 8.3-only feature is needed. A pre-upgrade `mongodump` archive is in
`/opt/novelhub/backups`. Backend tests use the same 8.3.13 binary through
`mongodb-memory-server` (without mongot).

Data persists in the `novelhub-mongo_mongodb_data` volume. Both containers start
on boot through Docker's restart policy. The older class projects in
`/opt/cinema` and `/opt/sbay` have no containers and do not start on boot.
