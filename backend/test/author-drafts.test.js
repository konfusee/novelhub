import request from 'supertest'
import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Category, Story, ContentRevision } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'
useTestDatabase()
const origin = 'http://localhost:5173'
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const write = (path, cookie, body, method = 'post') =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body)
it('projects only current editable owner chapter drafts and their actual revision history', async () => {
  const author = await authenticatedAccount('author')
  const other = await authenticatedAccount('author')
  const reader = await authenticatedAccount()
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const create = async (cookie, title) => {
    const story = await write('/api/author/stories', cookie, {
      title,
      description: 'Tóm tắt',
      categoryIds: [String(category._id)],
    })
    const chapter = await write(`/api/author/stories/${story.body.story.id}/chapters`, cookie, {
      title: 'Chương của chủ sở hữu',
      paragraphs: ['Một hai ba'],
    })
    return { story: story.body.story, chapter: chapter.body.chapter }
  }
  const own = await create(author.cookie, 'Truyện của tôi')
  await create(other.cookie, 'Không thuộc tôi')
  const get = () => request(app).get('/api/author/drafts').set('Cookie', author.cookie)
  let result = await get()
  expect(result.status).toBe(200)
  expect(result.body.items).toHaveLength(1)
  expect(result.body.items[0]).toMatchObject({
    id: own.chapter.id,
    storyId: own.story.id,
    title: 'Chương của chủ sở hữu',
    words: 3,
    excerpt: 'Một hai ba',
  })
  expect(result.body.stories).toEqual([{ id: own.story.id, title: 'Truyện của tôi' }])
  const edited = await write(
    `/api/author/stories/${own.story.id}/chapters/${own.chapter.id}`,
    author.cookie,
    { title: 'Tên mới', paragraphs: ['Một hai ba bốn'], expectedVersion: own.chapter.version },
    'put',
  )
  expect(edited.status).toBe(200)
  result = await get()
  expect(result.body.items[0]).toMatchObject({ title: 'Tên mới', words: 4 })
  expect(result.body.history.map(item => item.number)).toEqual([2, 1])
  expect(result.body.history[0]).toMatchObject({
    storyId: own.story.id,
    chapterId: own.chapter.id,
    title: 'Tên mới',
  })
  expect((await request(app).get('/api/author/drafts').set('Cookie', reader.cookie)).status).toBe(
    403,
  )
  const story = await Story.findById(own.story.id)
  story.authoringFrozen = true
  await story.save()
  expect((await get()).body.items).toEqual([])
  story.authoringFrozen = false
  await story.save()
  const revision = await ContentRevision.findOne({ chapterId: own.chapter.id, revisionNumber: 2 })
  revision.status = 'submitted'
  await revision.save()
  expect((await get()).body.items).toEqual([])
})
