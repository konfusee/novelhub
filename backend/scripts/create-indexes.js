// Non-destructive: creates missing collections and indexes for the named models only on the
// database in MONGODB_URI; never drops an index. Preview first with `npm run db:diff-indexes`.
//   npm run db:create-indexes --workspace backend -- --models ModerationHistory,EmbeddingArtifact,LlmReview
import { parseArgs } from 'node:util'
import mongoose from 'mongoose'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import '../src/models/index.js'

const { values } = parseArgs({ options: { models: { type: 'string' } } })
if (!values.models) throw new Error('--models is required (comma-separated model names)')
const names = values.models
  .split(',')
  .map(name => name.trim())
  .filter(Boolean)
if (!names.length) throw new Error('--models is required (comma-separated model names)')
const known = new Set(mongoose.modelNames())
for (const name of names) if (!known.has(name)) throw new Error('Unknown model: ' + name)

loadDotenv()
const env = loadEnv()
// Only the named models' collections are created below, not every registered model's.
mongoose.set('autoCreate', false)
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  for (const name of names) {
    const model = mongoose.model(name)
    await model.createCollection()
    await model.createIndexes()
    const indexes = await model.listIndexes()
    console.log(`${model.collection.collectionName}: ${indexes.length} indexes`)
  }
} finally {
  await disconnectDatabase()
}
