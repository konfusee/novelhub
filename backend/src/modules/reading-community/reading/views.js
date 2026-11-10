import { createHash, randomBytes } from 'node:crypto'
import { readCookie } from '../../../auth/session.js'
import { StatisticsEvent } from '../../../models/index.js'

export const DEVICE_COOKIE = 'novelhub_device'
const DEVICE_ID = /^[A-Za-z0-9_-]{32,64}$/
const YEAR_MS = 365 * 86400000

export const readingDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date)

/** Guest device id from the httpOnly cookie, issuing a fresh one when absent or malformed. */
function guestDevice(req, res, config) {
  const current = readCookie(req.headers.cookie, DEVICE_COOKIE)
  if (current && DEVICE_ID.test(current)) return current
  const issued = randomBytes(24).toString('base64url')
  res.cookie(DEVICE_COOKIE, issued, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: YEAR_MS,
  })
  return issued
}

/**
 * Records one unique daily view of a chapter whose text is being served. Accounts are
 * keyed by id; Guests by a sha256 of their device cookie. Same-day repeats are ignored,
 * and a recording failure never fails the read.
 */
export async function recordChapterView({ req, res, config, account, chapter, now = new Date() }) {
  const viewerType = account ? 'account' : 'guest-device'
  let viewerKey
  try {
    viewerKey = account
      ? String(account._id)
      : createHash('sha256')
          .update(guestDevice(req, res, config))
          .digest('hex')
    const day = readingDay(now)
    await StatisticsEvent.create({
      sourceEventKey: `view:${chapter._id}:${day}:${viewerType}:${viewerKey}`,
      eventType: 'view',
      day,
      viewerType,
      viewerKey,
      storyId: chapter.storyId,
      chapterId: chapter._id,
      occurredAt: now,
    })
  } catch (error) {
    if (error?.code === 11000) return
    req.log?.warn({ err: error, chapterId: String(chapter._id) }, 'chapter view not recorded')
  }
}
