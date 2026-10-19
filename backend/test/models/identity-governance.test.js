import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../db.js'
import { Session } from '../../src/models/identity/session.model.js'
import { ExternalIdentity } from '../../src/models/identity/external-identity.model.js'
import { RoleAssignment } from '../../src/models/identity/role-assignment.model.js'
import { AuthorApplication } from '../../src/models/identity/author-application.model.js'
import { PolicyVersion } from '../../src/models/governance/policy-version.model.js'
import { Account } from '../../src/models/identity/account.model.js'
useTestDatabase()
const id = '507f1f77bcf86cd799439011'
describe('identity and governance models', () => {
  it('applies confirmed policy defaults', () => {
    const policy = new PolicyVersion({ actorAccountId: id })
    expect(policy.priceMinCoins).toBe(200)
    expect(policy.priceMaxCoins).toBe(5000)
    expect(policy.durationMinDays).toBe(1)
    expect(policy.durationMaxDays).toBe(14)
    expect(policy.withdrawalThresholdCoins).toBe(100000)
    expect(policy.authorSharePercent).toBe(70)
    expect(policy.platformSharePercent).toBe(30)
    expect(policy.orderExpiryHours).toBe(24)
    expect(policy.claimExpiryHours).toBe(24)
  })
  it('rejects invalid enums', async () => {
    await expect(
      new Session({
        accountId: id,
        credentialVersion: 0,
        authorizationEpoch: 0,
        status: 'bad',
        expiresAt: new Date(),
      }).validate(),
    ).rejects.toThrow()
  })
  it('enforces provider identity uniqueness', async () => {
    const data = { accountId: id, provider: 'google', providerSubject: 'subject' }
    await ExternalIdentity.create(data)
    await expect(ExternalIdentity.create(data)).rejects.toMatchObject({ code: 11000 })
  })
  it('enforces active staff slot uniqueness', async () => {
    const author = { accountId: id, role: 'author', staffSlot: 'staff', grantedBy: id }
    await RoleAssignment.create(author)
    await expect(
      RoleAssignment.create({
        accountId: id,
        role: 'moderator',
        staffSlot: 'staff',
        grantedBy: id,
      }),
    ).rejects.toMatchObject({ code: 11000 })
  })
  it('permanently bars former Authors from Moderator assignment', async () => {
    const account = await Account.create({
      displayName: 'Former Author',
      email: 'former@example.test',
      everAuthor: true,
    })
    await expect(
      RoleAssignment.create({
        accountId: account._id,
        role: 'moderator',
        grantedBy: account._id,
      }),
    ).rejects.toThrow(/ever held Author/)
  })
  it('allows rejected applicants to reapply', async () => {
    await AuthorApplication.create({ applicantAccountId: id, status: 'rejected' })
    await expect(AuthorApplication.create({ applicantAccountId: id })).resolves.toBeTruthy()
  })
})
