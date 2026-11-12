import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { getPlatformFinanceReport } from '../modules/coins-payouts/finance/platform-finance-report.js'
import { Account, Chapter, PolicyVersion, Story } from '../models/index.js'
import {
  listFinancialTransactions,
  findReaderWallets,
  resolveBankTransaction,
  financialStatistics,
} from '../modules/coins-payouts/finance/admin-transactions.js'

const id = z.string().regex(/^[a-fA-F0-9]{24}$/)
const list = z
  .object({
    source: z.enum(['ledger', 'bank']).default('ledger'),
    status: z
      .enum(['matched', 'unmatched', 'amount-mismatch', 'expired', 'already-paid', 'resolved'])
      .optional(),
    search: z.string().trim().max(100).default(''),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict()
  .refine(value => !value.from || !value.to || new Date(value.from) < new Date(value.to))
const resolution = z
  .object({ walletId: id.optional(), reason: z.string().trim().min(1).max(500) })
  .strict()

export function createAdminTransactionsRouter(config) {
  const router = Router()
  router.use('/admin/transactions', requireAuth(config), requireRole('admin'))
  router.get('/admin/transactions/report-options', async (_req, res, next) => {
    try {
      const authors = await Account.find({ everAuthor: true })
        .select('displayName')
        .sort({ displayName: 1 })
        .lean()
      const stories = await Story.find().select('title authorAccountId').sort({ title: 1 }).lean()
      const chapters = await Chapter.find()
        .select('storyId title orderKey')
        .sort({ storyId: 1, orderKey: 1 })
        .lean()
      const policies = await PolicyVersion.find({ status: { $ne: 'draft' } })
        .select('effectiveAt version')
        .sort({ effectiveAt: -1 })
        .lean()
      res.set('Cache-Control', 'private, no-store').json({ authors, stories, chapters, policies })
    } catch (error) {
      next(error)
    }
  })
  router.get('/admin/transactions/report', async (req, res, next) => {
    try {
      const parsed = z
        .object({
          from: z.string().datetime({ offset: true }),
          to: z.string().datetime({ offset: true }),
          groupBy: z.enum(['day', 'week', 'month', 'story', 'chapter', 'author']).default('month'),
          policyId: id.optional(),
          authorId: id.optional(),
          storyId: id.optional(),
          chapterId: id.optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
          export: z.literal('csv').optional(),
        })
        .strict()
        .refine(
          value =>
            +new Date(value.to) > +new Date(value.from) &&
            +new Date(value.to) - +new Date(value.from) <= 366 * 86400000,
        )
        .safeParse(req.query)
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Chọn khoảng ngày hợp lệ, tối đa 366 ngày.')
      res
        .set('Cache-Control', 'private, no-store')
        .json(await getPlatformFinanceReport({ ...parsed.data, all: parsed.data.export === 'csv' }))
    } catch (error) {
      next(error)
    }
  })
  router.get('/admin/transactions/statistics', async (req, res, next) => {
    try {
      const parsed = list.safeParse(req.query)
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc thống kê không hợp lệ.')
      res.set('Cache-Control', 'private, no-store').json(await financialStatistics(parsed.data))
    } catch (error) {
      next(error)
    }
  })
  router.get('/admin/transactions', async (req, res, next) => {
    try {
      const parsed = list.safeParse(req.query)
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Bộ lọc giao dịch không hợp lệ.')
      res
        .set('Cache-Control', 'private, no-store')
        .json(await listFinancialTransactions(parsed.data))
    } catch (error) {
      next(error)
    }
  })
  router.get('/admin/transactions/reader-wallets', async (req, res, next) => {
    try {
      const query = z
        .object({ search: z.string().trim().min(2).max(100) })
        .strict()
        .safeParse(req.query)
      if (!query.success)
        throw new HttpError(400, 'validation_error', 'Nhập ít nhất hai ký tự tìm tài khoản.')
      res.set('Cache-Control', 'private, no-store').json(await findReaderWallets(query.data.search))
    } catch (error) {
      next(error)
    }
  })
  router.post('/admin/transactions/:id/resolve', async (req, res, next) => {
    try {
      const body = resolution.safeParse(req.body)
      if (!body.success || !id.safeParse(req.params.id).success)
        throw new HttpError(400, 'validation_error', 'Thông tin đối soát không hợp lệ.')
      res
        .set('Cache-Control', 'private, no-store')
        .json(await resolveBankTransaction(req.account, req.params.id, body.data))
    } catch (error) {
      next(error)
    }
  })
  return router
}
