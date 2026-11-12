import { getWalletHistory } from './wallet-history.js'

export const getAuthorEarnings = (accountId, options) =>
  getWalletHistory(accountId, options, 'author-earnings')
