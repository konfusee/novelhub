// Read-only: shows what `syncIndexes()` would change on the database in MONGODB_URI and never
// changes it. Exits with code 1 when any index would be dropped. Use it instead of
// `npm run db:sync-indexes` on the shared database: `npm run db:diff-indexes --workspace backend`.
import mongoose from 'mongoose'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import { diffModelIndexes } from '../src/db/index-diff.js'
import '../src/models/index.js'

loadDotenv()
const env = loadEnv()
// Mongoose would otherwise create every missing collection as soon as it connects.
mongoose.set('autoCreate', false)
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  const drops = await diffModelIndexes(
    mongoose
      .modelNames()
      .sort()
      .map(name => mongoose.model(name)),
  )
  if (drops.length) {
    console.log('INDEX DIFF BLOCKED: ' + drops.join('; '))
    process.exitCode = 1
  } else {
    console.log('INDEX DIFF OK: nothing would be dropped')
  }
} finally {
  await disconnectDatabase()
}
