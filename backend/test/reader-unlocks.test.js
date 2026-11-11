import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import {
  Category,
  Chapter,
  ContentRevision,
  LedgerEntry,
  Story,
  UnlockEntitlement,
  Wallet,
} from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

import { withTransaction } from '../src/db/connection.js'
import {
  PLATFORM_OWNER_ID,
  transferUnlockCoins,
} from '../src/modules/coins-payouts/finance/unlock-wallets.js'

useTestDatabase()

const app = createApp(testConfig())

async function prepareCase(balance = 5000) {
  const reader = await authenticatedAccount()
  const author = await authenticatedAccount('author')

  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })

  const story = await Story.create({
    authorAccountId: author.account._id,
    title: 'Truyện kiểm thử',
    categoryId: category._id,
    publicationStatus: 'published',
  })

  const storyRevision = await ContentRevision.create({
    storyId: story._id,
    authorAccountId: author.account._id,
    contentType: 'story',
    revisionNumber: 1,
    status: 'approved',
    formatVersion: 'story-v1',
    content: {
      title: 'Truyện kiểm thử',
      description: 'Dữ liệu test.',
      categoryId: String(category._id),
    },
  })

  story.publishedRevisionId = storyRevision._id
  await story.save()

  const chapter = await Chapter.create({
    storyId: story._id,
    title: 'Chương kiểm thử',
    orderKey: 1,
    status: 'published',
    earlyAccess: {
      enabled: true,
      coinPrice: 1000,
      durationDays: 1,
      endsAt: new Date(Date.now() + 3600000),
    },
  })

  const chapterRevision = await ContentRevision.create({
    storyId: story._id,
    chapterId: chapter._id,
    authorAccountId: author.account._id,
    contentType: 'chapter',
    revisionNumber: 1,
    status: 'approved',
    formatVersion: 'blocks-v1',
    content: {
      title: 'Chương kiểm thử',
      blocks: [{ type: 'paragraph', text: 'Nội dung chương test.' }],
    },
  })

  chapter.publishedRevisionId = chapterRevision._id
  await chapter.save()

  const wallet = await Wallet.create({
    ownerType: 'account',
    ownerId: reader.account._id,
    purpose: 'reader-coins',
    availableBalance: balance,
  })

  return { reader, story, chapter, wallet }
}

function quotePath(story, chapter) {
  return `/api/reader/stories/${story._id}/chapters/${chapter._id}/unlock-quote`
}

function transferForTest({ reader, story }) {
  return withTransaction(session =>
    transferUnlockCoins(
      reader.account._id,
      story.authorAccountId,
      1000,
      { authorCoins: 700, platformCoins: 300 },
      session,
    ),
  )
}

it.each([5000, 500])('chưa mua thì vẫn khóa khi số dư là %i xu', async balance => {
  const { reader, story, chapter, wallet } = await prepareCase(balance)

  const response = await request(app).get(quotePath(story, chapter)).set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    state: 'locked',
    canRead: false,
    priceCoins: 1000,
    balance,
    canAfford: balance >= 1000,
  })

  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(balance)
  expect(await LedgerEntry.countDocuments()).toBe(0)
  expect(await UnlockEntitlement.countDocuments()).toBe(0)
  expect(JSON.stringify(response.body)).not.toContain('Nội dung chương test.')
})

it('có quyền mua hợp lệ thì trả owned', async () => {
  const { reader, story, chapter, wallet } = await prepareCase()

  await UnlockEntitlement.create({
    accountId: reader.account._id,
    storyId: story._id,
    chapterId: chapter._id,
    publishedRevisionId: chapter.publishedRevisionId,
    status: 'active',
    purchasedAt: new Date(),
    expiresAt: chapter.earlyAccess.endsAt,
    priceCoins: 1000,
  })

  const response = await request(app).get(quotePath(story, chapter)).set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    state: 'owned',
    canRead: true,
    priceCoins: 0,
  })

  expect((await Wallet.findById(wallet._id)).availableBalance).toBe(5000)
  expect(await UnlockEntitlement.countDocuments()).toBe(1)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('hết thời gian đọc sớm thì chương được đọc miễn phí', async () => {
  const { reader, story, chapter } = await prepareCase()

  chapter.earlyAccess.endsAt = new Date(0)
  await chapter.save()

  const response = await request(app).get(quotePath(story, chapter)).set('Cookie', reader.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({
    state: 'free',
    canRead: true,
    priceCoins: 0,
  })

  expect(await UnlockEntitlement.countDocuments()).toBe(0)
  expect(await LedgerEntry.countDocuments()).toBe(0)
})

it('chưa đăng nhập thì không lấy được báo giá cá nhân', async () => {
  const { story, chapter } = await prepareCase()

  const response = await request(app).get(quotePath(story, chapter))

  expect(response.status).toBe(401)
})

it('trừ ví người đọc và chia đúng vào ví tác giả, nền tảng', async () => {
  const data = await prepareCase()

  await transferForTest(data)

  const readerWallet = await Wallet.findById(data.wallet._id)

  const authorWallet = await Wallet.findOne({
    ownerType: 'account',
    ownerId: data.story.authorAccountId,
    purpose: 'author-earnings',
  })

  const platformWallet = await Wallet.findOne({
    ownerType: 'system',
    ownerId: PLATFORM_OWNER_ID,
    purpose: 'system-earnings',
  })

  expect(readerWallet.availableBalance).toBe(4000)
  expect(authorWallet.availableBalance).toBe(700)
  expect(platformWallet.availableBalance).toBe(300)

  expect(
    readerWallet.availableBalance + authorWallet.availableBalance + platformWallet.availableBalance,
  ).toBe(5000)
})

it('thiếu xu thì không trừ tiền và không tạo ví nhận', async () => {
  const data = await prepareCase(500)

  await expect(transferForTest(data)).rejects.toMatchObject({
    code: 'insufficient_coins',
  })

  const readerWallet = await Wallet.findById(data.wallet._id)

  expect(readerWallet.availableBalance).toBe(500)

  expect(
    await Wallet.countDocuments({
      purpose: { $in: ['author-earnings', 'system-earnings'] },
    }),
  ).toBe(0)
})

it('ví tác giả không nhận được xu thì hoàn tác cả lần chuyển', async () => {
  const data = await prepareCase()

  const authorWallet = await Wallet.create({
    ownerType: 'account',
    ownerId: data.story.authorAccountId,
    purpose: 'author-earnings',
    availableBalance: Number.MAX_SAFE_INTEGER,
  })

  await expect(transferForTest(data)).rejects.toMatchObject({
    code: 'earnings_wallet_unavailable',
  })

  const savedReader = await Wallet.findById(data.wallet._id)
  const savedAuthor = await Wallet.findById(authorWallet._id)

  expect(savedReader.availableBalance).toBe(5000)
  expect(savedAuthor.availableBalance).toBe(Number.MAX_SAFE_INTEGER)

  expect(
    await Wallet.countDocuments({
      ownerType: 'system',
      purpose: 'system-earnings',
    }),
  ).toBe(0)
})
