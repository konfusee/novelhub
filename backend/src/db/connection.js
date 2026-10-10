import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

/**
 * Connects Mongoose and verifies the deployment supports multi-document
 * transactions (replica set), which NovelHub's finance and moderation
 * invariants depend on. Fails fast rather than silently running without them.
 */
export async function connectDatabase(uri, { autoIndex = false } = {}) {
  await mongoose.connect(uri, { autoIndex, serverSelectionTimeoutMS: 10_000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName) {
    await mongoose.disconnect();
    throw new Error('MongoDB must run as a replica set: transactions are required.');
  }
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

/**
 * Runs `work(session)` inside a transaction, retrying transient errors as the
 * driver recommends. Every write inside `work` must pass `{ session }`.
 */
export async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await work(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } },
    );
    return result;
  } finally {
    await session.endSession();
  }
}

export function databaseState() {
  return ['disconnected', 'connected', 'connecting', 'disconnecting'][
    mongoose.connection.readyState
  ];
}
