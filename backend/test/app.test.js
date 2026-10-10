import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

const app = createApp({ corsOrigin: 'http://localhost:5173' });

describe('HTTP app', () => {
  it('reports liveness', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('reports not-ready while the database is disconnected', async () => {
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not-ready', database: 'disconnected' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('returns 400 for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_request');
  });
});

describe('loadEnv', () => {
  it('fails fast and names the missing key', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/);
  });

  it('applies defaults', () => {
    const env = loadEnv({ MONGODB_URI: 'mongodb://x' });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });
});
