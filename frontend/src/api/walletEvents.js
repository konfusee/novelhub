export const WALLET_BALANCE_CHANGED = 'novelhub:wallet-balance-changed'

export function notifyWalletBalanceChanged() {
  window.dispatchEvent(new Event(WALLET_BALANCE_CHANGED))
}
