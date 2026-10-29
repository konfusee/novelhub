import { expect, it } from 'vitest'
import { calculateUnlockSplit } from '../src/modules/unlock-revenue.js'

it.each([
  [1000, 70, 700, 300],
  [1001, 70, 700, 301],
  [1001, 75, 750, 251],
  [1000, 0, 0, 1000],
  [1000, 100, 1000, 0],
])(
  'chia %i xu theo tỷ lệ tác giả %i phần trăm',
  (price, percentage, authorCoins, platformCoins) => {
    const result = calculateUnlockSplit(price, percentage)

    expect(result).toEqual({ authorCoins, platformCoins })
    expect(result.authorCoins + result.platformCoins).toBe(price)
  },
)

it('từ chối tỷ lệ vượt quá 100 phần trăm', () => {
  expect(() => calculateUnlockSplit(1000, 101)).toThrow()
})

it('từ chối giá âm', () => {
  expect(() => calculateUnlockSplit(-1000, 70)).toThrow()
})
