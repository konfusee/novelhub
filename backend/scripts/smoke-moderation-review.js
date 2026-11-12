// Moderation pipeline checks against the database in MONGODB_URI (docs/moderation-evidence.md).
// Read-only readiness and budget check (writes nothing to the database):
//   npm run smoke:moderation-review --workspace backend -- --preflight --confirm-single-runner
// Live end-to-end smoke against the designated runner; writes to the database and spends OpenAI
// budget, so run it only after a passing preflight:
//   npm run smoke:moderation-review --workspace backend -- --api http://localhost:4000/api
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { parseArgs } from 'node:util'
import mongoose from 'mongoose'
import { issueSession } from '../src/auth/session.js'
import { loadEnv, toAppConfig } from '../src/config/env.js'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { connectDatabase, disconnectDatabase, withTransaction } from '../src/db/connection.js'
import {
  Account,
  AuditEvent,
  Category,
  Notification,
  ProcessingAttempt,
  PublicationSubmission,
  RoleAssignment,
  Session,
} from '../src/models/index.js'
import {
  MAX_BACKLOG_SUBMISSIONS,
  moderationPreflight,
  preflightBlockers,
} from '../src/modules/moderation-ai/ai/rollout-preflight.js'

// Marks every account and role change the smoke makes in auditEvents.
const MARKER = 'novelhub-smoke-v1'
const POLL_MS = 5000
// Original sample prose written for the smoke; the submitter's chapter copies it verbatim.
const PASSAGE = [
  'Sáng sớm, sương còn đọng trên mái ngói khi Minh đẩy cánh cửa gỗ của tiệm sách cũ. Mùi giấy ẩm và mực in quen thuộc ùa ra, kéo anh về những mùa hè tuổi thơ ngồi đọc truyện dưới quạt trần.',
  'Bà chủ tiệm đặt lên quầy một cuốn sổ bìa da đã sờn góc. Bà nói đó là nhật ký của người thợ đóng sách từng làm việc ở đây, và chưa ai đọc hết những trang cuối cùng.',
  'Minh lật trang đầu tiên. Nét chữ nghiêng, đều đặn, kể về một thành phố ven sông nơi mỗi ngôi nhà giữ một câu chuyện riêng, chỉ chờ người biết lắng nghe.',
]
const REJECT_FEEDBACK = 'Smoke test: vui lòng viết lại đoạn mở đầu (mức độ: thấp).'

const { values } = parseArgs({
  options: {
    preflight: { type: 'boolean', default: false },
    'confirm-single-runner': { type: 'boolean', default: false },
    api: { type: 'string', default: 'http://localhost:4000/api' },
    'timeout-seconds': { type: 'string', default: '300' },
  },
})
const timeoutSeconds = Number(values['timeout-seconds'])
if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1)
  throw new Error('Invalid --timeout-seconds')
const api = new URL(values.api).href.replace(/\/+$/, '')

class SmokeFailure extends Error {
  constructor(step, detail) {
    super(detail)
    this.step = step
  }
}
const fail = (step, detail) => {
  throw new SmokeFailure(step, detail)
}

loadDotenv()
const env = loadEnv()
if (env.NODE_ENV === 'production') throw new Error('Smoke checks are disabled in production')
const config = toAppConfig(env)
const origin = env.CORS_ORIGIN.split(',')[0].trim()

async function preflight() {
  const result = await moderationPreflight(config)
  console.log(JSON.stringify(result.facts))
  const reasons = preflightBlockers(result, {
    confirmSingleRunner: values['confirm-single-runner'],
  })
  if (reasons.length) {
    console.log('PREFLIGHT BLOCKED: ' + reasons.join('; '))
    process.exitCode = 1
  } else {
    console.log('PREFLIGHT OK')
  }
}

async function request(cookie, method, url, body) {
  const response = await fetch(api + url, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      Origin: origin,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let parsed
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    // A non-JSON body (proxy error page) is reported by its status code alone.
    parsed = null
  }
  return { status: response.status, body: parsed }
}

