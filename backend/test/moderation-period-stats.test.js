import { describe, expect, it } from 'vitest'
import {
  agreement,
  bucketStart,
  buckets,
  median,
  percentile,
  range,
  rate,
  vietnamDayStart,
} from '../src/modules/moderation-ai/moderation/period-stats.js'

const at = iso => new Date(iso)
const isoList = dates => dates.map(date => date.toISOString())
// Wednesday 2026-11-11 12:00 in Vietnam (UTC+7).
const NOW = at('2026-11-11T05:00:00Z')

describe('PeriodStats in Vietnam time (UTC+7)', () => {
  it('starts the Vietnam day at 17:00 UTC of the previous UTC day', () => {
    expect(vietnamDayStart(at('2026-11-11T16:59:59Z')).toISOString()).toBe(
      '2026-11-10T17:00:00.000Z',
    )
    expect(vietnamDayStart(at('2026-11-11T17:00:00Z')).toISOString()).toBe(
      '2026-11-11T17:00:00.000Z',
    )
  })

  it('covers the last N Vietnam days up to now', () => {
    const last7 = range({ period: 'last7', bucket: 'day' }, NOW)
    expect(last7.from.toISOString()).toBe('2026-11-04T17:00:00.000Z')
    expect(last7.to).toBe(NOW)
    expect(range({ period: 'last30', bucket: 'day' }, NOW).from.toISOString()).toBe(
      '2026-10-12T17:00:00.000Z',
    )
    expect(range({ period: 'last90', bucket: 'day' }, NOW).from.toISOString()).toBe(
      '2026-08-13T17:00:00.000Z',
    )
  })

  it('treats custom dates as inclusive Vietnam days capped at now', () => {
    const custom = range({ period: 'custom', from: '2026-11-01', to: '2026-11-03' }, NOW)
    expect(custom.from.toISOString()).toBe('2026-10-31T17:00:00.000Z')
    expect(custom.to.toISOString()).toBe('2026-11-03T17:00:00.000Z')
    expect(range({ period: 'custom', from: '2026-11-11', to: '2026-11-11' }, NOW).to).toBe(NOW)
  })

  it('rejects a start after the end or an end after today (EX1)', () => {
    for (const [from, to, now] of [
      ['2026-11-05', '2026-11-01', NOW],
      // 23:30 on 11 November in Vietnam: the 12th is still in the future.
      ['2026-11-10', '2026-11-12', at('2026-11-11T16:30:00Z')],
    ])
      expect(() => range({ period: 'custom', from, to }, now)).toThrow(
        expect.objectContaining({ status: 422, code: 'invalid_period' }),
      )
    // 00:30 on 12 November in Vietnam: the 12th is today.
    const now = at('2026-11-11T17:30:00Z')
    expect(range({ period: 'custom', from: '2026-11-10', to: '2026-11-12' }, now).to).toBe(now)
  })

  it('truncates to days, Monday-start weeks and months at Vietnam midnight', () => {
    const start = (iso, bucket) => bucketStart(at(iso), bucket).toISOString()
    expect(start('2026-11-10T16:59:59Z', 'day')).toBe('2026-11-09T17:00:00.000Z')
    expect(start('2026-11-10T17:00:00Z', 'day')).toBe('2026-11-10T17:00:00.000Z')
    // Sunday 15 November 23:30 belongs to the week of Monday 9 November.
    expect(start('2026-11-15T16:30:00Z', 'week')).toBe('2026-11-08T17:00:00.000Z')
    // Monday 16 November 00:00 starts a new week.
    expect(start('2026-11-15T17:00:00Z', 'week')).toBe('2026-11-15T17:00:00.000Z')
    expect(start('2026-10-31T16:30:00Z', 'month')).toBe('2026-09-30T17:00:00.000Z')
    expect(start('2026-10-31T17:30:00Z', 'month')).toBe('2026-10-31T17:00:00.000Z')
  })

  it('lists every bucket of the period, including buckets without activity', () => {
    const last7 = range({ period: 'last7', bucket: 'day' }, NOW)
    expect(isoList(buckets(last7, 'day'))).toEqual([
      '2026-11-04T17:00:00.000Z',
      '2026-11-05T17:00:00.000Z',
      '2026-11-06T17:00:00.000Z',
      '2026-11-07T17:00:00.000Z',
      '2026-11-08T17:00:00.000Z',
      '2026-11-09T17:00:00.000Z',
      '2026-11-10T17:00:00.000Z',
    ])
    expect(isoList(buckets(last7, 'week'))).toEqual([
      '2026-11-01T17:00:00.000Z',
      '2026-11-08T17:00:00.000Z',
    ])
    expect(isoList(buckets(last7, 'month'))).toEqual(['2026-10-31T17:00:00.000Z'])
    const yearEnd = range(
      { period: 'custom', from: '2025-12-15', to: '2026-01-10' },
      at('2026-02-01T00:00:00Z'),
    )
    expect(isoList(buckets(yearEnd, 'month'))).toEqual([
      '2025-11-30T17:00:00.000Z',
      '2025-12-31T17:00:00.000Z',
    ])
  })

  it('computes median, nearest-rank percentile and one-decimal rates', () => {
    expect(median([])).toBeNull()
    expect(median([5])).toBe(5)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([9, 1, 5])).toBe(5)
    expect(percentile([], 90)).toBeNull()
    expect(percentile([7], 90)).toBe(7)
    expect(percentile([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 90)).toBe(9)
    expect(percentile([3600, 7200, 10800, 36000], 90)).toBe(36000)
    expect(rate(1, 3)).toBe(33.3)
    expect(rate(2, 3)).toBe(66.7)
    expect(rate(0, 0)).toBeNull()
  })

  it('measures AI agreement only over decisions with a successful LLM review (BR-NEW-S04)', () => {
    const rows = [
      { outcome: 'approved', riskLevel: 'low', llmStatus: 'succeeded' },
      { outcome: 'rejected', riskLevel: 'high', llmStatus: 'succeeded' },
      { outcome: 'approved', riskLevel: 'medium', llmStatus: 'succeeded' },
      { outcome: 'rejected', riskLevel: 'low', llmStatus: 'succeeded' },
      { outcome: 'approved', llmStatus: 'missing' },
    ]
    expect(agreement(rows)).toEqual({
      overall: 50,
      byRiskLevel: { low: 50, medium: 0, high: 100 },
      qualifying: 4,
      agreeing: 2,
      succeededWithoutRiskLevel: 0,
      withoutLlmReview: 1,
    })
    expect(agreement([{ outcome: 'approved', llmStatus: 'missing' }])).toEqual({
      overall: null,
      byRiskLevel: { low: null, medium: null, high: null },
      qualifying: 0,
      agreeing: 0,
      succeededWithoutRiskLevel: 0,
      withoutLlmReview: 1,
    })
  })

  it('keeps a succeeded review without a valid risk level in the denominator, never agreeing', () => {
    const rows = [
      { outcome: 'approved', riskLevel: 'low', llmStatus: 'succeeded' },
      { outcome: 'rejected', riskLevel: null, llmStatus: 'succeeded' },
      { outcome: 'rejected', riskLevel: 'critical', llmStatus: 'succeeded' },
      { outcome: 'approved', llmStatus: 'succeeded' },
      { outcome: 'rejected', llmStatus: 'missing' },
    ]
    expect(agreement(rows)).toEqual({
      overall: 25,
      byRiskLevel: { low: 100, medium: null, high: null },
      qualifying: 4,
      agreeing: 1,
      succeededWithoutRiskLevel: 3,
      withoutLlmReview: 1,
    })
  })
})
