import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Follow, ReadingProgress } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { readingClient, origin } from './fixtures/reading.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = readingClient(app)
const save = (reader, body) => api.write(reader.cookie, '/api/reader/progress', body, 'put')

it('saves progress and resumes, restarting a chapter whose published revision changed', async () => {
  const { author, storyId } = await api.publishStory()
  const first = await api.publishChapter(author, storyId, 'Một', ['Bản đầu.'])
  const reader = await authenticatedAccount()
  const saved = await save(reader, { storyId, chapterId: first, position: 0.6 })
  expect(saved.status).toBe(200)
  expect(saved.body.progress).toMatchObject({
    storyId,
    chapterId: first,
    position: 0.6,
    completed: false,
  })
  const resumeUrl = `/api/reader/progress/${storyId}`
  expect((await api.get(reader.cookie, resumeUrl)).body.resume).toMatchObject({
    chapterId: first,
    orderKey: 1,
    title: 'Một',
    position: 0.6,
    contentUpdated: false,
    available: true,
  })
  expect((await save(reader, { storyId, chapterId: first, position: 2 })).status).toBe(400)
  expect(
    (await save(reader, { storyId, chapterId: first, position: 0.1, extra: true })).status,
  ).toBe(400)

  await api.republishRevision(author, storyId, first, ['Bản sửa.'])
  expect((await api.get(reader.cookie, resumeUrl)).body.resume).toMatchObject({
    chapterId: first,
    position: 0,
    contentUpdated: true,
    available: true,
  })
  await save(reader, { storyId, chapterId: first, position: 0.3 })
  expect((await api.get(reader.cookie, resumeUrl)).body.resume).toMatchObject({
    position: 0.3,
    contentUpdated: false,
  })

  const second = await api.publishChapter(author, storyId, 'Hai')
  await save(reader, { storyId, chapterId: second, position: 0.2 })
  expect((await api.get(reader.cookie, resumeUrl)).body.resume.chapterId).toBe(second)
  expect(
    (await api.get(reader.cookie, `/api/reader/progress/${String(author.account._id)}`)).body
      .resume,
  ).toBeNull()
})

it('builds library tabs and counts across following, reading and completed stories', async () => {
  const reader = await authenticatedAccount()
  const followed = await api.publishStory({ title: 'Theo dõi' })
  await api.publishChapter(followed.author, followed.storyId, 'Một')
  const reading = await api.publishStory({ title: 'Đang đọc' })
  const readingChapter = await api.publishChapter(reading.author, reading.storyId, 'Một')
  await api.publishChapter(reading.author, reading.storyId, 'Hai')
  const done = await api.publishStory({ title: 'Đọc xong' })
  const doneChapter = await api.publishChapter(done.author, done.storyId, 'Một')

  await Follow.create({ accountId: reader.account._id, storyId: followed.storyId })
  await save(reader, { storyId: reading.storyId, chapterId: readingChapter, position: 0.5 })
  await save(reader, {
    storyId: done.storyId,
    chapterId: doneChapter,
    position: 1,
    completed: true,
  })
  await api.publishChapter(followed.author, followed.storyId, 'Hai')

  const library = async tab => (await api.get(reader.cookie, `/api/reader/library?tab=${tab}`)).body
  const all = await library('all')
  expect(all.counts).toEqual({ all: 3, reading: 1, following: 1, completed: 1 })
  expect(all.total).toBe(3)
  const byTitle = Object.fromEntries(all.items.map(item => [item.story.title, item]))
  expect(byTitle['Theo dõi']).toMatchObject({
    following: true,
    resume: null,
    chaptersRead: 0,
    totalChapters: 2,
    completed: false,
    newChapters: 1,
  })
  expect(byTitle['Đang đọc']).toMatchObject({
    following: false,
    chaptersRead: 1,
    totalChapters: 2,
    completed: false,
    resume: { chapterId: readingChapter, position: 0.5 },
  })
  expect(byTitle['Đọc xong']).toMatchObject({ completed: true, chaptersRead: 1, totalChapters: 1 })
  expect((await library('reading')).items.map(item => item.story.title)).toEqual(['Đang đọc'])
  expect((await library('following')).items.map(item => item.story.title)).toEqual(['Theo dõi'])
  expect((await library('completed')).items.map(item => item.story.title)).toEqual(['Đọc xong'])
  expect((await api.get(reader.cookie, '/api/reader/library?tab=bogus')).status).toBe(400)

  await api.publishChapter(done.author, done.storyId, 'Hai')
  expect((await library('completed')).total).toBe(0)
  expect((await library('reading')).total).toBe(2)
})

it('keeps one history entry per story and deletes all of that story’s saved progress', async () => {
  const { author, storyId } = await api.publishStory({ title: 'Lịch sử' })
  const first = await api.publishChapter(author, storyId, 'Một')
  const second = await api.publishChapter(author, storyId, 'Hai')
  const third = await api.publishChapter(author, storyId, 'Ba')
  const later = await api.publishStory({ title: 'Truyện sau' })
  const laterChapter = await api.publishChapter(later.author, later.storyId, 'Mở đầu')
  const reader = await authenticatedAccount()
  const other = await authenticatedAccount()
  await Follow.create({ accountId: reader.account._id, storyId })
  await save(reader, { storyId, chapterId: first, position: 1, completed: true })
  await save(reader, { storyId, chapterId: second, position: 0.4 })
  await save(reader, { storyId, chapterId: third, mode: 'audio', position: 30, duration: 120 })
  await save(reader, { storyId: later.storyId, chapterId: laterChapter, position: 0.2 })
  await save(other, { storyId, chapterId: first, position: 0.2 })

  const history = async account => (await api.get(account.cookie, '/api/reader/history')).body
  const listed = await history(reader)
  expect(listed.total).toBe(2)
  expect(listed.items.map(item => [item.id, item.story.title])).toEqual([
    [later.storyId, 'Truyện sau'],
    [storyId, 'Lịch sử'],
  ])
  expect(listed.items[1]).toMatchObject({
    chapter: { id: third, orderKey: 3, available: true },
    mode: 'audio',
    position: 30,
    fraction: 0.25,
  })

  const remove = (account, id) =>
    api.write(account.cookie, `/api/reader/history/${id}`, undefined, 'delete')
  const stranger = await authenticatedAccount()
  expect((await remove(stranger, storyId)).status).toBe(404)
  expect((await remove(reader, storyId)).status).toBe(204)
  expect((await history(reader)).items.map(item => item.id)).toEqual([later.storyId])
  expect(await ReadingProgress.countDocuments({ accountId: reader.account._id, storyId })).toBe(0)
  const library = (await api.get(reader.cookie, '/api/reader/library?tab=reading')).body
  expect(library.items.map(item => item.story.id)).toEqual([later.storyId])
  expect((await api.get(reader.cookie, `/api/reader/progress/${storyId}`)).body).toEqual({
    resume: null,
    listen: null,
  })

  expect((await api.write(reader.cookie, '/api/reader/history', undefined, 'delete')).status).toBe(
    204,
  )
  expect((await history(reader)).total).toBe(0)
  expect(await ReadingProgress.countDocuments({ accountId: other.account._id })).toBe(1)
})
