import { HttpError } from '../../../middleware/errors.js'
import {
  Account,
  Chapter,
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
import { terminalEvidenceReady } from '../review-evidence.js'
import { rightsFacts } from '../../authoring-publishing/submissions/submission-digests.js'
import { claimView } from './review-queue.js'

const FINDINGS_LIMIT = 50

async function submissionOwner(submissionId, session) {
  const submission = await PublicationSubmission.findById(submissionId)
    .select('authorAccountId')
    .session(session ?? null)
    .lean()
  if (!submission) throw new HttpError(404, 'not_found', 'Không tìm thấy gói đã gửi.')
  return { _id: submission.authorAccountId }
}

// The owner-scoped loader re-checks story ownership, revision, rights and every digest.
export async function loadModeratorPackage(submissionId, session) {
  return loadSubmittedPackage(await submissionOwner(submissionId, session), submissionId, session)
}

export async function moderatorSubmittedImage(config, submissionId, mediaId) {
  return submittedImage(config, await submissionOwner(submissionId), submissionId, mediaId)
}

async function storedEvidence(batch) {
  const [attempts, findings, findingsCount, review] = await Promise.all([
    ProcessingAttempt.find({ batchId: batch._id })
      .sort({ createdAt: 1 })
      .select('stage status failureCode startedAt finishedAt')
      .lean(),
    SimilarityFinding.find({ batchId: batch._id })
      .sort({ score: -1, rank: 1 })
      .limit(FINDINGS_LIMIT)
      .lean(),
    SimilarityFinding.countDocuments({ batchId: batch._id }),
    LlmReview.findOne({ batchId: batch._id, status: 'succeeded' }).lean(),
  ])
  const chapters = await Chapter.find({
    _id: { $in: findings.map(finding => finding.sourceChapterId) },
  })
    .select('title storyId')
    .lean()
  const stories = await Story.find({ _id: { $in: chapters.map(chapter => chapter.storyId) } })
    .select('title')
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

/** Read-only moderator view of the exact submitted package; never starts AI work. */
export async function moderatorSubmissionDetail(account, submissionId, now = new Date()) {
  const { submission, revision, rights, parent, manifest, document } =
    await loadModeratorPackage(submissionId)
  const [author, batch, history] = await Promise.all([
    Account.findById(submission.authorAccountId).select('displayName status').lean(),
    EvidenceBatch.findById(submission.currentEvidenceBatchId).lean(),
    ModerationHistory.find({ submissionId: submission._id })
      .sort({ occurredAt: 1, _id: 1 })
      .select('action outcome feedback occurredAt')
      .lean(),
  ])
  const authorActive = author?.status === 'active'
  const terminal = terminalEvidenceReady(batch)
  const claim = claimView(submission, account, now)
  const ownLiveClaim =
    submission.status === 'decision-pending' && Boolean(claim?.ownedByMe) && !claim.expired
  return {
    submission: {
      id: String(submission._id),
      version: submission.version,
      status: submission.status,
      submittedAt: submission.submittedAt,
      decisionSummary: submission.decisionSummary ?? '',
      type: submission.chapterId ? 'chapter' : 'story',
      claim,
    },
    story: {
      id: String(submission.storyId),
      title: parent?.content.title ?? revision.content.title,
    },
    author: { id: String(submission.authorAccountId), displayName: author?.displayName ?? '' },
    revision: {
      id: String(revision._id),
      number: revision.revisionNumber,
      formatVersion: revision.formatVersion,
    },
    packageDigest: revision.packageDigest,
    rights: rightsFacts(rights),
    media: manifest,
    ...(submission.chapterId
      ? { chapter: { id: String(submission.chapterId), document } }
      : { metadata: revision.content }),
    evidence: batch ? await storedEvidence(batch) : null,
    history: history.map(row => ({
      id: String(row._id),
      action: row.action,
      outcome: row.outcome ?? '',
      feedback: row.feedback ?? '',
      occurredAt: row.occurredAt,
    })),
    actions: {
      canClaim:
        terminal &&
        authorActive &&
        (submission.status === 'pending-review' ||
          (submission.status === 'decision-pending' && Boolean(claim?.expired))),
      canRelease: ownLiveClaim,
      canDecide: terminal && ownLiveClaim,
    },
  }
}
