import { policy as policies } from '../../accounts-administration/service.js'
import { AuthorRevenueRate } from '../../../models/index.js'
import { HttpError } from '../../../middleware/errors.js'

export function calculateUnlockSplit(priceCoins, authorPercent) {
  if (!Number.isSafeInteger(priceCoins) || priceCoins <= 0) {
    throw new HttpError(409, 'invalid_unlock_price', 'Giá mở khóa không hợp lệ.')
  }

  if (!Number.isFinite(authorPercent) || authorPercent < 0 || authorPercent > 100) {
    throw new HttpError(409, 'invalid_revenue_rate', 'Tỷ lệ chia doanh thu không hợp lệ.')
  }

  const authorCoins = Math.floor((priceCoins * authorPercent) / 100)
  const platformCoins = priceCoins - authorCoins

  if (
    !Number.isSafeInteger(authorCoins) ||
    !Number.isSafeInteger(platformCoins) ||
    authorCoins < 0 ||
    platformCoins < 0
  ) {
    throw new HttpError(409, 'invalid_revenue_amount', 'Số xu phân bổ không hợp lệ.')
  }

  return { authorCoins, platformCoins }
}

export async function getUnlockRevenueSplit(authorId, priceCoins, session, now = new Date()) {
  const policy = await policies.getEffective({ now, session, required: false })

  if (!policy) {
    throw new HttpError(409, 'policy_required', 'Chưa có chính sách phân bổ doanh thu có hiệu lực.')
  }

  const negotiatedRate = await AuthorRevenueRate.findOne({
    authorAccountId: authorId,
    effectiveAt: { $lte: now },
  })
    .sort({ effectiveAt: -1, _id: -1 })
    .session(session ?? null)
    .lean()

  const authorPercent = negotiatedRate?.percentage ?? policy.authorSharePercent

  const split = calculateUnlockSplit(priceCoins, authorPercent)

  return {
    ...split,
    authorPercent,
    platformPercent: 100 - authorPercent,
    policySnapshot: {
      id: String(policy._id),
      version: policy.version,
      authorSharePercent: policy.authorSharePercent,
      platformSharePercent: policy.platformSharePercent,
    },
    negotiatedAllocationSnapshot: negotiatedRate
      ? {
          id: String(negotiatedRate._id),
          authorAccountId: String(negotiatedRate.authorAccountId),
          percentage: negotiatedRate.percentage,
          effectiveAt: negotiatedRate.effectiveAt,
        }
      : undefined,
  }
}
