import { Router } from 'express'
import { z } from 'zod'
import {
  Account,
  Comment,
  ContentRevision,
  Chapter,
  Follow,
  Rating,
  StatisticsEvent,
  Story,
} from '../models/index.js'
import mongoose from 'mongoose'
import { HttpError } from '../middleware/errors.js'
import {
  categoryStoryCounts,
  queryPublishedStories,
} from '../modules/reading-community/catalog/catalog-query.js'
import { catalogPresentation } from '../modules/reading-community/catalog/catalog-presentation.js'
import { readRichChapter } from '../modules/authoring-publishing/content/rich-chapter-document.js'
import { submittedImage } from '../modules/authoring-publishing/author/author-submitted-package.js'
import { PublicationSubmission } from '../models/index.js'
import {
  optionalAccount,
  publishedCards,
  readableChapter,
} from '../modules/reading-community/reading/access.js'
import {
  chapterListItem,
  publishedChapterRows,
  withViewerUnlocks,
} from '../modules/reading-community/reading/chapters.js'
import { resumeFor } from '../modules/reading-community/reading/progress.js'
import { recordChapterView } from '../modules/reading-community/reading/views.js'
import { searchTagKey } from '../modules/authoring-publishing/content/story-tags.js'

const filters = z
  .object({
    q: z.string().trim().max(200).default(''),
    sort: z.enum(['newest', 'popular', 'rating']).default('newest'),
    category: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    tag: z.string().max(100).transform(searchTagKey).pipe(z.string()).optional(),
    status: z.enum(['ongoing', 'completed']).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict()

async function visibleChapter(config, req) {
  const account = await optionalAccount(req, config)
  const { story, chapter } = await readableChapter({
    storyId: req.params.storyId,
    chapterId: req.params.chapterId,
    account,
  })
  return { story, chapter, account }
}

async function storyViewer(account, storyId) {
  if (!account) return null
  const [follow, rating, resume, listenResume] = await Promise.all([
    Follow.exists({ accountId: account._id, storyId, status: 'active' }),
    Rating.findOne({ accountId: account._id, storyId, status: 'active' }).select('value').lean(),
    resumeFor(account, storyId, 'text'),
    resumeFor(account, storyId, 'audio'),
  ])
  return { following: Boolean(follow), rating: rating?.value ?? null, resume, listenResume }
}

export function createCatalogRouter(config) {
  const router = Router()

  router.param('storyId', async (req, _res, next, id) => {
    try {
      if (/^[a-f\d]{24}$/i.test(id)) return next()
      if (!/^[a-z0-9-]{1,150}$/.test(id))
        throw new HttpError(400, 'validation_error', 'ID truyện không hợp lệ.')
      const alias = await catalogPresentation().findOne({ _id: `alias:${id}` })
      if (!alias?.storyId) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.')
      req.params.storyId = String(alias.storyId)
      next()
    } catch (error) {
      next(error)
    }
  })
  router.param('chapterId', async (req, _res, next, id) => {
    try {
      if (/^[a-f\d]{24}$/i.test(id)) return next()
      if (!/^chapter-[1-9]\d{0,5}$/.test(id))
        throw new HttpError(400, 'validation_error', 'ID chương không hợp lệ.')
      const chapter = await Chapter.findOne({
        storyId: req.params.storyId,
        orderKey: Number(id.slice(8)),
      })
        .select('_id')
        .lean()
      if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.')
      req.params.chapterId = String(chapter._id)
      next()
    } catch (error) {
      next(error)
    }
  })

  router.get('/catalog/stories', async (req, res, next) => {
    try {
      const parsed = filters.safeParse(req.query)
      if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid catalogue filters')
      res.json(await queryPublishedStories(parsed.data))
    } catch (error) {
      next(error)
    }
  })
  router.get('/catalog/categories', async (_req, res, next) => {
    try {
      res.json({ items: await categoryStoryCounts() })
    } catch (error) {
      next(error)
    }
  })
  router.get('/catalog/stories/:storyId', async (req, res, next) => {
    try {
      const story = (await publishedCards({ ids: [req.params.storyId] }))[0]
      if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện đã xuất bản.')
      const account = await optionalAccount(req, config)
      const [chapters, ratings, author, works, latestComment, viewer] = await Promise.all([
        publishedChapterRows([story.id]).then(rows =>
          withViewerUnlocks(rows.get(story.id), account),
        ),
        Rating.aggregate([
          {
            $match: { storyId: new mongoose.Types.ObjectId(req.params.storyId), status: 'active' },
          },
          { $group: { _id: '$value', count: { $sum: 1 } } },
        ]),
        Account.findById(story.authorId).select('profile.bio').lean(),
        Story.find({ authorAccountId: story.authorId, publicationStatus: 'published' })
          .select('_id')
          .lean(),
        Comment.findOne({ targetType: 'story', targetId: req.params.storyId, status: 'visible' })
          .sort({ createdAt: -1 })
          .select('body authorAccountId')
          .populate('authorAccountId', 'displayName status')
          .lean(),
        storyViewer(account, story.id),
      ])
      const ratingCount = ratings.reduce((count, item) => count + item.count, 0)
      const ratingTotal = ratings.reduce((sum, item) => sum + item._id * item.count, 0)
      const [authorFollowers, authorReads] = await Promise.all([
        Follow.countDocuments({
          storyId: { $in: works.map(item => item._id) },
          status: 'active',
        }),
        StatisticsEvent.countDocuments({
          storyId: { $in: works.map(item => item._id) },
          eventType: 'view',
        }),
      ])
      res.json({
        story: {
          ...story,
          synopsis: story.description,
          language: 'Tiếng Việt',
          ratings: ratingCount,
          ratingCount,
          averageRating: ratingCount ? Math.round((10 * ratingTotal) / ratingCount) / 10 : null,
          authorBio: author?.profile?.bio ?? '',
          authorStats: { works: works.length, followers: authorFollowers, reads: authorReads },
          ratingBreakdown: [5, 4, 3, 2, 1].map(value =>
            ratingCount
              ? Math.round(
                  (100 * (ratings.find(item => item._id === value)?.count ?? 0)) / ratingCount,
                )
              : 0,
          ),
          featuredReview: latestComment?.body ?? '',
          featuredReviewer:
            latestComment?.authorAccountId?.status === 'anonymized'
              ? 'Deleted user'
              : latestComment?.authorAccountId?.status === 'active'
                ? latestComment.authorAccountId.displayName
                : '',
        },
        chapters: chapters.map(chapterListItem),
        viewer,
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/catalog/stories/:storyId/chapters/:chapterId', async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store').vary('Cookie')
    try {
      const { story, chapter, account } = await visibleChapter(config, req)
      const revision = await ContentRevision.findOne({
        _id: chapter.publishedRevisionId,
        storyId: chapter.storyId,
        chapterId: chapter._id,
        contentType: 'chapter',
        status: { $in: ['approved', 'immutable'] },
      })
        .select('content formatVersion mediaIds')
        .lean()
      if (!revision) throw new HttpError(404, 'not_found', 'Chương chưa sẵn sàng.')
      let document
      try {
        document = readRichChapter(revision)
      } catch (error) {
        if (!(error instanceof HttpError)) throw error
        throw new HttpError(404, 'not_found', 'Chương chưa sẵn sàng.')
      }
      const [neighbours, commentCount] = await Promise.all([
        publishedChapterRows([chapter.storyId]).then(rows =>
          withViewerUnlocks(rows.get(String(chapter.storyId)), account),
        ),
        Comment.countDocuments({ targetType: 'chapter', targetId: chapter._id, status: 'visible' }),
      ])
      const rows = neighbours
      const link = row =>
        row
          ? {
              id: row.id,
              orderKey: row.orderKey,
              title: row.title,
              locked: row.locked,
              unlocked: Boolean(row.unlocked),
            }
          : null
      await recordChapterView({ req, res, config, account, chapter })
      res.json({
        chapter: {
          id: String(chapter._id),
          title: revision.content.title ?? '',
          orderKey: chapter.orderKey,
          publishedAt: chapter.publishedAt ?? null,
          revisionId: String(revision._id),
          story: { id: story.id, title: story.title, author: story.author },
          prev: link(rows.findLast(row => row.orderKey < chapter.orderKey)),
          next: link(rows.find(row => row.orderKey > chapter.orderKey)),
          commentCount,
          blocks:
            revision.formatVersion === 'blocks-v1'
              ? revision.content.blocks
                  .filter(block => block.type === 'paragraph' && typeof block.text === 'string')
                  .map(block => ({ type: 'paragraph', text: block.text }))
              : document.blocks,
        },
      })
    } catch (error) {
      next(error)
    }
  })
  router.get(
    '/catalog/stories/:storyId/chapters/:chapterId/revisions/:revisionId/media/:mediaId',
    async (req, res, next) => {
      res.set('Cache-Control', 'private, no-store').vary('Cookie')
      try {
        const { chapter } = await visibleChapter(config, req)
        if (String(chapter.publishedRevisionId) !== req.params.revisionId)
          throw new HttpError(404, 'not_found', 'Ảnh không thuộc phiên bản công khai hiện tại.')
        const submission = await PublicationSubmission.findOne({
          storyId: chapter.storyId,
          chapterId: chapter._id,
          revisionId: chapter.publishedRevisionId,
          status: 'approved',
        }).lean()
        const revision =
          submission &&
          (await ContentRevision.exists({
            _id: chapter.publishedRevisionId,
            chapterId: chapter._id,
            storyId: chapter.storyId,
            authorAccountId: submission.authorAccountId,
            contentType: 'chapter',
            status: { $in: ['approved', 'immutable'] },
            immutableAt: { $ne: null },
          }))
        if (!revision) throw new HttpError(404, 'not_found', 'Ảnh chưa sẵn sàng.')
        const bytes = await submittedImage(
          config,
          { _id: submission.authorAccountId },
          submission._id,
          req.params.mediaId,
          { requireApproved: true },
        )
        res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(bytes)
      } catch (error) {
        next(error)
      }
    },
  )
  return router
}