function expectStatus(step, result, status, what) {
  if (result.status !== status) {
    const code = result.body?.error?.code
    fail(step, `${what} returned HTTP ${result.status}${code ? ' ' + code : ''}`)
  }
  return result.body
}

async function drainBacklog(smokeStart) {
  const inactiveAuthorIds = await Account.distinct('_id', { status: { $ne: 'active' } })
  const filter = {
    status: 'validated',
    submittedAt: { $lt: smokeStart },
    authorAccountId: { $nin: inactiveAuthorIds },
  }
  const backlog = await PublicationSubmission.countDocuments(filter)
  if (backlog > MAX_BACKLOG_SUBMISSIONS) fail('drain', `backlog above ${MAX_BACKLOG_SUBMISSIONS}`)
  const deadline = Date.now() + (120 + 90 * backlog) * 1000
  while ((await PublicationSubmission.countDocuments(filter)) > 0) {
    if (Date.now() >= deadline) fail('drain', 'backlog did not drain')
    await sleep(POLL_MS)
  }
  console.log(`backlog drained: ${backlog} submissions`)
}

const auditMarker = (action, targetId, result) => ({
  actorType: 'system',
  action,
  targetType: 'Account',
  targetId,
  result,
  reason: MARKER,
  occurredAt: new Date(),
})

// Reuses a marked, passwordless, verified smoke account that holds no other role, or creates one.
async function ensureSmokeAccount(role, label, ensured) {
  const markers = await AuditEvent.find({
    action: 'smoke.account-created',
    targetType: 'Account',
    reason: MARKER,
    result: label,
  })
    .sort({ occurredAt: -1 })
    .select('targetId')
    .lean()
  let accountId = null
  for (const { targetId } of markers) {
    const candidate = await Account.findById(targetId).select('+password').lean()
    if (!candidate || candidate.status !== 'active' || !candidate.emailVerifiedAt) continue
    if (candidate.password || (role === 'moderator' && candidate.everAuthor)) continue
    const otherRole = await RoleAssignment.exists({
      accountId: targetId,
      status: 'active',
      role: { $ne: role },
    })
    if (otherRole) continue
    accountId = candidate._id
    break
  }
  if (!accountId) {
    const email = `novelhub-smoke-${label}-${randomBytes(4).toString('hex')}@smoke.novelhub.invalid`
    accountId = await withTransaction(async session => {
      const [created] = await Account.create(
        [
          {
            displayName: 'NovelHub Smoke ' + label,
            email,
            status: 'active',
            emailVerifiedAt: new Date(),
            everAuthor: role === 'author',
          },
        ],
        { session },
      )
      await AuditEvent.create([auditMarker('smoke.account-created', created._id, label)], {
        session,
      })
      return created._id
    })
  }
  ensured.push({ accountId, role })
  if (!(await RoleAssignment.exists({ accountId, role, status: 'active' }))) {
    await withTransaction(async session => {
      await RoleAssignment.create([{ accountId, role, grantedBy: accountId }], { session })
      await AuditEvent.create([auditMarker('smoke.role-granted', accountId, role)], { session })
    })
  }
  return Account.findById(accountId).lean()
}

// Revokes only the self-granted role the smoke grants, bumps the epoch and drops every session.
async function cleanup(ensured) {
  const errors = []
  for (const { accountId, role } of ensured) {
    try {
      await withTransaction(async session => {
        await RoleAssignment.updateMany(
          { accountId, role, grantedBy: accountId, status: 'active' },
          { $set: { status: 'revoked', revokedAt: new Date() }, $inc: { version: 1 } },
          { session },
        )
        await Account.updateOne(
          { _id: accountId },
          { $inc: { authorizationEpoch: 1, version: 1 } },
          { session },
        )
        await Session.deleteMany({ accountId }, { session })
        await AuditEvent.create([auditMarker('smoke.role-revoked', accountId, 'revoked')], {
          session,
        })
      })
    } catch (error) {
      errors.push(`${accountId}: ${error.message}`)
    }
  }
  if (errors.length) throw new Error(errors.join('; '))
}

