import {
  Account,
  AuditEvent,
  Chapter,
  PublicationSubmission,
  Story,
} from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { lockAuthor } from '../author/author-ownership.js'
import { chapterReleaseState, publishScheduledChapter } from '../author/author-chapter-release.js'
import { digest } from '../submissions/submission-digests.js'

function scheduleChecks({ story, chapter, checks }) {
  return [
    ...checks.filter(check => !['parent', 'order', 'editable'].includes(check.code)),
    {
      code: 'editable',
      ok:
        !story.authoringFrozen &&
        story.publicationStatus !== 'archived' &&
        ['approved', 'scheduled', 'due'].includes(chapter.status) &&
        !chapter.publishedRevisionId,
    },
  ]
}

export async function prepareChapterSchedule(account, storyId, chapterId, config) {
  const state = await chapterReleaseState(account, storyId, chapterId, undefined, config)
  const { story, chapter, snapshot } = state
  const revisionId = chapter.draftRevisionId ?? chapter.currentRevisionId
  const source =
    snapshot?.submission ??
    (await PublicationSubmission.findOne({
      chapterId: chapter._id,
      storyId: story._id,
      revisionId,
      authorAccountId: account._id,
    }).lean())
  const checks = scheduleChecks(state)
  return {
    target: {
      storyId: String(story._id),
      chapterId: String(chapter._id),
      version: chapter.version,
      storyVersion: story.version,
      revisionId: revisionId ? String(revisionId) : null,
      submissionId: source ? String(source._id) : null,
      title: chapter.title,
    },
    status: chapter.status,
    requestedReleaseAt: chapter.requestedReleaseAt ?? null,
    checks,
    ready: checks.every(check => check.ok),
    canCancel: Boolean(
      source && !story.authoringFrozen && ['scheduled', 'due'].includes(chapter.status),
    ),
    waiting: state.checks
      .filter(check => ['parent', 'order'].includes(check.code) && !check.ok)
      .map(check => check.code),
  }
}

export async function changeChapterSchedule(account, storyId, chapterId, input, config) {
  return withTransaction(async session => {
    await lockAuthor(account, session)
    const { story, chapter, snapshot, checks } = await chapterReleaseState(
      account,
      storyId,
      chapterId,
      session,
      config,
    )
    if (chapter.version !== input.expectedVersion || story.version !== input.expectedStoryVersion)
      throw new HttpError(409, 'stale_content', 'Truyện hoặc chương đã thay đổi. Hãy tải lại.')
    const cancelling = input.requestedReleaseAt === null
    const sourceMatches = cancelling
      ? String(chapter.draftRevisionId ?? chapter.currentRevisionId) === input.revisionId &&
        (await PublicationSubmission.exists({
          _id: input.submissionId,
          revisionId: input.revisionId,
          chapterId: chapter._id,
          storyId: story._id,
          authorAccountId: account._id,
        }).session(session))
      : snapshot &&
        String(snapshot.revision._id) === input.revisionId &&
        String(snapshot.submission._id) === input.submissionId
    if (!sourceMatches)
      throw new HttpError(409, 'stale_content', 'Gói chương đã duyệt đã thay đổi.')
    const scheduled = ['scheduled', 'due'].includes(chapter.status)
    if (input.requestedReleaseAt === null) {
      if (!scheduled || story.authoringFrozen)
        throw new HttpError(409, 'schedule_not_ready', 'Không thể hủy lịch phát hành này.')
    } else {
      // A due chapter may wait for its parent and earlier chapters. All immutable
      // package, rights, evidence and media checks must already pass at scheduling.
      if (!scheduleChecks({ story, chapter, checks }).every(check => check.ok))
        throw new HttpError(409, 'schedule_not_ready', 'Chương chưa đủ điều kiện lên lịch.')
    }
    const now = new Date()
    const from = chapter.status
    chapter.requestedReleaseAt =
      input.requestedReleaseAt === null ? undefined : new Date(input.requestedReleaseAt)
    chapter.status =
      input.requestedReleaseAt === null
        ? 'approved'
        : chapter.requestedReleaseAt <= now
          ? 'due'
          : 'scheduled'
    chapter.publicationTransition = {
      actorAccountId: account._id,
      occurredAt: now,
      from,
      to: chapter.status,
      result:
        input.requestedReleaseAt === null
          ? 'author-schedule-cancelled'
          : 'author-chapter-scheduled',
    }
    await chapter.save({ session })
    // Serialize with freeze/unpublication and other chapter operations.
    const pinned = await Story.updateOne(
      { _id: story._id, version: story.version },
      { $inc: { version: 1 } },
      { session },
    )
    if (pinned.modifiedCount !== 1)
      throw new HttpError(409, 'stale_content', 'Truyện cha đã thay đổi. Hãy tải lại.')
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: account._id,
          action:
            input.requestedReleaseAt === null ? 'chapter.schedule-cancelled' : 'chapter.scheduled',
          targetType: 'Chapter',
          targetId: chapter._id,
          targetVersion: chapter.version,
          result: 'accepted',
          occurredAt: now,
          dataDigest: digest({
            revisionId: input.revisionId,
            submissionId: input.submissionId,
            requestedReleaseAt: chapter.requestedReleaseAt ?? null,
          }),
        },
      ],
      { session },
    )
    return {
      id: String(chapter._id),
      status: chapter.status,
      version: chapter.version,
      requestedReleaseAt: chapter.requestedReleaseAt ?? null,
    }
  })
}

