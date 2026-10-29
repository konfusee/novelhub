import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { LIBRARY_TABS, readerLibrary } from '../modules/reading/library.js'
import {
  clearHistory,
  deleteHistoryEntry,
  readingHistory,
  resumeFor,
  saveProgress,
} from '../modules/reading/progress.js'

const id = z.string().regex(/^[a-f\d]{24}$/i)
const page = z.coerce.number().int().min(1).max(100000).default(1)
const progressInput = z
  .object({
    storyId: id,
    chapterId: id,
    position: z.number().min(0).max(1),
    completed: z.boolean().optional(),
  })
  .strict()
const libraryQuery = z.object({ tab: z.enum(LIBRARY_TABS).default('all'), page }).strict()
const historyQuery = z.object({ page }).strict()
const validate = (schema, value) => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.')
  return parsed.data
}

export function createReaderReadingRouter(config) {
  const router = Router()
  router.use(['/reader/progress', '/reader/library', '/reader/history'], requireAuth(config))
  router.param('storyId', (_req, _res, next, value) =>
    next(
      id.safeParse(value).success
        ? undefined
        : new HttpError(400, 'validation_error', 'ID truyện không hợp lệ.'),
    ),
  )
  router.param('id', (_req, _res, next, value) =>
    next(
      id.safeParse(value).success
        ? undefined
        : new HttpError(400, 'validation_error', 'ID không hợp lệ.'),
    ),
  )

  router.put('/reader/progress', async (req, res, next) => {
    try {
      res.json({ progress: await saveProgress(req, validate(progressInput, req.body)) })
    } catch (error) {
      next(error)
    }
  })
  router.get('/reader/progress/:storyId', async (req, res, next) => {
    try {
      res.json({ resume: await resumeFor(req.account, req.params.storyId) })
    } catch (error) {
      next(error)
    }
  })
  router.get('/reader/library', async (req, res, next) => {
    try {
      res.json(await readerLibrary(req.account, validate(libraryQuery, req.query)))
    } catch (error) {
      next(error)
    }
  })
  router.get('/reader/history', async (req, res, next) => {
    try {
      res.json(await readingHistory(req.account, validate(historyQuery, req.query).page))
    } catch (error) {
      next(error)
    }
  })
  router.delete('/reader/history/:id', async (req, res, next) => {
    try {
      await deleteHistoryEntry(req, req.params.id)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  router.delete('/reader/history', async (req, res, next) => {
    try {
      await clearHistory(req)
      res.status(204).end()
    } catch (error) {
      next(error)
    }
  })
  return router
}
