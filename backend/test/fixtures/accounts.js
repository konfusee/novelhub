import { Account } from '../../src/models/identity/account.model.js'
import { RoleAssignment } from '../../src/models/identity/role-assignment.model.js'
import { issueSession } from '../../src/auth/session.js'

// Disposable test database only. Does not load .env or write to a shared database.
export async function authenticatedAccount(role = 'reader', overrides = {}) {
  const account = await Account.create({
    displayName: `Test ${role}`,
    email: `${role}-${crypto.randomUUID()}@example.test`,
    status: 'active',
    emailVerifiedAt: new Date(),
    everAuthor: role === 'author',
    ...overrides,
  })
  if (role !== 'reader') {
    await RoleAssignment.create({ accountId: account._id, role, grantedBy: account._id })
  }
  const { token } = await issueSession(account, 1)
  return { account, cookie: `novelhub_session=${token}` }
}
