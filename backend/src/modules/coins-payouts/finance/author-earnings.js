import { getWalletHistory } from './wallet-history.js'
import { getAuthorFinanceSummary } from './author-finance-summary.js'

export async function getAuthorEarnings(accountId, options) {
  const history = await getWalletHistory(accountId, options, 'author-earnings')
  const summary = await getAuthorFinanceSummary(accountId, options)
  return { ...history, summary }
}
