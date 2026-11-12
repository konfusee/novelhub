import { publicUser, readCookie, resolveSession } from '../auth/session.js'
import { HttpError } from './errors.js'

export function requireAuth({ cookieName }) {
  return async (req, _res, next) => {
    try {
      const resolved = await resolveSession(readCookie(req.headers.cookie, cookieName))
      if (!resolved)
        return next(new HttpError(401, 'unauthorized', 'Vui lòng đăng nhập để tiếp tục.'))
      req.auth = resolved
      req.account = resolved.account
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireRole(role) {
  return async (req, _res, next) => {
    try {
      const user = await publicUser(req.auth.account)
      if (!user.roles.includes(role)) {
        return next(new HttpError(403, 'forbidden', 'Bạn không có quyền thực hiện thao tác này.'))
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
