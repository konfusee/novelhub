// Operator rollback for the AI evidence worker: fails every pending evidence batch to manual
// review so no submission is left in `validated`. Writes to the database in MONGODB_URI.
// Dry run first: `npm run ai:fail-pending --workspace backend -- --dry-run`.
import { parseArgs } from 'node:util'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import '../src/models/index.js'
import { failPendingEvidence } from '../src/modules/moderation-ai/ai/fail-pending-evidence.js'

const { values } = parseArgs({
  options: {
    reason: { type: 'string', default: 'operator-disabled' },
    'dry-run': { type: 'boolean', default: false },
  },
})
loadDotenv()
const env = loadEnv()
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  await failPendingEvidence({ reason: values.reason, dryRun: values['dry-run'] })
} finally {
  await disconnectDatabase()
}
