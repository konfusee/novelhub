import { hashPassword } from '../src/auth/password.js'
import { loadEnv } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase, withTransaction } from '../src/db/connection.js'
import { Account, PolicyVersion, RoleAssignment } from '../src/models/index.js'
import { ensureReaderWallet } from '../src/modules/coins-payouts/account-lifecycle.js'

loadDotenv()
const env = loadEnv()
if (env.NODE_ENV === 'production') throw new Error('Field 1 seed is disabled in production')
const password = env.DEV_SEED_PASSWORD
if (!password || password.length < 10)
  throw new Error('Set DEV_SEED_PASSWORD (at least 10 characters)')
const hash = await hashPassword(password)
await connectDatabase(env.MONGODB_URI, {
  autoIndex: true,
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  await withTransaction(async session => {
    let admin
    for (const role of ['admin', 'reader', 'author', 'moderator']) {
      const email = `dev-${role}@novelhub.test`
      let account = await Account.findOne({ normalizedEmail: email }).session(session)
      if (!account) {
        ;[account] = await Account.create(
          [
            {
              email,
              displayName: `Dev ${role}`,
              status: 'active',
              emailVerifiedAt: new Date(),
              everAuthor: role === 'author',
              password: { hash, algorithm: 'scrypt', updatedAt: new Date() },
            },
          ],
          { session },
        )
      }
      if (role === 'admin') admin = account
      if (
        role !== 'reader' &&
        !(await RoleAssignment.exists({ accountId: account._id, status: 'active' }).session(
          session,
        ))
      ) {
        await RoleAssignment.create([{ accountId: account._id, role, grantedBy: admin._id }], {
          session,
        })
      }
      await ensureReaderWallet(account._id, session)
    }
    if (
      !(await PolicyVersion.exists({
        status: 'effective',
        effectiveAt: { $lte: new Date() },
      }).session(session))
    ) {
      await PolicyVersion.create(
        [{ status: 'effective', effectiveAt: new Date(), actorAccountId: admin._id }],
        { session },
      )
    }
  })
  console.log(
    'Field 1 seed ready: dev-{reader,author,moderator,admin}@novelhub.test. Use DEV_SEED_PASSWORD to sign in.',
  )
} finally {
  await disconnectDatabase()
}
