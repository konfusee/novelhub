import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { REPORT_REASONS, REPORT_TARGET_TYPES } from '../models/index.js'
import {
  createComment,
  deleteComment,
  editComment,
  likeComment,
  listComments,
} from '../modules/community/comments.js'
import { setFollow } from '../modules/community/follows.js'
import { setRating } from '../modules/community/ratings.js'
import { submitReport } from '../modules/community/reports.js'
import { optionalAccount } from '../modules/reading/access.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const commentBody = z.string().trim().min(1).max(2000)
const followInput = z.object({ following: z.boolean() }).strict()
const ratingInput = z.object({ value: z.number().int().min(1).max(5) }).strict()
const pageQuery = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict()
const commentInput = z.object({ body: commentBody, parentId: id.optional() }).strict()
const editInput = z.object({ body: commentBody, expectedVersion: z.number().int().min(0) }).strict()
const likeInput = z.object({ liked: z.boolean() }).strict()
const reportInput = z
  .object({
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: id,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .strict()
const targetTypes = { stories: 'story', chapters: 'chapter' }

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.')
  return result.data
}

export function createCommunityRouter(config) {
  const router = Router()
  const auth = requireAuth(config)
  for (const name of ['storyId', 'targetId', 'commentId'])
    router.param(name, (_req, _res, next, value) =>
      next(
        id.safeParse(value).success
          ? undefined
          : new HttpError(400, 'validation_error', 'ID không hợp lệ.'),
      ),
    )

  router.put('/community/stories/:storyId/follow', auth, async (req, res, next) => {
    try {
      const { following } = parse(followInput, req.body)
      res.json(await setFollow(req, req.params.storyId, following))
    } catch (error) {
      next(error)
    }
  })
  router.put('/community/stories/:storyId/rating', auth, async (req, res, next) => {
    try {
      const { value } = parse(ratingInput, req.body)
      res.json(await setRating(req, req.params.storyId, value))
    } catch (error) {
      next(error)
    }
  })
  router.delete('/community/stories/:storyId/rating', auth, async (req, res, next) => {
    try {
      res.json(await setRating(req, req.params.storyId, null))
    } catch (error) {
      next(error)
    }
  })

  for (const [segment, targetType] of Object.entries(targetTypes)) {
    const path = `/community/${segment}/:targetId/comments`
    router.get(path, async (req, res, next) => {
      res.set('Cache-Control', 'private, no-store').vary('Cookie')
      try {
        const { page } = parse(pageQuery, req.query)
        res.json(
          await listComments(
            targetType,
            req.params.targetId,
            page,
            await optionalAccount(req, config),
          ),
        )
      } catch (error) {
        next(error)
      }
    })
    router.post(path, auth, async (req, res, next) => {
      try {
        const comment = await createComment(
          req,
          targetType,
          req.params.targetId,
          parse(commentInput, req.body),
        )
        res.status(201).json({ comment })
      } catch (error) {
        next(error)
      }
    })
  }
  router.put('/community/comments/:commentId', auth, async (req, res, next) => {
    try {
      res.json({
        comment: await editComment(req, req.params.commentId, parse(editInput, req.body)),
      })
    } catch (error) {
      next(error)
    }
  })
  router.delete('/community/comments/:commentId', auth, async (req, res, next) => {
    try {
      await deleteComment(req, req.params.commentId)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  router.put('/community/comments/:commentId/like', auth, async (req, res, next) => {
    try {
      const { liked } = parse(likeInput, req.body)
      res.json(await likeComment(req, req.params.commentId, liked))
    } catch (error) {
      next(error)
    }
  })

  router.post('/community/reports', auth, async (req, res, next) => {
    try {
      res.status(201).json({ report: await submitReport(req, parse(reportInput, req.body)) })
    } catch (error) {
      next(error)
    }
  })
  return router
}
