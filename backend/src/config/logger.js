import pino from 'pino';

const DUPLICATE_KEY = 11000;

// Database errors echo offending values (emails, token hashes) in the message,
// stack, keyValue and errorResponse. Keep only the type, code and safe message.
export function serializeError(err) {
  const serialized = pino.stdSerializers.err(err);
  delete serialized.keyValue;
  delete serialized.errmsg;
  delete serialized.errorResponse;
  if (serialized.errors) {
    serialized.errors = Object.fromEntries(
      Object.entries(serialized.errors).map(([path, e]) => [
        path,
        { kind: e?.kind, message: e?.message },
      ]),
    );
  }
  if (err?.code === DUPLICATE_KEY) {
    serialized.message = 'Duplicate key';
    // The first stack line repeats the message; drop it, keep the frames.
    if (typeof serialized.stack === 'string') {
      serialized.stack = serialized.stack.split('\n').slice(1).join('\n');
    }
  }
  return serialized;
}

export const logSerializers = {
  err: serializeError,
  req: (req) => ({ id: req.id, method: req.method, path: String(req.url || '').split('?')[0] }),
  res: (res) => ({ statusCode: res.statusCode }),
};
export const httpLogOptions = {
  serializers: logSerializers,
  quietReqLogger: true,
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (['/api/health', '/api/ready'].includes(req.url?.split('?')[0]) && res.statusCode < 400)
      return 'silent';
    if (req.url?.split('?')[0] === '/api/auth/me' && res.statusCode === 401) return 'debug';
    return res.statusCode >= 400 ? 'warn' : 'info';
  },
  customSuccessMessage: (req, res) =>
    req.method + ' ' + String(req.url).split('?')[0] + ' → ' + res.statusCode,
  customErrorMessage: (req, res) =>
    req.method + ' ' + String(req.url).split('?')[0] + ' → ' + res.statusCode,
};

export function createLogger(
  level = 'info',
  { nodeEnv = process.env.NODE_ENV || 'development' } = {},
) {
  return pino({
    level,
    serializers: logSerializers,
    ...(nodeEnv === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: Boolean(process.stdout.isTTY),
              translateTime: 'SYS:HH:MM:ss',
              singleLine: true,
              ignore: 'pid,hostname,req,res,reqId',
            },
          },
        }
      : {}),
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.hash',
        '*.token',
      ],
      censor: '[redacted]',
    },
  });
}
