import { createHash, randomBytes } from 'node:crypto';
import { Account } from '../models/identity/account.model.js';
import { RoleAssignment } from '../models/identity/role-assignment.model.js';
import { Session } from '../models/identity/session.model.js';

export const digestToken = (token) => createHash('sha256').update(token).digest('base64url');

export function cookieOptions({ nodeEnv, sessionTtlDays }) {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlDays * 24 * 60 * 60 * 1000,
  };
}

export function readCookie(header, name) {
  for (const item of String(header ?? '').split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return null;
}

export async function issueSession(account, sessionTtlDays) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000);
  await Session.create({
    accountId: account._id,
    tokenHash: digestToken(token),
    credentialVersion: account.credentialVersion,
    authorizationEpoch: account.authorizationEpoch,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function resolveSession(token) {
  if (!token) return null;
  const session = await Session.findOne({
    tokenHash: digestToken(token),
    status: 'active',
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash');
  if (!session) return null;
  const account = await Account.findById(session.accountId);
  const invalid =
    !account ||
    account.status !== 'active' ||
    account.credentialVersion !== session.credentialVersion ||
    account.authorizationEpoch !== session.authorizationEpoch;
  if (invalid) {
    await Session.updateOne(
      { _id: session._id },
      { $set: { status: 'revoked', revokedAt: new Date() } },
    );
    return null;
  }
  return { session, account };
}

export async function publicUser(account) {
  const hasPassword = await Account.exists({
    _id: account._id,
    'password.hash': { $exists: true },
  });
  const assignments = await RoleAssignment.find({
    accountId: account._id,
    status: 'active',
  }).lean();
  return {
    id: account._id.toString(),
    name: account.displayName,
    email: account.email,
    hasPassword: Boolean(hasPassword),
    twoFactorEnabled: Boolean(account.twoFactorEnabled),
    roles: ['reader', ...assignments.map(({ role }) => role)],
  };
}
