import { createHash, randomBytes } from 'node:crypto'
import { EmailToken } from '../models/identity/email-token.model.js'

export const digestEmailToken = token => createHash('sha256').update(token).digest('base64url')

export async function issueEmailToken({ accountId, purpose, ttlMinutes, session }) {
  const now = new Date()
  await EmailToken.updateMany(
    { accountId, purpose, usedAt: null, revokedAt: null },
    { $set: { revokedAt: now } },
    { session },
  )
  const token = randomBytes(32).toString('base64url')
  await EmailToken.create(
    [
      {
        accountId,
        purpose,
        tokenHash: digestEmailToken(token),
        expiresAt: new Date(now.getTime() + ttlMinutes * 60_000),
      },
    ],
    { session },
  )
  return token
}
