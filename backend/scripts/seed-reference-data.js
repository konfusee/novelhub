import { loadEnv } from '../src/config/env.js';
import { randomBytes } from 'node:crypto';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { seedReferenceData } from '../seed/seed-reference-data.js';
loadDotenv();
const env = loadEnv();
if (env.NODE_ENV === 'production')
  throw new Error('Reference data import is restricted to development/test');
await connectDatabase(env.MONGODB_URI, {
  autoIndex: false,
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
});
try {
  // A missing optional development password must not prevent importing content.
  // Generated credentials are not logged, persisted in files or reused for real users.
  const counts = await seedReferenceData({
    password: env.DEV_SEED_PASSWORD ?? randomBytes(32).toString('base64url'),
  });
  console.log(
    JSON.stringify(
      {
        inserted: counts,
        accounts: [
          'reader@seed.novelhub.local',
          'author@seed.novelhub.local',
          'moderator@seed.novelhub.local',
          'admin@seed.novelhub.local',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await disconnectDatabase();
}
