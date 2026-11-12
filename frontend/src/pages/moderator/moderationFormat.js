// Shared display helpers of the moderation overview, statistics and history pages.
// Statistics buckets and history days are Vietnam calendar days (UTC+7), so they are formatted
// in that time zone whatever the browser's zone is.
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const vietnamDayFormat = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeZone: VIETNAM_TIME_ZONE,
})
const vietnamMonthFormat = new Intl.DateTimeFormat('vi-VN', {
  month: '2-digit',
  year: 'numeric',
  timeZone: VIETNAM_TIME_ZONE,
})

/** Today's Vietnam calendar day as `YYYY-MM-DD` (the latest selectable date). */
export const vietnamToday = (now = Date.now()) =>
  new Date(now + 7 * 3600000).toISOString().slice(0, 10)

/** A duration in seconds as at most two units, e.g. "2 ngày 3 giờ"; null is not available. */
export function formatDuration(t, seconds) {
  if (seconds == null) return t('moderationFormat.notAvailable')
  const total = Math.max(0, Math.round(seconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const parts = days
    ? [
        ['days', days],
        ['hours', hours],
      ]
    : hours
      ? [
          ['hours', hours],
          ['minutes', minutes],
        ]
      : [['minutes', minutes]]
  const shown = parts.filter(([, count]) => count > 0)
  if (!shown.length) return t('moderationFormat.duration.underMinute')
  return shown.map(([unit, count]) => t(`moderationFormat.duration.${unit}`, { count })).join(' ')
}

/** A MetricValue percentage; null is shown as not available. */
export const formatRate = (t, formatNumber, value) =>
  value == null
    ? t('moderationFormat.notAvailable')
    : t('moderationFormat.percent', { value: formatNumber(value) })

/** Label of a statistics bucket that starts at `start`. */
export function formatBucket(t, start, bucket) {
  const date = new Date(start)
  if (bucket === 'month') return vietnamMonthFormat.format(date)
  const day = vietnamDayFormat.format(date)
  return bucket === 'week' ? t('moderationFormat.weekOf', { date: day }) : day
}
