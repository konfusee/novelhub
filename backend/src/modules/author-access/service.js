import { withTransaction } from '../../db/connection.js'
import { HttpError } from '../../middleware/errors.js'
import { Account } from '../../models/identity/account.model.js'
import { AuthorApplication } from '../../models/identity/author-application.model.js'
import { RoleAssignment } from '../../models/identity/role-assignment.model.js'
import { AuditEvent } from '../../models/audit/audit-event.model.js'
import { Notification } from '../../models/notifications/notification.model.js'

export const applicationView = application =>
  application
    ? {
        id: application._id.toString(),
        status: application.status,
        version: application.version,
        submittedAt: application.submittedAt,
        decidedAt: application.decidedAt ?? null,
        decisionReason: application.decisionReason ?? null,
      }
    : null

// All application/role writers serialize on the account, in the same transaction.
// Recheck the session epoch after authentication to reject stale privileged writes.
async function lockAccount(account, session) {
  const locked = await Account.findOneAndUpdate(
    {
      _id: account._id,
      status: 'active',
      authorizationEpoch: account.authorizationEpoch,
      credentialVersion: account.credentialVersion,
    },
    { $inc: { version: 1 } },
    { session, returnDocument: 'after' },
  )
  if (!locked) throw new HttpError(409, 'account_changed', 'Account permissions have changed')
  return locked
}

async function assertApplicant(account, session) {
  if (!account.emailVerifiedAt || !account.email) {
    throw new HttpError(409, 'applicant_ineligible', 'A verified active account is required')
  }
  const staff = await RoleAssignment.exists({ accountId: account._id, status: 'active' }).session(
    session,
  )
  if (staff) throw new HttpError(409, 'staff_role_conflict', 'Account already has a staff role')
}

export async function submitApplication(account) {
  return withTransaction(async session => {
    const applicant = await lockAccount(account, session)
    await assertApplicant(applicant, session)
    const existing = await AuthorApplication.findOne({
      applicantAccountId: applicant._id,
      status: 'submitted',
    }).session(session)
    if (existing) return { application: applicationView(existing), created: false }
    const [application] = await AuthorApplication.create(
      [{ applicantAccountId: applicant._id, status: 'submitted' }],
      { session },
    )
    return { application: applicationView(application), created: true }
  })
}

export async function listApplications({ status, page, pageSize }) {
  const filter = status === 'all' ? {} : { status }
  const [applications, total] = await Promise.all([
    AuthorApplication.find(filter)
      .sort({ submittedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate('applicantAccountId', 'displayName email status')
      .lean(),
    AuthorApplication.countDocuments(filter),
  ])
  return { items: applications.map(adminView), total, page, pageSize }
}

function adminView(application) {
  const applicant = application.applicantAccountId
  return {
    ...applicationView(application),
    applicant: applicant
      ? {
          id: applicant._id.toString(),
          name: applicant.displayName,
          email: applicant.email,
          status: applicant.status,
        }
      : null,
  }
}

export async function getApplication(id) {
  const application = await AuthorApplication.findById(id)
    .populate('applicantAccountId', 'displayName email status')
    .lean()
  if (!application) throw new HttpError(404, 'application_not_found', 'Application not found')
  return adminView(application)
}

export async function decideApplication(admin, id, { decision, reason, expectedVersion }) {
  return withTransaction(async session => {
    await lockAccount(admin, session)
    const allowed = await RoleAssignment.exists({
      accountId: admin._id,
      role: 'admin',
      status: 'active',
    }).session(session)
    if (!allowed) throw new HttpError(403, 'forbidden', 'Admin permission required')
    const application = await AuthorApplication.findById(id).session(session)
    if (!application) throw new HttpError(404, 'application_not_found', 'Application not found')
    if (application.status !== 'submitted' || application.version !== expectedVersion) {
      throw new HttpError(409, 'application_changed', 'Application has already changed; reload it')
    }
    const applicant = await Account.findById(application.applicantAccountId).session(session)
    if (!applicant || applicant.status !== 'active') {
      throw new HttpError(409, 'applicant_ineligible', 'Applicant is no longer active')
    }
    await lockAccount(applicant, session)
    if (decision === 'approve') {
      await assertApplicant(applicant, session)
      await RoleAssignment.create(
        [{ accountId: applicant._id, role: 'author', grantedBy: admin._id }],
        { session },
      )
      await Account.updateOne(
        { _id: applicant._id },
        { $set: { everAuthor: true }, $inc: { authorizationEpoch: 1 } },
        { session },
      )
    }
    const now = new Date()
    application.status = decision === 'approve' ? 'approved' : 'rejected'
    application.decidedAt = now
    application.decidedBy = admin._id
    application.decisionReason = reason
    await application.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: admin._id,
          action: 'author-application.decided',
          targetType: 'authorApplication',
          targetId: application._id,
          targetVersion: application.version,
          result: application.status,
          reason,
          occurredAt: now,
        },
      ],
      { session },
    )
    await Notification.create(
      [
        {
          recipientAccountId: applicant._id,
          eventType: 'author-application.decided',
          sourceEventKey: `author-application:${id}:decision`,
          payload: { applicationId: id, status: application.status, reason },
          deliveryState: 'available',
        },
      ],
      { session },
    )
    return applicationView(application)
  })
}