async function submitStory(step, cookie, categoryId, { title, description }) {
  const created = expectStatus(
    step,
    await request(cookie, 'POST', '/author/stories', {
      title,
      description,
      categoryId,
    }),
    201,
    'create story',
  )
  const storyId = created.story.id
  const prepared = expectStatus(
    step,
    await request(cookie, 'GET', `/author/submissions/prepare?storyId=${storyId}`),
    200,
    'prepare story submission',
  )
  const sent = expectStatus(
    step,
    await request(cookie, 'POST', '/author/submissions', {
      storyId,
      revisionId: prepared.target.revisionId,
      expectedVersion: prepared.target.version,
      rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
    }),
    201,
    'submit story',
  )
  return { storyId, submissionId: sent.submission.id }
}

async function submitChapter(step, cookie, storyId, { title, paragraphs }) {
  const created = expectStatus(
    step,
    await request(cookie, 'POST', `/author/stories/${storyId}/chapters`, { title, paragraphs }),
    201,
    'create chapter',
  )
  const chapterId = created.chapter.id
  const prepared = expectStatus(
    step,
    await request(
      cookie,
      'GET',
      `/author/submissions/prepare?storyId=${storyId}&chapterId=${chapterId}`,
    ),
    200,
    'prepare chapter submission',
  )
  const sent = expectStatus(
    step,
    await request(cookie, 'POST', '/author/submissions', {
      storyId,
      chapterId,
      revisionId: prepared.target.revisionId,
      expectedVersion: prepared.target.version,
    }),
    201,
    'submit chapter',
  )
  return { chapterId, submissionId: sent.submission.id }
}

// Polls the moderator summary until the worker has finished the evidence, then claims the
// submission; only the claim holder receives the package and evidence (SDS decision 4).
async function waitForReview(step, moderatorCookie, submissionId) {
  const deadline = Date.now() + timeoutSeconds * 1000
  for (;;) {
    const summary = expectStatus(
      step,
      await request(moderatorCookie, 'GET', `/moderator/submissions/${submissionId}`),
      200,
      'moderator detail',
    )
    if (summary.submission.status !== 'validated' && summary.evidenceStatus !== 'processing') {
      const detail = expectStatus(
        step,
        await request(moderatorCookie, 'POST', `/moderator/submissions/${submissionId}/claim`, {
          expectedVersion: summary.submission.version,
        }),
        200,
        'claim',
      )
      const batch = detail.evidence?.batch
      if (
        batch?.status !== 'available-for-human-review' ||
        detail.evidence.llmReview?.status !== 'succeeded'
      )
        fail(
          step,
          `evidence not ready: status=${batch?.status ?? 'none'} failedStage=${batch?.failedStage ?? 'none'}`,
        )
      if (!detail.actions.canDecide) fail(step, 'the claimed submission cannot be decided')
      return detail
    }
    if (Date.now() >= deadline) fail(step, 'evidence timeout')
    await sleep(POLL_MS)
  }
}

// Records the decision for the exact revision and evidence the claim holder reviewed.
async function decide(step, moderatorCookie, detail, outcome, feedback) {
  expectStatus(
    step,
    await request(
      moderatorCookie,
      'POST',
      `/moderator/submissions/${detail.submission.id}/decision`,
      {
        outcome,
        feedback,
        expectedVersion: detail.submission.version,
        revisionId: detail.revision.id,
        revisionVersion: detail.revision.version,
        evidenceBatchId: detail.evidence.batch.id,
        evidenceVersion: detail.evidence.batch.version,
        claimToken: detail.submission.claimToken,
      },
    ),
    200,
    outcome,
  )
}

let step = 'ready'

