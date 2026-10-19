// Creates every collection and makes its indexes match the model definitions.
// Run after changing a model: `npm run db:sync-indexes --workspace backend`.
import mongoose from 'mongoose'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import '../src/models/index.js'

loadDotenv()
const env = loadEnv()
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  for (const name of mongoose.modelNames().sort()) {
    const model = mongoose.model(name)
    await model.createCollection()
    const dropped = await model.syncIndexes()
    const indexes = await model.listIndexes()
    console.log(
      `${model.collection.collectionName}: ${indexes.length} indexes` +
        (dropped.length ? ` (dropped stale: ${dropped.join(', ')})` : ''),
    )
  }
} finally {
  await disconnectDatabase()
}
