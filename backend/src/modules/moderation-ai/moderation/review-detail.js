import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  Category,
  Chapter,
  ContentRevision,
  EvidenceBatch,
  LlmReview,
  ModerationHistory,
  ProcessingAttempt,
  PublicationSubmission,
  SimilarityFinding,
  Story,
} from '../../../models/index.js'
import {
  loadSubmittedPackage,
  submittedImage,
} from '../../authoring-publishing/author/author-submitted-package.js'
import { evidenceState, terminalEvidenceReady } from '../review-evidence.js'
import { rightsFacts } from '../../authoring-publishing/submissions/submission-digests.js'
import { claimFields, claimNotHeld, holdsClaimToken } from './claim-lease.js'

const FINDINGS_LIMIT = 50

const submissionNotFound = () => new HttpError(404, 'not_found', 'Không tìm thấy hồ sơ.')

/**
 * The account holds the live claim of a submission under review with its token. A tokenless live
 * claim (recorded before tokens existed) must be resumed through the claim mutation first.
 */
const holdsLiveClaim = (submission, account, now) =>
  submission.status === 'decision-pending' && holdsClaimToken(submission, account, now)

// The owner-scoped loader re-checks story ownership, revision, rights and every digest.
function loadModeratorPackage(submission, session) {
  return loadSubmittedPackage({ _id: submission.authorAccountId }, submission._id, session)
}

/** An image of the submitted revision, only for the holder of its live claim (SDS 3.2 row 03). */
export async function moderatorSubmittedImage(account, config, submissionId, mediaId, now) {
  const submission = await PublicationSubmission.findById(submissionId)
    .select('authorAccountId status claimOwnerAccountId claimToken claimExpiresAt')
    .lean()
  if (!submission) throw submissionNotFound()
  if (!holdsLiveClaim(submission, account, now)) throw claimNotHeld()
  return submittedImage(config, { _id: submission.authorAccountId }, submissionId, mediaId)
}

async function storedEvidence(batch, session) {
  const [attempts, findings, findingsCount, review] = await Promise.all([
    ProcessingAttempt.find({ batchId: batch._id })
      .sort({ createdAt: 1 })
      .select('stage status failureCode startedAt finishedAt')
      .session(session)
      .lean(),
    SimilarityFinding.find({ batchId: batch._id })
      .sort({ score: -1, rank: 1 })
      .limit(FINDINGS_LIMIT)
      .session(session)
      .lean(),
    SimilarityFinding.countDocuments({ batchId: batch._id }).session(session),
    LlmReview.findOne({ batchId: batch._id, status: 'succeeded' }).session(session).lean(),
  ])
  const chapters = await Chapter.find({
    _id: { $in: findings.map(finding => finding.sourceChapterId) },
  })
    .select('title storyId')
    .session(session)
    .lean()
  const stories = await Story.find({ _id: { $in: chapters.map(chapter => chapter.storyId) } })
    .select('title')
    .session(session)
    .lean()
  const chapterById = new Map(chapters.map(chapter => [String(chapter._id), chapter]))
  const storyById = new Map(stories.map(story => [String(story._id), story]))
  const evidenceRefs = review?.evidenceRefs ?? []
  return {
    batch: {
      id: String(batch._id),
      version: batch.version,
      status: batch.status,
      stage: batch.stage ?? null,
      failedStage: batch.failedStage ?? null,
      updatedAt: batch.updatedAt,
    },
    findingsCount,
    maxScore: findings[0]?.score ?? null,
    findingsTruncated: findingsCount > findings.length,
    attempts: attempts.map(attempt => ({
      stage: attempt.stage,
      status: attempt.status,
      failureCode: attempt.failureCode ?? null,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
    })),
    findings: findings.map(finding => {
      const chapter = chapterById.get(String(finding.sourceChapterId))
      return {
        id: String(finding._id),
        rank: finding.rank,
        score: finding.score,
        queryPassageId: finding.queryPassageId,
        sourcePassageId: finding.sourcePassageId,
        sourceChapterId: String(finding.sourceChapterId),
        sourceChapterTitle: chapter?.title ?? '',
        sourceStoryTitle: storyById.get(String(chapter?.storyId))?.title ?? '',
        queryText: finding.matchedSnippets?.[0]?.queryText ?? '',
        sourceText: finding.matchedSnippets?.[0]?.sourceText ?? '',
      }
    }),
    llmReview: review
      ? {
          status: review.status,
          summary: review.summary ?? '',
          riskLevel: review.riskLevel ?? null,
          riskReasons: review.riskReasons ?? [],
          suggestions: review.suggestions ?? [],
          findingAssessments: evidenceRefs.filter(ref => ref.findingId),
          droppedIneligibleFindings:
            evidenceRefs.find(ref => ref.droppedIneligibleFindings)?.droppedIneligibleFindings ??
            [],
          reviewedChars: review.reviewedChars ?? null,
          totalChars: review.totalChars ?? null,
          criteriaVersion: review.criteriaVersion ?? null,
          completedAt: review.completedAt,
        }
      : null,
  }
}

