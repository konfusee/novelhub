// Embeds published chapters that have no similarity source yet. Calls OpenAI and writes to the
// database in MONGODB_URI. Always dry-run first and review the plan (npm runs workspace scripts
// from backend/, so the plan path is relative to it):
//   npm run db:backfill-embeddings --workspace backend -- --dry-run --max-revisions 500 --max-usd 0.50
//   npm run db:backfill-embeddings --workspace backend -- --plan .tmp/backfill-plan.json --max-usd 0.50
// Every run ends with `Backfill summary: {json}` (provider and persisted usage, stopped, failures).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { loadEnv, toAppConfig } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import '../src/models/index.js'
import {
  backfillEmbeddings,
  backfillSummaryLine,
} from '../src/modules/moderation-ai/ai/embedding-backfill.js'

const DEFAULT_PLAN = fileURLToPath(new URL('../.tmp/backfill-plan.json', import.meta.url))
const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    plan: { type: 'string' },
    'max-usd': { type: 'string', default: '0.50' },
    'max-revisions': { type: 'string', default: '500' },
  },
})
const dryRun = values['dry-run']
loadDotenv()
const env = loadEnv()
const config = toAppConfig(env)
if (!dryRun && !config.ai.openai) throw new Error('OPENAI_API_KEY is not set in backend/.env')
const plan = values.plan
  ? JSON.parse(readFileSync(path.resolve(process.cwd(), values.plan), 'utf8'))
  : undefined
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  const summary = await backfillEmbeddings(config, {
    dryRun,
    plan,
    planPath: dryRun ? DEFAULT_PLAN : undefined,
    maxUsd: Number(values['max-usd']),
    maxRevisions: Number(values['max-revisions']),
  })
  console.log(backfillSummaryLine(summary))
} finally {
  await disconnectDatabase()
}
