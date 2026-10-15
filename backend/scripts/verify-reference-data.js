import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env.js';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import {
  Category,
  Story,
  Chapter,
  ContentRevision,
  PublicationSubmission,
  Notification,
  Wallet,
} from '../src/models/index.js';
import { queryPublishedStories } from '../src/modules/catalog-query.js';
loadDotenv();
const env = loadEnv();
await connectDatabase(env.MONGODB_URI, {
  autoIndex: false,
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
});
try {
  const counts = Object.fromEntries(
    await Promise.all(
      [Category, Story, Chapter, ContentRevision, PublicationSubmission, Notification, Wallet].map(
        async (Model) => [Model.collection.name, await Model.countDocuments()],
      ),
    ),
  );
  const catalog = await queryPublishedStories({ pageSize: 3 });
  console.log(
    JSON.stringify(
      {
        database: mongoose.connection.db.databaseName,
        counts,
        publishedStories: catalog.total,
        sample: catalog.items.map(({ id, title }) => ({ id, title })),
      },
      null,
      2,
    ),
  );
  if (!counts.categories || !counts.stories || !counts.chapters) process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
