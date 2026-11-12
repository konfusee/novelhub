import { getWalletHistory } from './wallet-history.js'

export const getReaderWallet = (accountId, options) =>
  getWalletHistory(accountId, options, 'reader-coins')
