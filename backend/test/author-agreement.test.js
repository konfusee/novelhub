import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Account, AuthorRevenueRate, PolicyVersion } from '../src/models/index.js';
import { authorAgreement } from '../src/modules/author-agreement.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const app = createApp(testConfig({ cookieName: 'novelhub_session' }));
it('restricts access and never substitutes another author for a missing account', async () => {
  const admin = await authenticatedAccount('admin');
  const reader = await authenticatedAccount('reader');
  const url = `/api/admin/authors/${reader.account._id}/agreement`;
  expect((await request(app).get(url)).status).toBe(401);
  expect((await request(app).get(url).set('Cookie', reader.cookie)).status).toBe(403);
  expect((await request(app).get(url).set('Cookie', admin.cookie)).status).toBe(404);
  expect(
    (await request(app).get('/api/admin/authors/invalid/agreement').set('Cookie', admin.cookie))
      .status,
  ).toBe(400);
});
it('uses the effective personal rate before policy and excludes future rates from current values', async () => {
  const admin = await authenticatedAccount('admin');
  const author = await authenticatedAccount('author');
  const other = await authenticatedAccount('author');
  const now = new Date('2026-10-17T12:00:00Z');
  const base = { actorAccountId: admin.account._id };
  await PolicyVersion.create({
    ...base,
    status: 'effective',
    effectiveAt: new Date('2026-01-01'),
    authorSharePercent: 65,
    platformSharePercent: 35,
  });
  await PolicyVersion.create({
    ...base,
    status: 'effective',
    effectiveAt: new Date('2027-01-01'),
    authorSharePercent: 99,
    platformSharePercent: 1,
  });
  expect(await authorAgreement(author.account.id, now)).toMatchObject({
    authorShare: 65,
    platformShare: 35,
    source: 'policy',
    history: [],
  });
  await AuthorRevenueRate.create([
    {
      ...base,
      authorAccountId: author.account._id,
      percentage: 75,
      effectiveAt: new Date('2026-02-01'),
    },
    {
      ...base,
      authorAccountId: author.account._id,
      percentage: 90,
      effectiveAt: new Date('2027-02-01'),
    },
    {
      ...base,
      authorAccountId: other.account._id,
      percentage: 10,
      effectiveAt: new Date('2026-03-01'),
    },
  ]);
  const result = await authorAgreement(author.account.id, now);
  expect(result).toMatchObject({
    author: { id: author.account.id },
    authorShare: 75,
    platformShare: 25,
    source: 'agreement',
  });
  expect(result.history.map((item) => [item.percentage, item.scheduled])).toEqual([
    [90, true],
    [75, false],
  ]);
  expect(result).not.toHaveProperty('email');
  const response = await request(app)
    .get(`/api/admin/authors/${author.account.id}/agreement`)
    .set('Cookie', admin.cookie);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
});
it('returns 70/30 without policy and supports former authors while hiding anonymized accounts', async () => {
  const author = await authenticatedAccount('author');
  expect(await authorAgreement(author.account.id)).toMatchObject({
    authorShare: 70,
    platformShare: 30,
    source: 'default',
  });
  await Account.updateOne({ _id: author.account._id }, { $set: { status: 'anonymized' } });
  await expect(authorAgreement(author.account.id)).rejects.toMatchObject({ status: 404 });
});
