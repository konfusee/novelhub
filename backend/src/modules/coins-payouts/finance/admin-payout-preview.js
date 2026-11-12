import { availableAtCutoff, payoutCutoff } from './payout-period.js'
import { createHash } from 'node:crypto'
import { Account, PolicyVersion, Wallet, WithdrawalRequest } from '../../../models/index.js'
import { withTransaction } from '../../../db/connection.js'
import { HttpError } from '../../../middleware/errors.js'
import { evaluatePayoutEligibility } from './payout-eligibility.js'

// Hàm này sẽ được dùng lại khi xác nhận tạo khoản chi.
export async function buildMonthlyPayoutPreview(periodId, session, now = new Date()) {
  const policy = await PolicyVersion.findOne({
    status: { $in: ['effective', 'superseded'] },
    effectiveAt: { $lte: new Date(Math.min(+now, +payoutCutoff(periodId))) },
  })
    .sort({ effectiveAt: -1, _id: -1 })
    .session(session)
    .lean()

  const thresholdCoins = policy?.withdrawalThresholdCoins

  if (!policy || !Number.isSafeInteger(thresholdCoins) || thresholdCoins < 0) {
    throw new HttpError(409, 'policy_required', 'Chưa có chính sách chi trả hợp lệ.')
  }

  const earningsWallets = await Wallet.find({
    ownerType: 'account',
    purpose: 'author-earnings',
    unit: 'coin',
  })
    .select('ownerId')
    .session(session)
    .lean()
  const accounts = await Account.find({
    _id: { $in: earningsWallets.map(wallet => wallet.ownerId) },
    status: 'active',
  })
    .select('displayName status version +bankDetails')
    .sort({ _id: 1 })
    .session(session)
    .lean()

  const accountIds = accounts.map(account => account._id)

  const wallets = await Wallet.find({
    ownerType: 'account',
    ownerId: { $in: accountIds },
    purpose: 'author-earnings',
    unit: 'coin',
  })
    .session(session)
    .lean()

  const existing = await WithdrawalRequest.find({
    accountId: { $in: accountIds },
    periodId,
  })
    .select('accountId')
    .session(session)
    .lean()

  const walletByOwner = new Map(wallets.map(wallet => [String(wallet.ownerId), wallet]))

  const alreadyCreated = new Set(existing.map(row => String(row.accountId)))

  const items = []
  const versions = []

  for (const account of accounts) {
    const accountId = String(account._id)

    if (alreadyCreated.has(accountId)) continue

    const wallet = walletByOwner.get(accountId)

    const eligibility = evaluatePayoutEligibility({
      account,
      wallet,
      policy,
      eligibleBalanceCoins: await availableAtCutoff(wallet, periodId, session),
    })

    if (eligibility.state !== 'eligible') continue

    items.push({
      accountId,
      displayName: account.displayName,
      walletId: String(wallet._id),
      amountCoins: eligibility.amountCoins,
      payoutSlipAmountVnd: eligibility.amountCoins,
      bankDetails: eligibility.bankDetailsSnapshot,
    })

    versions.push({
      accountId,
      accountVersion: account.version,
      balanceVersion: wallet.balanceVersion,
    })
  }

  const totalCoins = items.reduce((total, item) => total + item.amountCoins, 0)

  if (!Number.isSafeInteger(totalCoins)) {
    throw new HttpError(409, 'invalid_payout_total', 'Tổng số xu chi trả vượt giới hạn xử lý.')
  }

  // Dấu nhận diện dữ liệu đã xem.
  // Bước xác nhận sẽ tính lại để phát hiện dữ liệu thay đổi.
  const previewHash = createHash('sha256')
    .update(
      JSON.stringify({
        periodId,
        policyId: String(policy._id),
        policyVersion: policy.version,
        thresholdCoins,
        items,
        versions,
      }),
    )
    .digest('hex')

  return {
    periodId,
    thresholdCoins,
    eligibleCount: items.length,
    totalCoins,
    totalVnd: totalCoins,
    previewHash,
    items,
  }
}

export async function getMonthlyPayoutPreview(periodId) {
  return withTransaction(session => buildMonthlyPayoutPreview(periodId, session))
}