async function runSmoke(ensured) {
  const ready = await request('', 'GET', '/ready').catch(() => null)
  if (ready?.status !== 200) fail(step, 'backend not ready')

  step = 'drain'
  const smokeStart = new Date()
  await drainBacklog(smokeStart)

  step = 'accounts'
  const sourceAuthor = await ensureSmokeAccount('author', 'source-author', ensured)
  const submitter = await ensureSmokeAccount('author', 'author', ensured)
  const moderatorAccount = await ensureSmokeAccount('moderator', 'moderator', ensured)
  const category = await Category.findOne({ status: 'active' }).sort({ sortKey: 1 }).lean()
  if (!category) fail(step, 'no active category')
  const categoryId = String(category._id)
  const cookieOf = async account =>
    env.AUTH_COOKIE_NAME + '=' + (await issueSession(account, 1)).token
  const source = await cookieOf(sourceAuthor)
  const author = await cookieOf(submitter)
  const moderator = await cookieOf(moderatorAccount)
  console.log('accounts ready')

  const smokeBatchIds = []
  const reviewed = async submissionId => {
    const detail = await waitForReview(step, moderator, submissionId)
    smokeBatchIds.push(detail.evidence.batch.id)
    return detail
  }

  step = 'source story'
  const sourceStory = await submitStory(step, source, categoryId, {
    title: 'Smoke nguồn ' + smokeStart.toISOString(),
    description:
      'Truyện nguồn dùng để kiểm tra đối chiếu tương đồng của NovelHub. Nội dung do nhóm phát triển tự viết.',
  })
  await decide(step, moderator, await reviewed(sourceStory.submissionId), 'approve', '')
  const storyRelease = expectStatus(
    step,
    await request(source, 'GET', `/author/stories/${sourceStory.storyId}/release`),
    200,
    'prepare story release',
  )
  expectStatus(
    step,
    await request(source, 'POST', `/author/stories/${sourceStory.storyId}/release`, {
      revisionId: storyRelease.target.revisionId,
      submissionId: storyRelease.target.submissionId,
      expectedVersion: storyRelease.target.version,
    }),
    201,
    'release story',
  )
  console.log('source story published')

  step = 'source chapter'
  const sourceChapter = await submitChapter(step, source, sourceStory.storyId, {
    title: 'Chương nguồn smoke',
    paragraphs: PASSAGE,
  })
  await decide(step, moderator, await reviewed(sourceChapter.submissionId), 'approve', '')
  const releasePath = `/author/stories/${sourceStory.storyId}/chapters/${sourceChapter.chapterId}/release`
  const chapterRelease = expectStatus(
    step,
    await request(source, 'GET', releasePath),
    200,
    'prepare chapter release',
  )
  if (chapterRelease.ready !== true) {
    const failed = chapterRelease.checks.filter(check => !check.ok).map(check => check.code)
    fail(step, 'chapter release not ready: ' + failed.join(', '))
  }
  expectStatus(
    step,
    await request(source, 'POST', releasePath, {
      revisionId: chapterRelease.target.revisionId,
      submissionId: chapterRelease.target.submissionId,
      expectedVersion: chapterRelease.target.version,
      expectedStoryVersion: chapterRelease.target.storyVersion,
    }),
    201,
    'release chapter',
  )
  console.log(`source chapter published: ${sourceChapter.chapterId}`)

  step = 'submitter story'
  const story = await submitStory(step, author, categoryId, {
    title: 'Smoke kiểm duyệt ' + smokeStart.toISOString(),
    description:
      'Truyện ngắn dùng để kiểm tra quy trình kiểm duyệt tự động của NovelHub. Nội dung do nhóm phát triển tự viết.',
  })
  await decide(step, moderator, await reviewed(story.submissionId), 'approve', '')
  console.log('story approved')

  step = 'submitter chapter'
  const chapter = await submitChapter(step, author, story.storyId, {
    title: 'Chương smoke',
    paragraphs: PASSAGE,
  })
  const chapterDetail = await reviewed(chapter.submissionId)
  const { evidence } = chapterDetail
  const compared = await ProcessingAttempt.exists({
    batchId: evidence.batch.id,
    stage: 'comparison',
    status: 'succeeded',
  })
  if (!(evidence.findingsCount >= 1) || !(evidence.maxScore >= 0.9) || !compared)
    fail(
      step,
      `similarity not found (findings=${evidence.findingsCount} maxScore=${evidence.maxScore ?? 'none'} comparison=${compared ? 'succeeded' : 'missing'})`,
    )
  console.log(
    `chapter evidence: status=${evidence.batch.status} stage=${evidence.batch.stage} findings=${evidence.findingsCount} maxScore=${evidence.maxScore.toFixed(2)} comparison=succeeded llm=${evidence.llmReview.status}`,
  )

  step = 'reject'
  await decide(step, moderator, chapterDetail, 'reject', REJECT_FEEDBACK)
  const submissions = expectStatus(
    step,
    await request(author, 'GET', '/author/submissions'),
    200,
    'author submissions',
  )
  const rejected = submissions.items.find(item => item.id === chapter.submissionId)
  if (rejected?.status !== 'rejected' || rejected.canRevise !== true)
    fail(
      step,
      `rejected chapter is not revisable: status=${rejected?.status ?? 'missing'} canRevise=${rejected?.canRevise ?? 'missing'}`,
    )
  console.log('chapter rejected; canRevise=true')

  step = 'notifications'
  // Reused accounts keep earlier runs' notifications: count only this run's two decisions.
  const inApp = await Notification.countDocuments({
    recipientAccountId: submitter._id,
    eventType: 'publication.decided',
    sourceEventKey: {
      $in: [story.submissionId, chapter.submissionId].map(
        id => `publication-submission:${id}:decided`,
      ),
    },
    createdAt: { $gte: smokeStart },
  })
  if (inApp !== 2) fail(step, `expected 2 decision notifications for this run, found ${inApp}`)
  const feed = expectStatus(
    step,
    await request(author, 'GET', '/reader/notifications'),
    200,
    'reader notifications',
  )
  if (!feed.items[0]?.title?.startsWith('Cần chỉnh sửa:'))
    fail(step, 'the latest notification is not the rejection')
  console.log(`notifications: in-app=${inApp}`)

  step = 'usage'
  const attempts = await ProcessingAttempt.find({ batchId: { $in: smokeBatchIds } }).lean()
  const runners = new Set(attempts.map(attempt => attempt.responseMetadata?.runner))
  if (runners.size !== 1 || runners.has(undefined))
    fail(step, 'more than one runner processed the smoke')
  const usage = { embedding: 0, llmInput: 0, llmOutput: 0, reasoning: 0, costUsd: 0 }
  for (const { stage, responseMetadata: metadata = {} } of attempts) {
    usage.costUsd += metadata.costUsd ?? 0
    if (stage === 'embedding') usage.embedding += metadata.usage?.prompt_tokens ?? 0
    if (stage === 'llm') {
      usage.llmInput += metadata.usage?.input_tokens ?? 0
      usage.llmOutput += metadata.usage?.output_tokens ?? 0
      usage.reasoning += metadata.usage?.output_tokens_details?.reasoning_tokens ?? 0
    }
  }
  console.log(
    `usage: embeddingTokens=${usage.embedding} llmInputTokens=${usage.llmInput} llmOutputTokens=${usage.llmOutput} reasoningTokens=${usage.reasoning} costUsd=${usage.costUsd.toFixed(4)} runner=${[...runners][0]}`,
  )
}

async function smoke() {
  const ensured = []
  let passed = false
  try {
    await runSmoke(ensured)
    passed = true
  } catch (error) {
    console.log(
      `SMOKE FAILED: ${error instanceof SmokeFailure ? error.step : step}: ${error.message}`,
    )
  }
  // Runs on pass and fail.
  try {
    await cleanup(ensured)
    console.log('smoke cleanup done')
  } catch (error) {
    passed = false
    console.log(`SMOKE FAILED: cleanup: ${error.message}`)
  }
  if (passed) console.log('SMOKE PASSED')
  else process.exitCode = 1
}

// The preflight is read-only: keep Mongoose from creating missing collections on connect.
if (values.preflight) mongoose.set('autoCreate', false)
await connectDatabase(env.MONGODB_URI, {
  serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
})
try {
  if (values.preflight) await preflight()
  else await smoke()
} finally {
  await disconnectDatabase()
}
