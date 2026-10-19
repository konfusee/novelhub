import { createHash, randomBytes } from 'node:crypto'
import { Account } from '../models/identity/account.model.js'
import { RoleAssignment } from '../models/identity/role-assignment.model.js'
import { Session } from '../models/identity/session.model.js'

export const digestToken = token => createHash('sha256').update(token).digest('base64url')

export function cookieOptions({ nodeEnv, sessionTtlDays }) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlDays * 24 * 60 * 60 * 1000,
  }
}

export function readCookie(header, name) {
  for (const item of String(header ?? '').split(';')) {
    const separator = item.indexOf('=')
    if (separator < 0) continue
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim())
    }
  }
  return null
}

// User-Agent labels are advisory, not verified device identity. Never store raw UA/IP.
export function sessionClient(userAgent = '') {
  const ua = String(userAgent).slice(0, 1024)
  const browser = /Edg(?:e|A|iOS)?\//.test(ua)
    ? 'Edge'
    : /(?:OPR|Opera)\//.test(ua)
      ? 'Opera'
      : /(?:Firefox|FxiOS)\//.test(ua)
        ? 'Firefox'
        : /(?:Chrome|CriOS)\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : ''
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Macintosh|Mac OS X/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : ''
  const deviceType =
    /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
      ? 'tablet'
      : /iPhone|Mobile/.test(ua)
        ? 'mobile'
        : os
          ? 'desktop'
          : 'unknown'
  return { browser, os, deviceType }
}

export async function issueSession(account, sessionTtlDays, { userAgent } = {}) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000)
  await Session.create({
    accountId: account._id,
    tokenHash: digestToken(token),
    credentialVersion: account.credentialVersion,
    authorizationEpoch: account.authorizationEpoch,
    expiresAt,
    client: sessionClient(userAgent),
  })
  return { token, expiresAt }
}

export async function resolveSession(token) {
  if (!token) return null
  const session = await Session.findOne({
    tokenHash: digestToken(token),
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash')
  if (!session) return null
  const account = await Account.findById(session.accountId)
  const invalid =
    !account ||
    account.status !== 'active' ||
    account.credentialVersion !== session.credentialVersion ||
    account.authorizationEpoch !== session.authorizationEpoch
  if (invalid) {
    await Session.updateOne(
      { _id: session._id },
      { $set: { status: 'revoked', revokedAt: new Date() } },
    )
    return null
  }
  // Coarse activity timestamp avoids a write on every resource/API request.
  const cutoff = new Date(Date.now() - 5 * 60 * 1000)
  if (!session.lastSeenAt || session.lastSeenAt < cutoff) {
    await Session.updateOne(
      {
        _id: session._id,
        status: 'active',
        $or: [{ lastSeenAt: { $lt: cutoff } }, { lastSeenAt: { $exists: false } }],
      },
      { $set: { lastSeenAt: new Date() } },
    )
  }
  return { session, account }
}

export async function publicUser(account) {
  const hasPassword = await Account.exists({
    _id: account._id,
    'password.hash': { $exists: true },
  })
  const assignments = await RoleAssignment.find({
    accountId: account._id,
    status: 'active',
  }).lean()
  return {
    id: account._id.toString(),
    name: account.displayName,
    email: account.email,
    hasPassword: Boolean(hasPassword),
    twoFactorEnabled: Boolean(account.twoFactorEnabled),
    roles: ['reader', ...assignments.map(({ role }) => role)],
  }
}
