import { HttpError } from '../../../middleware/errors.js'

/**
 * PeriodStats (SDS 3.1): periods, buckets and summary statistics in Vietnam time.
 * Vietnam time is UTC+7 all year (no daylight saving time), so day, Monday-start week and
 * month boundaries are fixed offsets from UTC, the same as `$dateTrunc` with timezone '+07:00'.
 */
export const VIETNAM_TIMEZONE = '+07:00'
export const RISK_LEVELS = ['low', 'medium', 'high']

const OFFSET_MS = 7 * 3600000
const DAY_MS = 86400000
const PERIOD_DAYS = { last7: 7, last30: 30, last90: 90 }

const invalidPeriod = () =>
  new HttpError(
    422,
    'invalid_period',
    'Khoảng thời gian không hợp lệ: ngày bắt đầu sau ngày kết thúc hoặc ngày kết thúc ở tương lai.',
  )

/** Copy of an instant shifted so that its UTC fields read as the Vietnam calendar fields. */
const vietnamFields = date => new Date(date.getTime() + OFFSET_MS)
/** 00:00 Vietnam time of a Vietnam calendar day; month and day may overflow like Date.UTC. */
const vietnamMidnight = (year, month, day) => new Date(Date.UTC(year, month, day) - OFFSET_MS)
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS)

/** 00:00 Vietnam time of the day that contains `now` (decisions today, BR-NEW-S04). */
export function vietnamDayStart(now) {
  const day = vietnamFields(now)
  return vietnamMidnight(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
}

/** 00:00 Vietnam time of a `YYYY-MM-DD` calendar day. */
export function vietnamDate(isoDay) {
  const [year, month, day] = isoDay.split('-').map(Number)
  return vietnamMidnight(year, month - 1, day)
}

/** 00:00 Vietnam time of the day after a `YYYY-MM-DD` calendar day (exclusive range end). */
export const vietnamDayAfter = isoDay => addDays(vietnamDate(isoDay), 1)

/**
 * [from, to) of a statistics query. lastN: from 00:00 of the day N − 1 days before today to now.
 * custom: inclusive Vietnam days, capped at now; a start after the end or an end after today
 * is invalid (UC-MOD-09 EX1).
 */
export function range({ period, from, to, bucket }, now) {
  const today = vietnamDayStart(now)
  if (period !== 'custom') return { from: addDays(today, 1 - PERIOD_DAYS[period]), to: now, bucket }
  const start = vietnamDate(from)
  const lastDay = vietnamDate(to)
  if (start > lastDay || lastDay > today) throw invalidPeriod()
  const end = addDays(lastDay, 1)
  return { from: start, to: end < now ? end : now, bucket }
}

/** Start of the day, Monday-start week or month that contains `date`. */
export function bucketStart(date, bucket) {
  const day = vietnamFields(date)
  const year = day.getUTCFullYear()
  const month = day.getUTCMonth()
  if (bucket === 'month') return vietnamMidnight(year, month, 1)
  const sinceMonday = bucket === 'week' ? (day.getUTCDay() + 6) % 7 : 0
  return vietnamMidnight(year, month, day.getUTCDate() - sinceMonday)
}

function nextBucket(start, bucket) {
  if (bucket !== 'month') return addDays(start, bucket === 'week' ? 7 : 1)
  const day = vietnamFields(start)
  return vietnamMidnight(day.getUTCFullYear(), day.getUTCMonth() + 1, 1)
}

/** Start of every bucket that overlaps the period, including buckets without activity. */
export function buckets(period, bucket) {
  const starts = []
  for (
    let start = bucketStart(period.from, bucket);
    start < period.to;
    start = nextBucket(start, bucket)
  )
    starts.push(start)
  return starts
}

/** `$dateTrunc` expression with the same boundaries as `bucketStart`. */
export const truncateExpression = (date, bucket) => ({
  $dateTrunc: {
    date,
    unit: bucket,
    timezone: VIETNAM_TIMEZONE,
    ...(bucket === 'week' ? { startOfWeek: 'monday' } : {}),
  },
})

const ascending = values => [...values].sort((left, right) => left - right)

/** Middle value, the mean of the two middle values for an even count; null without values. */
export function median(values) {
  if (!values.length) return null
  const ordered = ascending(values)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

/** Nearest-rank percentile p (0 < p ≤ 100); null without values. */
export function percentile(values, p) {
  if (!values.length) return null
  const ordered = ascending(values)
  return ordered[Math.max(1, Math.ceil((p / 100) * ordered.length)) - 1]
}

/** part / whole × 100 with one decimal; null (not available) when whole is 0. */
export function rate(part, whole) {
  return whole ? Math.round((part / whole) * 1000) / 10 : null
}

const agrees = row =>
  row.riskLevel === 'low'
    ? row.outcome === 'approved'
    : RISK_LEVELS.includes(row.riskLevel) && row.outcome === 'rejected'

/**
 * AI agreement (BR-NEW-S04): approvals at low risk plus rejections at medium or high risk, over
 * decisions whose LLM review succeeded. A succeeded review without a valid risk level stays in
 * that denominator, never agrees and is counted in succeededWithoutRiskLevel; a decision with a
 * failed or missing review is counted in withoutLlmReview.
 */
export function agreement(rows) {
  const qualifying = rows.filter(row => row.llmStatus === 'succeeded')
  const agreeing = qualifying.filter(agrees).length
  const levelRate = level => {
    const atLevel = qualifying.filter(row => row.riskLevel === level)
    return rate(atLevel.filter(agrees).length, atLevel.length)
  }
  return {
    overall: rate(agreeing, qualifying.length),
    byRiskLevel: Object.fromEntries(RISK_LEVELS.map(level => [level, levelRate(level)])),
    qualifying: qualifying.length,
    agreeing,
    succeededWithoutRiskLevel: qualifying.filter(row => !RISK_LEVELS.includes(row.riskLevel))
      .length,
    withoutLlmReview: rows.length - qualifying.length,
  }
}
