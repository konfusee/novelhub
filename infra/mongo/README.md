# Shared MongoDB (group VPS)

NovelHub's development database runs on the group VPS in Docker as a
single-node replica set (`rs0`). It is a replica set because the finance and
moderation code depends on multi-document transactions.

> Private class project: the database credentials are recorded here on purpose
> so every teammate can connect. The VPS login itself is **not** in this repo.

## Connection

|             | Value                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| Host        | `129.150.37.207:27017`                                                                        |
| Replica set | `rs0` (connect with `directConnection=true`)                                                  |
| Databases   | `novelhub` (app), `novelhub_test` (scratch)                                                   |
| App user    | `novelhub_app` / `BOgX68CYu9dOxT7pz9X5oUYbxGHj` (readWrite + dbAdmin on both databases)       |
| Admin user  | `novelhub_admin` / `7qOZl2774GvrqwKwOpVQTvMwI8Dh` (root; use only for user/replica-set admin) |

Application connection string (already in `backend/.env.example`):

```
mongodb://novelhub_app:BOgX68CYu9dOxT7pz9X5oUYbxGHj@129.150.37.207:27017/novelhub?authSource=admin&directConnection=true
```

`directConnection=true` is required: the replica-set member is registered as
`localhost:27017` inside the container, so drivers must not try to discover
other members.

Quick check:

```bash
mongosh "mongodb://novelhub_app:BOgX68CYu9dOxT7pz9X5oUYbxGHj@129.150.37.207:27017/novelhub?authSource=admin&directConnection=true" --eval 'db.hello().setName'
# prints: rs0
```

## Server layout

Files live in `/opt/novelhub/mongo` on the VPS:

| File                 | Purpose                                                                                      | In this repo |
| -------------------- | -------------------------------------------------------------------------------------------- | ------------ |
| `docker-compose.yml` | `mongo:8.0` container `novelhub_mongo`, port 27017, `restart: unless-stopped`, named volumes | yes          |
| `init-rs.sh`         | Idempotent: initiates `rs0` and creates/updates the app user                                 | yes          |
| `.env`               | `MONGO_ROOT_*` / `MONGO_APP_*` credentials (values above)                                    | no           |
| `mongo-keyfile`      | Replica-set internal auth key                                                                | no           |

Common operations (on the VPS):

```bash
cd /opt/novelhub/mongo
docker compose ps                # status
docker compose logs -f mongodb   # logs
docker compose restart mongodb   # restart
./init-rs.sh                     # re-run safely after a reset
```

Data persists in the `novelhub-mongo_mongodb_data` volume. The container starts
on boot through Docker's restart policy. The older class projects in
`/opt/cinema` and `/opt/sbay` have no containers and do not start on boot.
