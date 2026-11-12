import { Router } from 'express'
import { z } from 'zod'
import {
  Category,
  ContentRevision,
  MediaAsset,
  Story,
  Chapter,
  PublicationSubmission,
} from '../models/index.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { withTransaction } from '../db/connection.js'
import { authorDashboard } from '../modules/authoring-publishing/author/author-dashboard.js'
import { authorStoryList } from '../modules/authoring-publishing/author/author-story-list.js'
import { authorStoryWorkspace } from '../modules/authoring-publishing/author/author-story-workspace.js'
import { authorDrafts } from '../modules/authoring-publishing/author/author-drafts.js'
import { authorAnalytics } from '../modules/authoring-publishing/author/author-analytics.js'
import {
  authorCommentList,
  changeAuthorCommentStatus,
  replyToAuthorComment,
} from '../modules/authoring-publishing/author/author-comments.js'
import {
  prepareEarlyAccess,
  changeEarlyAccess,
} from '../modules/authoring-publishing/author/author-early-access.js'
import {
  lockAuthor,
  ownStory,
  editable,
  metadataEditable,
} from '../modules/authoring-publishing/author/author-ownership.js'
import {
  assertTextEditorRevision,
  chapterParagraphText,
} from '../modules/authoring-publishing/content/chapter-document.js'
import { chapterCanDelete } from '../modules/authoring-publishing/author/author-chapter-lifecycle.js'
import {
  readRichChapter,
  editableChapterDocument,
  chapterDocumentFormat,
} from '../modules/authoring-publishing/content/rich-chapter-document.js'
import { pinChapterImages } from '../modules/authoring-publishing/author/author-chapter-media.js'
import {
  cleanupUnusedStoryMedia,
  removeMediaFiles,
} from '../modules/authoring-publishing/author/author-media.js'
import { changeDraftLifecycle } from '../modules/authoring-publishing/author/author-story-lifecycle.js'
import {
  prepareStoryRelease,
  publishStory,
} from '../modules/authoring-publishing/author/author-story-release.js'
import {
  prepareChapterRelease,
  publishChapter,
} from '../modules/authoring-publishing/author/author-chapter-release.js'
import {
  changeChapterSchedule,
  prepareChapterSchedule,
} from '../modules/authoring-publishing/content/chapter-scheduler.js'
import { reorderDraftChapters } from '../modules/authoring-publishing/author/author-chapter-order.js'
import { unpublishStory } from '../modules/authoring-publishing/author/author-story-unpublish.js'
import { changeChapterDraftLifecycle } from '../modules/authoring-publishing/author/author-chapter-lifecycle.js'
import {
  metadataTags,
  parseStoryTags,
  storyTagFields,
} from '../modules/authoring-publishing/content/story-tags.js'
const objectId = z.string().regex(/^[a-f\d]{24}$/i)
const authorCommentStatus = z.enum(['visible', 'hidden', 'soft-deleted'])
const authorCommentQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    storyId: objectId.optional(),
    chapterId: objectId.optional(),
    targetType: z.enum(['story', 'chapter']).optional(),
    status: authorCommentStatus.optional(),
    search: z.string().trim().max(120).default(''),
    sort: z.enum(['newest', 'oldest', 'az']).default('newest'),
  })
  .strict()
const authorCommentReply = z.object({ body: z.string().trim().min(1).max(2000) }).strict()
const storyInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000),
    categoryId: objectId,
    tags: z.unknown().optional(),
  })
  .strict()
const chapterInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    paragraphs: z.array(chapterParagraphText).min(1).max(1000),
  })
  .strict()
