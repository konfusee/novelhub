import { HttpError } from './errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function csrfProtection({ corsOrigin, cookieName }) {
  const allowedOrigins = new Set(corsOrigin.split(',').map(origin => origin.trim()))
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next()
    const hasSessionCookie = String(req.headers.cookie ?? '')
      .split(';')
      .some(value => value.trim().startsWith(`${cookieName}=`))
    if (!hasSessionCookie) return next()
    const origin = req.get('origin')
    if (!origin || !allowedOrigins.has(origin)) {
      return next(new HttpError(403, 'csrf_rejected', 'Nguồn yêu cầu không được phép.'))
    }
    next()
  }
}
