import { hashPassword } from '../src/auth/password.js';
import { loadEnv } from '../src/config/env.js';
import { loadDotenv } from '../src/config/load-dotenv.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { Account } from '../src/models/identity/account.model.js';

loadDotenv();
const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('Development account seeding is disabled in production');

const email = process.env.DEV_SEED_EMAIL?.trim().toLowerCase();
const password = process.env.DEV_SEED_PASSWORD;
const displayName = process.env.DEV_SEED_NAME?.trim() || 'NovelHub Developer';
if (!email || !password) {
  throw new Error('Set DEV_SEED_EMAIL and DEV_SEED_PASSWORD before running db:seed-dev-account');
}
if (password.length < 10) throw new Error('DEV_SEED_PASSWORD must contain at least 10 characters');

await connectDatabase(env.MONGODB_URI, { autoIndex: true });
try {
  const existing = await Account.findOne({ normalizedEmail: email });
  if (existing) {
    console.log(`Development account already exists: ${email}`);
  } else {
    await Account.create({
      displayName,
      email,
      status: 'active',
      emailVerifiedAt: new Date(),
      password: {
        hash: await hashPassword(password),
        algorithm: 'scrypt',
        updatedAt: new Date(),
      },
    });
    console.log(`Created development Reader account: ${email}`);
  }
} finally {
  await disconnectDatabase();
}
