import { Writable } from 'node:stream';
import express from 'express';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { logSerializers } from '../src/config/logger.js';
import { errorHandler } from '../src/middleware/errors.js';

function duplicateKeyError() {
  const err = new Error('E11000 duplicate key error dup key: { normalizedEmail: "leak@x.vn" }');
  err.code = 11000;
  err.keyValue = { normalizedEmail: 'leak@x.vn' };
  err.errorResponse = { errmsg: err.message };
  return err;
}

describe('error logging', () => {
  it('never writes duplicate-key values through the request logger', async () => {
    const lines = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ serializers: logSerializers }, sink);
    const app = express();
    app.use(pinoHttp({ logger, serializers: logSerializers }));
    app.get('/boom', () => {
      throw duplicateKeyError();
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal_error');
    const output = lines.join('');
    expect(output).toContain('Duplicate key');
    expect(output).not.toContain('leak@x.vn');
  });
});
