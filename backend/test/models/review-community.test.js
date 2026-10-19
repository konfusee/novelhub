import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { useTestDatabase } from '../db.js'
import { ProcessingAttempt } from '../../src/models/review/processing-attempt.model.js'
import { PublicationSubmission } from '../../src/models/review/publication-submission.model.js'
import { EmbeddingArtifact } from '../../src/models/review/embedding-artifact.model.js'
import { Comment } from '../../src/models/community/comment.model.js'
import { ReportResolution } from '../../src/models/community/report-resolution.model.js'
import { CommentLike } from '../../src/models/community/comment-like.model.js'
import { Rating } from '../../src/models/community/rating.model.js'
import { RightsDeclaration } from '../../src/models/content/rights-declaration.model.js'
useTestDatabase()
const id = '507f1f77bcf86cd799439011'
describe('review and community models', () => {
  it('enforces deterministic processing attempts', async () => {
    const data = {
      batchId: id,
      revisionId: id,
      stage: 'embedding',
      attemptKey: 'batch:embedding:1',
      status: 'claimed',
    }
    await ProcessingAttempt.create(data)
    await expect(ProcessingAttempt.create(data)).rejects.toMatchObject({ code: 11000 })
  })
  it('rejects invalid cancellation reason', async () => {
    await expect(
      new PublicationSubmission({
        storyId: id,
        revisionId: id,
        authorAccountId: id,
        cancellationReason: 'other',
      }).validate(),
    ).rejects.toThrow()
  })
  it('enforces one comment like and one rating', async () => {
    await CommentLike.create({ accountId: id, commentId: id })
    await expect(CommentLike.create({ accountId: id, commentId: id })).rejects.toMatchObject({
      code: 11000,
    })
    await Rating.create({ accountId: id, storyId: id, value: 5 })
    await expect(Rating.create({ accountId: id, storyId: id, value: 4 })).rejects.toMatchObject({
      code: 11000,
    })
  })
  it('rejects ratings outside one through five', async () => {
    await expect(new Rating({ accountId: id, storyId: id, value: 6 }).validate()).rejects.toThrow()
  })
  it('advances processing attempts only through allowed states', async () => {
    const attempt = await ProcessingAttempt.create({
      batchId: id,
      revisionId: id,
      stage: 'embedding',
      attemptKey: 'forward',
      status: 'claimed',
    })
    await ProcessingAttempt.updateOne(
      { _id: attempt._id, status: 'claimed' },
      { $set: { status: 'started' } },
    )
    await ProcessingAttempt.updateOne(
      { _id: attempt._id, status: 'started' },
      { $set: { status: 'succeeded' } },
    )
    await expect(
      ProcessingAttempt.updateOne(
        { _id: attempt._id, status: 'succeeded' },
        { $set: { status: 'claimed' } },
      ),
    ).rejects.toThrow(/must move forward/)
  })

  it('validates replies, resolutions, rights lifecycle, and vectors', async () => {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const [parent] = await Comment.create(
          [
            {
              authorAccountId: id,
              targetType: 'story',
              targetId: id,
              body: 'p',
            },
          ],
          { session },
        )
        const [reply] = await Comment.create(
          [
            {
              authorAccountId: id,
              targetType: 'story',
              targetId: id,
              body: 'r',
              parentCommentId: parent._id,
            },
          ],
          { session },
        )
        await expect(
          Comment.create(
            [
              {
                authorAccountId: id,
                targetType: 'story',
                targetId: id,
                body: 'nested',
                parentCommentId: reply._id,
              },
            ],
            { session },
          ),
        ).rejects.toThrow(/one level/)
      })
    } finally {
      await session.endSession()
    }
    await expect(
      new Comment({
        authorAccountId: id,
        targetType: 'story',
        targetId: id,
        body: 'missing',
        parentCommentId: '507f1f77bcf86cd799439012',
      }).validate(),
    ).rejects.toThrow(/does not exist/)
    const other = await Comment.create({
      authorAccountId: id,
      targetType: 'chapter',
      targetId: id,
      body: 'other',
    })
    await expect(
      new Comment({
        authorAccountId: id,
        targetType: 'story',
        targetId: id,
        body: 'cross',
        parentCommentId: other._id,
      }).validate(),
    ).rejects.toThrow(/same target/)
    // Re-parenting would allow depth 2; parent and target are fixed at creation.
    const topLevel = await Comment.create({
      authorAccountId: id,
      targetType: 'chapter',
      targetId: id,
      body: 'top',
    })
    await expect(
      Comment.updateOne({ _id: topLevel._id }, { $set: { parentCommentId: other._id } }),
    ).rejects.toThrow(/cannot be changed/)
    topLevel.parentCommentId = other._id
    await expect(topLevel.save()).rejects.toThrow(/cannot be changed/)
    const resolution = await ReportResolution.create({
      reportId: id,
      moderatorAccountId: id,
      outcome: 'dismissed',
      reason: 'x',
    })
    resolution.reason = 'changed'
    await expect(resolution.save()).rejects.toThrow(/append-only/)
    const rights = await RightsDeclaration.create({
      storyId: id,
      submissionId: id,
      revisionId: id,
      basis: 'original',
      asserted: false,
      declaredBy: id,
      immutableAt: new Date(),
    })
    rights.status = 'asserted'
    await rights.save()
    rights.status = 'superseded'
    await rights.save()
    rights.status = 'draft'
    await expect(rights.save()).rejects.toThrow(/cannot move/)
    rights.status = 'superseded'
    rights.basis = 'licensed'
    await expect(rights.save()).rejects.toThrow(/cannot be changed/)
    const artifact = new EmbeddingArtifact({
      revisionId: id,
      batchId: id,
      model: 'm',
      dimensions: 2,
      passageId: 'p',
      chunkingVersion: '1',
      vector: [1],
    })
    await expect(artifact.validate()).rejects.toThrow(/vector length/)
  })
})