async function deferChapter(candidate, error, now) {
  return withTransaction(async session => {
    const chapter = await Chapter.findOne({
      _id: candidate._id,
      version: candidate.version,
      status: { $in: ['scheduled', 'due'] },
      requestedReleaseAt: { $lte: now },
    }).session(session)
    const blocked = error.details?.checks?.filter(check => !check.ok).map(check => check.code)
    const failure = `${error.code ?? 'release_blocked'}${blocked?.length ? `:${blocked.join(',')}` : ''}`
    if (
      !chapter ||
      (chapter.status === 'due' && chapter.publicationTransition?.failure === failure)
    )
      return
    const from = chapter.status
    chapter.status = 'due'
    chapter.publicationTransition = {
      occurredAt: now,
      from,
      to: 'due',
      result: 'release-deferred',
      failure,
    }
    await chapter.save({ session })
    await AuditEvent.create(
      [
        {
          actorType: 'system',
          action: 'chapter.release-deferred',
          targetType: 'Chapter',
          targetId: chapter._id,
          targetVersion: chapter.version,
          result: 'deferred',
          reason: failure,
          occurredAt: now,
          dataDigest: digest({
            revisionId: String(chapter.draftRevisionId ?? chapter.currentRevisionId),
            requestedReleaseAt: chapter.requestedReleaseAt,
          }),
        },
      ],
      { session },
    )
  })
}

// MongoDB is the durable queue. Multiple API processes may sweep concurrently;
// the existing transactional release and version pins admit only one publication.
export async function releaseDueChapters(config, { now = new Date() } = {}) {
  const results = { published: 0, deferred: 0 }
  const cursor = Chapter.find({
    status: { $in: ['scheduled', 'due'] },
    requestedReleaseAt: { $lte: now },
  })
    .sort({ storyId: 1, orderKey: 1 })
    .lean()
    .cursor()
  try {
    for await (const candidate of cursor) {
      try {
        const story = await Story.findById(candidate.storyId).lean()
        const account = story ? await Account.findById(story.authorAccountId).lean() : null
        if (!account) throw new HttpError(409, 'author_unavailable', 'Không tìm thấy tác giả.')
        const state = await chapterReleaseState(
          account,
          candidate.storyId,
          candidate._id,
          undefined,
          config,
          true,
        )
        await publishScheduledChapter(
          account,
          candidate.storyId,
          candidate._id,
          {
            revisionId: String(state.snapshot?.revision._id),
            submissionId: String(state.snapshot?.submission._id),
            expectedVersion: candidate.version,
            expectedStoryVersion: state.story.version,
          },
          config,
          now,
        )
        results.published++
      } catch (error) {
        if (!(error instanceof HttpError))
          config.logger?.error(
            { err: error, chapterId: String(candidate._id) },
            'Chapter release failed',
          )
        await deferChapter(
          candidate,
          error instanceof HttpError
            ? error
            : new HttpError(500, 'release_error', 'Không thể phát hành chương.'),
          now,
        )
        results.deferred++
      }
    }
  } finally {
    await cursor.close()
  }
  return results
}

export function startChapterScheduler(config, logger, { intervalMs = 30000 } = {}) {
  let stopped = false
  let running
  const tick = () => {
    if (stopped || running) return
    running = releaseDueChapters(config)
      .catch(error => {
        logger.error({ err: error }, 'Chapter release scheduler failed')
      })
      .finally(() => {
        running = undefined
      })
  }
  const timer = setInterval(tick, intervalMs)
  timer.unref()
  tick()
  return async () => {
    stopped = true
    clearInterval(timer)
    await running
  }
}
