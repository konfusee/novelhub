import request from 'supertest'
import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Category,
  Chapter,
  Comment,
  ContentRevision,
  Follow,
  LedgerEntry,
  Story,
  UnlockRequest,
  Wallet,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const app = createApp(
  testConfig({
    cookieName: 'novelhub_session',
  }),
)
const get = cookie => request(app).get('/api/author/dashboard').set('Cookie', cookie)
describe('author dashboard', () => {
  it('requires author role and does not fabricate metrics for an empty account', async () => {
    expect((await request(app).get('/api/author/dashboard')).status).toBe(401)
    const reader = await authenticatedAccount()
    expect((await get(reader.cookie)).status).toBe(403)
    const author = await authenticatedAccount('author')
    expect((await get(author.cookie)).body).toMatchObject({
      stories: [],
      drafts: [],
      feedback: [],
      stats: {
        views: 0,
        followers: 0,
        audioPlays: null,
      },
      draftWords: 0,
      writingGoal: null,
      ai: null,
    })
  })
  it('scopes story/draft/feedback/balance data and counts each follower once across owned works', async () => {
    const author = await authenticatedAccount('author')
    const other = await authenticatedAccount('author')
    const reader = await authenticatedAccount()
    const category = await Category.create({
      name: 'Kỳ ảo',
      normalizedName: 'kỳ ảo',
      createdBy: author.account._id,
    })
    const first = await Story.create({
      title: 'Truyện của tôi',
      authorAccountId: author.account._id,
      categoryId: category._id,
    })
    const second = await Story.create({
      title: 'Truyện thứ hai',
      authorAccountId: author.account._id,
      categoryId: category._id,
    })
    const privateStory = await Story.create({
      title: 'OTHER PRIVATE',
      authorAccountId: other.account._id,
      categoryId: category._id,
    })
    for (const story of [first, second])
      await Follow.create({
        accountId: reader.account._id,
        storyId: story._id,
      })
    const chapter = await Chapter.create({
      storyId: first._id,
      title: 'Chương nháp',
      orderKey: 7,
    })
    const revision = await ContentRevision.create({
      storyId: first._id,
      chapterId: chapter._id,
      authorAccountId: author.account._id,
      contentType: 'chapter',
      revisionNumber: 1,
      formatVersion: 'blocks-v1',
      content: {
        title: 'Bản nháp hiện tại',
        blocks: [
          {
            type: 'paragraph',
            text: 'Một hai ba',
          },
        ],
      },
    })
    chapter.draftRevisionId = revision._id
    await chapter.save()
    await Comment.create({
      targetType: 'story',
      targetId: first._id,
      authorAccountId: reader.account._id,
      body: 'Nhận xét của độc giả',
    })
    await Comment.create({
      targetType: 'story',
      targetId: privateStory._id,
      authorAccountId: reader.account._id,
      body: 'OTHER COMMENT',
    })
    await Wallet.create({
      ownerType: 'account',
      ownerId: author.account._id,
      purpose: 'author-earnings',
      availableBalance: '12345',
    })
    await Wallet.create({
      ownerType: 'account',
      ownerId: other.account._id,
      purpose: 'author-earnings',
      availableBalance: '999999',
    })
    const result = (await get(author.cookie)).body
    expect(result.stats).toMatchObject({
      followers: 1,
    })
    expect(result.stories).toHaveLength(2)
    expect(result.drafts[0]).toMatchObject({
      id: String(first._id),
      chapterId: String(chapter._id),
      chapter: 'Bản nháp hiện tại',
      written: 3,
    })
    expect(result.draftWords).toBe(3)
    expect(result.feedback[0]).toMatchObject({
      body: 'Nhận xét của độc giả',
      canReply: false,
    })
    expect(JSON.stringify(result)).not.toContain('OTHER')
    expect(JSON.stringify(result)).not.toContain('999999')
    expect(JSON.stringify(result)).not.toContain(reader.account.email)
    await Story.updateOne(
      {
        _id: first._id,
      },
      {
        $set: {
          authoringFrozen: true,
        },
      },
    )
    expect((await get(author.cookie)).body.drafts).toEqual([])
  })

  it('uses the author earnings ledger for today and selected dashboard revenue', async () => {
    const author = await authenticatedAccount('author')
    const category = await Category.create({
      name: 'Doanh thu',
      normalizedName: `doanh thu ${crypto.randomUUID()}`,
      createdBy: author.account._id,
    })
    const story = await Story.create({
      title: 'Truyện có doanh thu',
      authorAccountId: author.account._id,
      categoryId: category._id,
      publicationStatus: 'published',
      publishedAt: new Date('2026-11-13T01:00:00Z'),
    })
    const chapter = await Chapter.create({
      storyId: story._id,
      title: 'Chương có doanh thu',
      orderKey: 1,
      status: 'published',
      publishedAt: new Date('2026-11-13T01:00:00Z'),
    })
    const wallet = await Wallet.create({
      ownerType: 'account',
      ownerId: author.account._id,
      purpose: 'author-earnings',
      availableBalance: 280,
    })
    const requestId = new mongoose.Types.ObjectId()
    await UnlockRequest.create({
      _id: requestId,
      accountId: new mongoose.Types.ObjectId(),
      chapterId: chapter._id,
      requestedPriceCoins: 280,
      effectivePriceCoins: 280,
      idempotencyScope: {
        operation: 'dashboard-test',
        ownerId: author.account._id,
        key: String(requestId),
      },
      status: 'committed',
    })
    await LedgerEntry.create({
      walletId: wallet._id,
      ledgerType: 'allocation-credit',
      direction: 'credit',
      amount: 280,
      actorAccountId: author.account._id,
      sourceType: 'UnlockRequest',
      sourceId: requestId,
      idempotencyScope: {
        operation: 'dashboard-test',
        ownerId: author.account._id,
        key: String(requestId),
      },
      occurredAt: new Date('2026-11-13T03:00:00Z'),
    })

    const result = (
      await request(app).get('/api/author/dashboard?days=1').set('Cookie', author.cookie)
    ).body
    expect(result.revenue.today).toBe(280)
    expect(result.revenue.selected).toBe(280)
    expect(result.stats.periodEarnings).toBe(280)
    expect(result.storyRankings[0]).toMatchObject({ earnings: 280, unlocks: 1 })
  })
})