function parse(schema, value) {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.')
  return parsed.data
}
async function assertActiveCategory(categoryId, session) {
  if (!(await Category.exists({ _id: categoryId, status: 'active' }).session(session)))
    throw new HttpError(400, 'invalid_category', 'Hãy chọn một thể loại đang hoạt động.')
}
function view(story, tags) {
  return {
    id: String(story._id),
    publishedRevisionId: story.publishedRevisionId ? String(story.publishedRevisionId) : null,
    title: story.title,
    description: story.description ?? '',
    categoryId: String(story.categoryId),
    tags,
    coverMediaId: story.coverMediaId ? String(story.coverMediaId) : null,
    coverUrl: story.coverMediaId ? `/author/media/${story.coverMediaId}/content` : null,
    coverBannerMediaId: story.theme?.coverBannerMediaId
      ? String(story.theme.coverBannerMediaId)
      : null,
    bannerUrl: story.theme?.coverBannerMediaId
      ? `/author/media/${story.theme.coverBannerMediaId}/content`
      : null,
    status: story.publicationStatus,
    version: story.version,
    updatedAt: story.updatedAt,
  }
}
export function createAuthorContentRouter(config) {
  const router = Router()
  router.get(
    '/author/dashboard',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const query = parse(
          z
            .object({
              days: z.coerce
                .number()
                .pipe(z.union([z.literal(1), z.literal(7), z.literal(30)]))
                .default(1),
            })
            .strict(),
          req.query,
        )
        res
          .set('Cache-Control', 'private, no-store')
          .json(await authorDashboard(req.account._id, query))
      } catch (error) {
        next(error)
      }
    },
  )
  router.get(
    '/author/comments',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        res
          .set('Cache-Control', 'private, no-store')
          .json(await authorCommentList(req.account._id, parse(authorCommentQuery, req.query)))
      } catch (error) {
        next(error)
      }
    },
  )
  router.post(
    '/author/comments/:commentId/reply',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        if (!objectId.safeParse(req.params.commentId).success)
          throw new HttpError(400, 'validation_error', 'ID bình luận không hợp lệ.')
        res.status(201).json({
          reply: await replyToAuthorComment(
            req,
            req.params.commentId,
            parse(authorCommentReply, req.body),
          ),
        })
      } catch (error) {
        next(error)
      }
    },
  )
  router.patch(
    '/author/comments/:commentId/status',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        if (!objectId.safeParse(req.params.commentId).success)
          throw new HttpError(400, 'validation_error', 'ID bình luận không hợp lệ.')
        const { status } = parse(z.object({ status: authorCommentStatus }).strict(), req.body)
        res.json({ comment: await changeAuthorCommentStatus(req, req.params.commentId, status) })
      } catch (error) {
        next(error)
      }
    },
  )
  router.use('/author/stories', requireAuth(config), requireRole('author'))
  router.get(
    '/author/stories/:storyId/chapters/:chapterId/early-access',
    async (req, res, next) => {
      try {
        res
          .set('Cache-Control', 'private, no-store')
          .json(await prepareEarlyAccess(req.account, req.params.storyId, req.params.chapterId))
      } catch (error) {
        next(error)
      }
    },
  )
  router.put(
    '/author/stories/:storyId/chapters/:chapterId/early-access',
    async (req, res, next) => {
      try {
        const common = {
          expectedVersion: z.number().int().min(0),
          expectedStoryVersion: z.number().int().min(0),
        }
        const parsed = z
          .discriminatedUnion('enabled', [
            z
              .object({
                ...common,
                enabled: z.literal(false),
              })
              .strict(),
            z
              .object({
                ...common,
                enabled: z.literal(true),
                coinPrice: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
                durationDays: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
                policyId: objectId,
                expectedPolicyVersion: z.number().int().min(0),
              })
              .strict(),
          ])
          .safeParse(req.body)
        if (!parsed.success)
          throw new HttpError(400, 'validation_error', 'Thiết lập đọc sớm không hợp lệ.')
        res
          .set('Cache-Control', 'private, no-store')
          .json(
            await changeEarlyAccess(
              req.account,
              req.params.storyId,
              req.params.chapterId,
              parsed.data,
            ),
          )
      } catch (error) {
        next(error)
      }
    },
  )
  router.get('/author/stories/:storyId/chapters/:chapterId/schedule', async (req, res, next) => {
    try {
      res
        .set('Cache-Control', 'private, no-store')
        .json(
          await prepareChapterSchedule(
            req.account,
            parse(objectId, req.params.storyId),
            parse(objectId, req.params.chapterId),
            config,
          ),
        )
    } catch (error) {
      next(error)
    }
  })
  router.put('/author/stories/:storyId/chapters/:chapterId/schedule', async (req, res, next) => {
    try {
      const input = parse(
        z
          .object({
            revisionId: objectId,
            submissionId: objectId,
            expectedVersion: z.number().int().min(0),
            expectedStoryVersion: z.number().int().min(0),
            requestedReleaseAt: z.iso
              .datetime({
                offset: true,
              })
              .nullable(),
          })
          .strict(),
        req.body,
      )
      res.set('Cache-Control', 'private, no-store').json({
        chapter: await changeChapterSchedule(
          req.account,
          parse(objectId, req.params.storyId),
          parse(objectId, req.params.chapterId),
          input,
          config,
        ),
      })
    } catch (error) {
      next(error)
    }
  })
  router.post('/author/stories/:storyId/chapters/:chapterId/lifecycle', async (req, res, next) => {
    try {
      const input = parse(
        z
          .object({
            action: z.enum(['archive', 'restore', 'delete', 'unpublish']),
            expectedVersion: z.number().int().min(0),
            expectedStoryVersion: z.number().int().min(0),
          })
          .strict(),
        req.body,
      )
      const storyId = parse(objectId, req.params.storyId)
      const result = await changeChapterDraftLifecycle(
        req.account,
        storyId,
        parse(objectId, req.params.chapterId),
        input,
      )
      if (input.action === 'delete') {
        const cleanupKeys = await cleanupUnusedStoryMedia(config, req.account, storyId)
        await removeMediaFiles(config, cleanupKeys, { accountId: req.account._id })
      }
      res.json(result)
    } catch (error) {
      next(error)
    }
  })
  router.post('/author/stories/:storyId/chapters/reorder', async (req, res, next) => {
    try {
      const input = parse(
        z
          .object({
            expectedVersion: z.number().int().min(0),
            chapters: z
              .array(
                z
                  .object({
                    id: objectId,
                    expectedVersion: z.number().int().min(0),
                  })
                  .strict(),
              )
              .min(2)
              .max(1000),
          })
          .strict()
          .refine(
            value =>
              new Set(value.chapters.map(chapter => chapter.id)).size === value.chapters.length,
          ),
        req.body,
      )
      res.json(await reorderDraftChapters(req.account, parse(objectId, req.params.storyId), input))
    } catch (error) {
      next(error)
    }
  })
  router.get(
    '/author/analytics',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const input = parse(
          z
            .object({
              days: z.coerce
                .number()
                .pipe(
                  z.union([
                    z.literal(7),
                    z.literal(30),
                    z.literal(90),
                    z.literal(180),
                    z.literal(365),
                  ]),
                )
                .default(30),
              from: z.iso.date().optional(),
              to: z.iso.date().optional(),
              groupBy: z.enum(['day', 'week', 'month']).default('day'),
              storyId: objectId.optional(),
              chapterId: objectId.optional(),
            })
            .strict()
            .refine(value => !value.chapterId || Boolean(value.storyId))
            .refine(value => !value.from || !value.to || value.from <= value.to),
          req.query,
        )
        res
          .set('Cache-Control', 'private, no-store')
          .json(await authorAnalytics(req.account._id, input))
      } catch (error) {
        next(error)
      }
    },
  )
  router.param('storyId', (req, _res, next, id) => {
    if (!objectId.safeParse(id).success)
      return next(new HttpError(400, 'validation_error', 'ID truyện không hợp lệ.'))
    next()
  })
  router.param('chapterId', (req, _res, next, id) => {
    if (!objectId.safeParse(id).success)
      return next(new HttpError(400, 'validation_error', 'ID chương không hợp lệ.'))
    next()
  })
  router.get('/author/stories', async (req, res, next) => {
    try {
      res.json(await authorStoryList(req.account._id))
    } catch (error) {
      next(error)
    }
  })
  router.get(
    '/author/drafts',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        res.json(await authorDrafts(req.account._id))
      } catch (error) {
        next(error)
      }
    },
  )
  router.post('/author/stories', async (req, res, next) => {
    try {
      const input = parse(storyInput, req.body)
      const metadata = {
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        tags: input.tags === undefined ? [] : parseStoryTags(input.tags),
      }
      const story = await withTransaction(async session => {
        await lockAuthor(req.account, session)
        await assertActiveCategory(input.categoryId, session)
        const [created] = await Story.create(
          [
            {
              ...metadata,
              ...storyTagFields(metadata.tags),
              authorAccountId: req.account._id,
            },
          ],
          {
            session,
          },
        )
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'story',
              storyId: created._id,
              authorAccountId: req.account._id,
              revisionNumber: 1,
              formatVersion: 'story-v1',
              content: {
                ...metadata,
                coverMediaId: null,
                coverBannerMediaId: null,
              },
            },
          ],
          {
            session,
          },
        )
        created.draftRevisionId = revision._id
        created.currentRevisionId = revision._id
        await created.save({
          session,
        })
        return created
      })
      res.status(201).json({
        story: view(story, metadata.tags),
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/author/stories/:storyId/workspace', async (req, res, next) => {
    try {
      res.json(await authorStoryWorkspace(req.account, req.params.storyId))
    } catch (error) {
      next(error)
    }
  })
  router.get('/author/stories/:storyId/chapters/:chapterId/release', async (req, res, next) => {
    try {
      res
        .set('Cache-Control', 'private, no-store')
        .json(
          await prepareChapterRelease(
            req.account,
            parse(objectId, req.params.storyId),
            parse(objectId, req.params.chapterId),
            config,
          ),
        )
    } catch (error) {
      next(error)
    }
  })
  router.post('/author/stories/:storyId/chapters/:chapterId/release', async (req, res, next) => {
    try {
      const input = parse(
        z
          .object({
            revisionId: objectId,
            submissionId: objectId,
            expectedVersion: z.number().int().min(0),
            expectedStoryVersion: z.number().int().min(0),
          })
          .strict(),
        req.body,
      )
      const chapter = await publishChapter(
        req.account,
        parse(objectId, req.params.storyId),
        parse(objectId, req.params.chapterId),
        input,
        config,
      )
      res.status(chapter.replayed ? 200 : 201).json({
        chapter,
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/author/stories/:storyId/release', async (req, res, next) => {
    try {
      res
        .set('Cache-Control', 'private, no-store')
        .json(await prepareStoryRelease(req.account, parse(objectId, req.params.storyId)))
    } catch (error) {
      next(error)
    }
  })
  router.post('/author/stories/:storyId/release', async (req, res, next) => {
    try {
      const input = parse(
        z
          .object({
            revisionId: objectId,
            submissionId: objectId,
            expectedVersion: z.number().int().min(0),
          })
          .strict(),
        req.body,
      )
      const story = await publishStory(req.account, parse(objectId, req.params.storyId), input)
      res.status(story.replayed ? 200 : 201).json({
        story,
      })
    } catch (error) {
      next(error)
    }
  })
  router.post('/author/stories/:storyId/lifecycle', async (req, res, next) => {
    try {
      const id = parse(objectId, req.params.storyId)
      const input = parse(
        z.union([
          z
            .object({
              action: z.enum(['archive', 'restore', 'delete']),
              expectedVersion: z.number().int().min(0),
            })
            .strict(),
          z
            .object({
              action: z.literal('unpublish'),
              expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
              expectedPublishedRevisionId: objectId,
              reason: z.string().trim().min(1).max(1000),
            })
            .strict(),
        ]),
        req.body,
      )
      const story =
        input.action === 'unpublish'
          ? await unpublishStory(req.account, id, input)
          : await changeDraftLifecycle(req.account, id, input)
      if (input.action === 'delete') {
        const cleanupKeys = await cleanupUnusedStoryMedia(config, req.account, id)
        await removeMediaFiles(config, cleanupKeys, { accountId: req.account._id })
      }
      res.set('Cache-Control', 'private, no-store').json({ story })
    } catch (error) {
      next(error)
    }
  })
  router.put('/author/stories/:storyId', async (req, res, next) => {
    try {
      const input = parse(
        storyInput.extend({
          categoryId: storyInput.shape.categoryId.optional(),
          coverMediaId: objectId.nullable().optional(),
          coverBannerMediaId: objectId.nullable().optional(),
          expectedVersion: z.number().int().min(0),
        }),
        req.body,
      )
      const requestedTags = input.tags === undefined ? undefined : parseStoryTags(input.tags)
      const { story, tags, cleanupKeys } = await withTransaction(async session => {
        await lockAuthor(req.account, session)
        const current = await ownStory(req.account, req.params.storyId, session)
        metadataEditable(current)
        if (current.version !== input.expectedVersion)
          throw new HttpError(
            409,
            'stale_content',
            'Truyện đã thay đổi. Hãy tải lại trước khi lưu.',
          )
        const categoryId = input.categoryId ?? String(current.categoryId)
        const tags = requestedTags ?? (await metadataTags(current, session))
        const requestedCoverIds = [input.coverMediaId, input.coverBannerMediaId].filter(
          value => value !== undefined && value !== null,
        )
        if (requestedCoverIds.length) {
          const media = await MediaAsset.find({
            _id: { $in: requestedCoverIds },
            ownerAccountId: req.account._id,
            storyId: current._id,
            status: 'available',
          })
            .select('_id kind')
            .session(session)
            .lean()
          if (
            media.length !== requestedCoverIds.length ||
            (input.coverMediaId &&
              !media.some(
                item => String(item._id) === input.coverMediaId && item.kind === 'cover',
              )) ||
            (input.coverBannerMediaId &&
              !media.some(
                item => String(item._id) === input.coverBannerMediaId && item.kind === 'banner',
              ))
          )
            throw new HttpError(400, 'invalid_story_media', 'Ảnh bìa hoặc banner không hợp lệ.')
        }
        if (input.categoryId) await assertActiveCategory(categoryId, session)
        const last = await ContentRevision.findOne({
          storyId: current._id,
          contentType: 'story',
        })
          .sort({
            revisionNumber: -1,
          })
          .session(session)
        const coverMediaId =
          input.coverMediaId !== undefined
            ? input.coverMediaId
            : current.coverMediaId
              ? String(current.coverMediaId)
              : null
        const coverBannerMediaId =
          input.coverBannerMediaId !== undefined
            ? input.coverBannerMediaId
            : current.theme?.coverBannerMediaId
              ? String(current.theme.coverBannerMediaId)
              : null
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'story',
              storyId: current._id,
              authorAccountId: req.account._id,
              revisionNumber: (last?.revisionNumber ?? 0) + 1,
              parentRevisionId: last?._id,
              formatVersion: 'story-v1',
              content: {
                title: input.title,
                description: input.description,
                categoryId,
                tags,
                coverMediaId,
                coverBannerMediaId,
              },
            },
          ],
          {
            session,
          },
        )
        current.title = input.title
        current.description = input.description
        current.categoryId = categoryId
        // Public tags change only by release once the story has been released.
        if (!current.publishedRevisionId) current.set(storyTagFields(tags))
        if (input.coverMediaId !== undefined) current.coverMediaId = input.coverMediaId
        if (input.coverBannerMediaId !== undefined) {
          current.theme = {
            ...(current.theme?.toObject?.() ?? current.theme ?? {}),
            coverBannerMediaId: input.coverBannerMediaId ?? undefined,
          }
        }
        current.draftRevisionId = revision._id
        current.currentRevisionId = revision._id
        await current.save({
          session,
        })
        return {
          story: current,
          tags,
          cleanupKeys: await cleanupUnusedStoryMedia(config, req.account, current._id, session),
        }
      })
      await removeMediaFiles(config, cleanupKeys, { accountId: req.account._id })
      res.json({
        story: view(story, tags),
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/author/stories/:storyId', async (req, res, next) => {
    try {
      const story = await ownStory(req.account, req.params.storyId)
      res.json({
        story: view(story, await metadataTags(story)),
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/author/stories/:storyId/chapters', async (req, res, next) => {
    try {
      await ownStory(req.account, req.params.storyId)
      const chapters = await Chapter.find({
        storyId: req.params.storyId,
        'publicationTransition.result': {
          $ne: 'author-draft-deleted',
        },
      })
        .sort({
          orderKey: 1,
        })
        .limit(1000)
        .lean()
      res.json({
        items: chapters.map(chapter => ({
          id: String(chapter._id),
          title: chapter.title,
          orderKey: chapter.orderKey,
          status: chapter.status,
          version: chapter.version,
          updatedAt: chapter.updatedAt,
        })),
      })
    } catch (error) {
      next(error)
    }
  })
  router.post('/author/stories/:storyId/chapters', async (req, res, next) => {
    try {
      const input = parse(
        z.union([
          chapterInput,
          z
            .object({
              document: editableChapterDocument,
            })
            .strict(),
        ]),
        req.body,
      )
      const title = input.document?.title ?? input.title
      const { chapter, cleanupKeys } = await withTransaction(async session => {
        await lockAuthor(req.account, session)
        const story = await ownStory(req.account, req.params.storyId, session)
        editable(story)
        const last = await Chapter.findOne({
          storyId: story._id,
        })
          .sort({
            orderKey: -1,
          })
          .session(session)
        const [created] = await Chapter.create(
          [
            {
              storyId: story._id,
              title,
              orderKey: Math.max(0, last?.orderKey ?? 0) + 1,
            },
          ],
          {
            session,
          },
        )
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'chapter',
              storyId: story._id,
              chapterId: created._id,
              authorAccountId: req.account._id,
              revisionNumber: 1,
              formatVersion: input.document ? chapterDocumentFormat(input.document) : 'blocks-v1',
              ...(await pinChapterImages(config, req.account, story._id, input.document, session)),
              content: input.document ?? {
                title: input.title,
                blocks: input.paragraphs.map(text => ({
                  type: 'paragraph',
                  text,
                })),
              },
            },
          ],
          {
            session,
          },
        )
        created.draftRevisionId = revision._id
        created.currentRevisionId = revision._id
        await created.save({
          session,
        })
        return {
          chapter: created,
          cleanupKeys: await cleanupUnusedStoryMedia(config, req.account, story._id, session),
        }
      })
      await removeMediaFiles(config, cleanupKeys, { accountId: req.account._id })
      res.status(201).json({
        chapter: {
          id: String(chapter._id),
          version: chapter.version,
        },
      })
    } catch (error) {
      next(error)
    }
  })
  router.get('/author/stories/:storyId/chapters/:chapterId', async (req, res, next) => {
    try {
      const { format, source } = parse(
        z
          .object({
            format: z.enum(['plain', 'rich']).default('plain'),
            source: z.enum(['current', 'published']).default('current'),
          })
          .strict(),
        req.query,
      )
      const story = await ownStory(req.account, req.params.storyId)
      const chapter = await Chapter.findOne({
        _id: req.params.chapterId,
        storyId: req.params.storyId,
        'publicationTransition.result': {
          $ne: 'author-draft-deleted',
        },
      }).lean()
      if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.')
      if (source === 'published' && !chapter.publishedRevisionId)
        throw new HttpError(404, 'not_found', 'Chương này chưa được xuất bản.')
      const revisionId =
        source === 'published' && chapter.publishedRevisionId
          ? chapter.publishedRevisionId
          : (chapter.draftRevisionId ?? chapter.currentRevisionId ?? chapter.publishedRevisionId)
      const revision = await ContentRevision.findOne({
        _id: revisionId,
        chapterId: chapter._id,
        storyId: story._id,
        contentType: 'chapter',
        authorAccountId: req.account._id,
      }).lean()
      if (!revision)
        throw new HttpError(409, 'missing_revision', 'Không tải được bản nội dung của chương.')
      const openSubmission = await PublicationSubmission.exists({
        storyId: story._id,
        chapterId: chapter._id,
        status: { $in: ['validated', 'pending-review', 'decision-pending'] },
      })
      const document = format === 'rich' ? readRichChapter(revision) : null
      if (!document) assertTextEditorRevision(revision)
      const outline = await Chapter.find({
        storyId: story._id,
        status: {
          $ne: 'archived',
        },
      })
        .sort({
          orderKey: 1,
        })
        .select('title orderKey status')
        .lean()
      const canCreate =
        !story.authoringFrozen &&
        !['submitted', 'under-review', 'archived'].includes(story.publicationStatus)
      res.json({
        chapter: {
          id: String(chapter._id),
          storyId: String(story._id),
          storyTitle: story.title,
          storyVersion: story.version,
          number: chapter.orderKey,
          canCreate,
          revisionSource:
            String(revision._id) === String(chapter.publishedRevisionId) ? 'published' : 'current',
          publishedRevisionId: chapter.publishedRevisionId
            ? String(chapter.publishedRevisionId)
            : null,
          canEdit:
            String(revision._id) !== String(chapter.publishedRevisionId) &&
            canCreate &&
            ['draft', 'published'].includes(chapter.status) &&
            revision.status === 'editable' &&
            !revision.immutableAt,
          canDelete: chapterCanDelete(chapter, revision, story, Boolean(openSubmission)),
          outline: outline.map(item => ({
            id: String(item._id),
            number: item.orderKey,
            title: item.title,
            status: item.status,
          })),
          title: revision.content.title,
          version: chapter.version,
          status: chapter.status,
          ...(document
            ? {
                document,
                formatVersion: revision.formatVersion === 'blocks-v3' ? 'blocks-v3' : 'blocks-v2',
              }
            : {
                paragraphs: (revision?.content?.blocks ?? [])
                  .filter(block => block.type === 'paragraph')
                  .map(block => block.text),
              }),
        },
      })
    } catch (error) {
      next(error)
    }
  })
  router.put('/author/stories/:storyId/chapters/:chapterId', async (req, res, next) => {
    try {
      const input = parse(
        z.union([
          chapterInput.extend({
            expectedVersion: z.number().int().min(0),
          }),
          z
            .object({
              document: editableChapterDocument,
              expectedVersion: z.number().int().min(0),
            })
            .strict(),
        ]),
        req.body,
      )
      const result = await withTransaction(async session => {
        await lockAuthor(req.account, session)
        const story = await ownStory(req.account, req.params.storyId, session)
        editable(story)
        const chapter = await Chapter.findOne({
          _id: req.params.chapterId,
          storyId: story._id,
        }).session(session)
        if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.')
        if (
          chapter.version !== input.expectedVersion ||
          !['draft', 'published'].includes(chapter.status)
        )
          throw new HttpError(409, 'stale_content', 'Chương đã thay đổi hoặc bị khóa. Hãy tải lại.')
        const source = await ContentRevision.findOne({
          _id: chapter.draftRevisionId ?? chapter.currentRevisionId,
          storyId: story._id,
          chapterId: chapter._id,
          contentType: 'chapter',
          authorAccountId: req.account._id,
        }).session(session)
        if (!source)
          throw new HttpError(409, 'missing_revision', 'Không tìm thấy bản nháp hiện tại.')
        if (input.document) readRichChapter(source)
        else assertTextEditorRevision(source)
        if (source.status !== 'editable' || source.immutableAt)
          throw new HttpError(409, 'content_frozen', 'Phiên bản hiện tại đã bị khóa chỉnh sửa.')
        const last = await ContentRevision.findOne({
          chapterId: chapter._id,
        })
          .sort({
            revisionNumber: -1,
          })
          .session(session)
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'chapter',
              storyId: story._id,
              chapterId: chapter._id,
              authorAccountId: req.account._id,
              revisionNumber: (last?.revisionNumber ?? 0) + 1,
              parentRevisionId: last?._id,
              formatVersion: input.document ? chapterDocumentFormat(input.document) : 'blocks-v1',
              ...(await pinChapterImages(config, req.account, story._id, input.document, session)),
              content: input.document ?? {
                title: input.title,
                blocks: input.paragraphs.map(text => ({
                  type: 'paragraph',
                  text,
                })),
              },
            },
          ],
          {
            session,
          },
        )
        if (chapter.status !== 'published') chapter.title = input.document?.title ?? input.title
        chapter.draftRevisionId = revision._id
        chapter.currentRevisionId = revision._id
        await chapter.save({
          session,
        })
        return {
          id: String(chapter._id),
          version: chapter.version,
          cleanupKeys: await cleanupUnusedStoryMedia(config, req.account, story._id, session),
        }
      })
      const { cleanupKeys, ...chapterResult } = result
      await removeMediaFiles(config, cleanupKeys, { accountId: req.account._id })
      res.json({
        chapter: chapterResult,
      })
    } catch (error) {
      next(error)
    }
  })
  return router
}
