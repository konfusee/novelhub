# NovelHub

Web novel platform: Readers discover and read stories, Authors publish chapters
(with early access paid in coins), Moderators review submissions with AI-assisted
similarity evidence, and Admins govern accounts, finance and payouts.

## Repository layout

| Path           | Contents                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/`     | Node.js + Express API, Mongoose models (`src/models/`), tests (`test/`)                                                                            |
| `frontend/`    | Static React app (Vite)                                                                                                                            |
| `docs/`        | Product contract: [requirements baseline](docs/requirements-baseline.md), [decision log](docs/decision-log.md); original sources in `docs/source/` |
| `plans/`       | Requirements-to-database plan and phase designs                                                                                                    |
| `infra/mongo/` | Shared MongoDB on the group VPS ([connection details](infra/mongo/README.md))                                                                      |

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
cp backend/.env.example backend/.env   # points at the shared VPS database
npm run dev:backend                    # API on http://localhost:4000
npm run dev:frontend                   # app on http://localhost:5173 (proxies /api)
```

Check the API: `curl http://localhost:4000/api/ready` should return
`{"status":"ready","database":"connected"}`.

## Common commands

| Command                                       | What it does                                                                                                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                    | Backend and frontend tests. Backend tests start a throwaway in-memory MongoDB replica set (first run downloads MongoDB ~80 MB); they never touch the shared database. |
| `npm run lint`                                | ESLint for both workspaces                                                                                                                                            |
| `npm run format` / `npm run format:check`     | Prettier                                                                                                                                                              |
| `npm run build`                               | Production build of the frontend                                                                                                                                      |
| `npm run db:sync-indexes --workspace backend` | Create collections and sync indexes on the database in `backend/.env`                                                                                                 |

## Conventions

- Business rules come from `docs/decision-log.md`. Do not implement behavior
  that isn't recorded there; raise it with the team instead.
- Models follow `backend/src/models/shared/schema.js`: mutable collections use
  optimistic concurrency (`version`); history, ledger and audit collections are
  append-only, so corrections are new records.
- Coins are the only internal money unit (1 coin = 1 VND); VND appears only on
  the top-up page and payout slips.
- Writes that span documents (unlocks, top-ups, payouts, moderation decisions)
  must run inside `withTransaction` from `backend/src/db/connection.js`.
