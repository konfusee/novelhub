import { HttpError } from '../../../middleware/errors.js'
import { validBankDetails } from './bank-details.js'

// Chỉ xét điều kiện, không ghi database.
export function evaluatePayoutEligibility({ account, wallet, policy, eligibleBalanceCoins }) {
  if (account.status !== 'active') {
    return { state: 'skipped', reason: 'account-inactive' }
  }

  if (!wallet) {
    return { state: 'skipped', reason: 'empty-balance' }
  }

  if (
    wallet.ownerType !== 'account' ||
    String(wallet.ownerId) !== String(account._id) ||
    wallet.purpose !== 'author-earnings' ||
    wallet.unit !== 'coin'
  ) {
    throw new HttpError(409, 'invalid_earnings_wallet', 'Ví thu nhập không hợp lệ.')
  }

  const amountCoins = eligibleBalanceCoins ?? wallet.availableBalance
  const thresholdCoins = policy?.withdrawalThresholdCoins

  if (
    !Number.isSafeInteger(amountCoins) ||
    amountCoins < 0 ||
    !Number.isSafeInteger(thresholdCoins) ||
    thresholdCoins < 0
  ) {
    throw new HttpError(409, 'invalid_payout_amount', 'Số dư hoặc ngưỡng chi trả không hợp lệ.')
  }

  if (amountCoins === 0 || amountCoins < thresholdCoins) {
    return { state: 'skipped', reason: 'below-threshold' }
  }

  const bankDetailsSnapshot = {
    bankName: account.bankDetails?.bankName?.trim() ?? '',
    accountNumber: account.bankDetails?.accountNumber?.trim() ?? '',
    accountHolder: account.bankDetails?.accountHolder?.trim() ?? '',
  }

  if (!validBankDetails(bankDetailsSnapshot)) {
    return { state: 'missing-bank-details' }
  }

  return {
    state: 'eligible',
    amountCoins,
    thresholdCoins,
    bankDetailsSnapshot,
  }
}
