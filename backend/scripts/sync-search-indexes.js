// Creates or updates the MongoDB Vector Search index used by the evidence worker and waits until
// it is queryable. Run against a database with mongot (`infra/mongo/README.md`); the in-memory
// test database has no mongot. `npm run db:sync-indexes` never creates search indexes.
import { loadEnv, toAppConfig } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js'
import { EmbeddingArtifact } from '../src/models/index.js'
import {
  syncVectorSearchIndex,
  vectorIndexDefinition,
} from '../src/modules/ai/similarity-search.js'

loadDotenv()
const env = loadEnv()
const config = toAppConfig(env)
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  const status = await syncVectorSearchIndex(EmbeddingArtifact, {
    name: config.ai.vectorSearchIndex,
    definition: vectorIndexDefinition(),
  })
  console.log(config.ai.vectorSearchIndex + ': ' + status + ' (queryable)')
} finally {
  await disconnectDatabase()
}