/**
 * The submitted cover or banner, served by the claim-protected image route from the frozen
 * manifest. A legacy package frozen before story images were digested references the image
 * without a manifest entry, so it has no URL rather than the current mutable file.
 */
function submittedStoryImage(submission, revision, manifest, role) {
  const entry = manifest.find(item => item.role === role)
  if (entry)
    return {
      mediaId: entry.mediaId,
      url: `/moderator/submissions/${submission._id}/images/${entry.mediaId}`,
    }
  const legacy = revision.content[role === 'cover' ? 'coverMediaId' : 'coverBannerMediaId']
  return legacy ? { mediaId: String(legacy), url: null } : null
}

/** Exact submitted package, rights, stored evidence and history; holder of the live claim only. */
async function reviewPackage(submission, batch, session) {
  const { revision, rights, parent, manifest, document } = await loadModeratorPackage(
    submission,
    session,
  )
  const categoryId = submission.chapterId ? null : revision.content.categoryId
  const [history, category, evidence] = await Promise.all([
    ModerationHistory.find({ submissionId: submission._id })
      .sort({ occurredAt: 1, _id: 1 })
      .select('action outcome feedback occurredAt')
      .session(session)
      .lean(),
    categoryId ? Category.findById(categoryId).select('name status').session(session).lean() : null,
    batch ? storedEvidence(batch, session) : null,
  ])
  return {
    story: {
      id: String(submission.storyId),
      title: parent?.content.title ?? revision.content.title,
    },
    revision: {
      id: String(revision._id),
      version: revision.version,
      number: revision.revisionNumber,
      formatVersion: revision.formatVersion,
    },
    packageDigest: revision.packageDigest,
    rights: rightsFacts(rights),
    media: manifest,
    ...(submission.chapterId
      ? { chapter: { id: String(submission.chapterId), document } }
      : {
          metadata: {
            ...revision.content,
            tags: revision.content.tags ?? [],
            category: category
              ? { id: String(category._id), name: category.name, status: category.status }
              : null,
            cover: submittedStoryImage(submission, revision, manifest, 'cover'),
            banner: submittedStoryImage(submission, revision, manifest, 'banner'),
          },
        }),
    evidence,
    history: history.map(row => ({
      id: String(row._id),
      action: row.action,
      outcome: row.outcome ?? '',
      feedback: row.feedback ?? '',
      occurredAt: row.occurredAt,
    })),
  }
}

/**
 * Moderator view of a submission; never starts AI work (BR-REV-07). Always the UC-MOD-02 step 2
 * summary; the package, rights and evidence only while the account holds the live claim
 * (steps 5-6, AF1).
 */
export async function moderatorSubmissionDetail(account, submissionId, now, session = null) {
  const submission = await PublicationSubmission.findById(submissionId).session(session).lean()
  if (!submission) throw submissionNotFound()
  const [revision, story, author, batch] = await Promise.all([
    ContentRevision.findById(submission.revisionId).select('content.title').session(session).lean(),
    Story.findById(submission.storyId).select('title').session(session).lean(),
    Account.findById(submission.authorAccountId)
      .select('displayName status')
      .session(session)
      .lean(),
    EvidenceBatch.findById(submission.currentEvidenceBatchId).session(session).lean(),
  ])
  const claim = claimFields(submission, account, now)
  const authorActive = author?.status === 'active'
  const terminal = terminalEvidenceReady(batch)
  const holder = holdsLiveClaim(submission, account, now)
  const summary = {
    submission: {
      id: String(submission._id),
      version: submission.version,
      status: submission.status,
      submittedAt: submission.submittedAt,
      decisionSummary: submission.decisionSummary ?? '',
      type: submission.chapterId ? 'chapter' : 'story',
      ...claim,
    },
    title: revision?.content?.title ?? '',
    story: { id: String(submission.storyId), title: story?.title ?? '' },
    author: {
      id: String(submission.authorAccountId),
      displayName: author?.displayName ?? '',
      active: authorActive,
    },
    evidenceStatus: evidenceState(batch),
    actions: {
      canClaim:
        terminal &&
        authorActive &&
        (submission.status === 'pending-review' ||
          (submission.status === 'decision-pending' && claim.claimState === 'expired')),
      canRelease: holder,
      canDecide: terminal && holder,
    },
  }
  return holder ? { ...summary, ...(await reviewPackage(submission, batch, session)) } : summary
}
