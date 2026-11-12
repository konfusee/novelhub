export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function notFound(req, _res, next) {
  next(new HttpError(404, 'not_found', 'Không tìm thấy đường dẫn yêu cầu.'))
}

// Express recognises error handlers by their four-argument signature.
export function errorHandler(err, req, res, _next) {
  const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500)
  if (status >= 500) req.log?.error({ err }, 'unhandled error')
  const exposed = err instanceof HttpError && status < 500
  res.status(status).json({
    error: {
      code: exposed ? err.code : status === 400 ? 'bad_request' : 'internal_error',
      message: status >= 500 ? 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.' : err.message,
      ...(exposed && err.details ? { details: err.details } : {}),
    },
  })
}
