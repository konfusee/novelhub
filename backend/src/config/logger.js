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

export const logSerializers = { err: serializeError };

export function createLogger(level = 'info') {
  return pino({
    level,
    serializers: logSerializers,
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
