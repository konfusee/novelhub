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

it('saves the paragraph and resumes, restarting a chapter whose published revision changed', async () => {
  const { author, storyId } = await api.publishStory()
  const first = await api.publishChapter(author, storyId, 'Một', ['Đoạn 1.', 'Đoạn 2.', 'Đoạn 3.'])
  const reader = await authenticatedAccount()
  const saved = await save(reader, { storyId, chapterId: first, paragraph: 1, paragraphCount: 3 })
  expect(saved.status).toBe(200)
  expect(saved.body.progress).toMatchObject({
    storyId,
    chapterId: first,
    mode: 'text',
    paragraph: 1,
    audioSeconds: null,
    completed: false,
  })
  const resumeUrl = `/api/reader/progress/${storyId}`
  expect((await api.get(reader.cookie, resumeUrl)).body.resume).toMatchObject({
    chapterId: first,
    orderKey: 1,
    title: 'Một',
    paragraph: 1,
    percent: 33,
    contentUpdated: false,
    available: true,
  })
  const invalid = [
    { paragraph: 3, paragraphCount: 3 },
    { paragraph: 0.5, paragraphCount: 3 },
    { paragraph: 0, paragraphCount: 3, duration: 10 },
    { paragraph: 0, paragraphCount: 3, extra: true },
    { position: 0.5 },
  ]
  for (const body of invalid)
    expect((await save(reader, { storyId, chapterId: first, ...body })).status).toBe(400)

  await api.republishRevision(author, storyId, first, ['Bản sửa.'])
  expect((await api.get(reader.cookie, resumeUrl)).body.resume).toMatchObject({
    chapterId: first,
    paragraph: 0,
    contentUpdated: true,
    available: true,
  })
  await save(reader, { storyId, chapterId: first, paragraph: 0, paragraphCount: 1 })
  expect((await api.get(reader.cookie, resumeUrl)).body.resume).toMatchObject({
    paragraph: 0,
    contentUpdated: false,
  })

  const second = await api.publishChapter(author, storyId, 'Hai')
  await save(reader, { storyId, chapterId: second, paragraph: 0, paragraphCount: 1 })
  expect((await api.get(reader.cookie, resumeUrl)).body.resume.chapterId).toBe(second)
  expect(
    (await api.get(reader.cookie, `/api/reader/progress/${String(author.account._id)}`)).body
      .resume,
  ).toBeNull()
})

it('keeps one row per chapter for reading and listening, and resumes the latest of either', async () => {
  const { author, storyId } = await api.publishStory({ title: 'Nghe thử' })
  const first = await api.publishChapter(author, storyId, 'Một', ['A.', 'B.', 'C.', 'D.'])
  const reader = await authenticatedAccount()
  const resume = async () =>
    (await api.get(reader.cookie, `/api/reader/progress/${storyId}`)).body.resume

  await save(reader, { storyId, chapterId: first, paragraph: 1, paragraphCount: 4 })
  const listened = await save(reader, {
    storyId,
    chapterId: first,
    paragraph: 2,
    paragraphCount: 4,
    audioSeconds: 42,
    duration: 120,
  })
  expect(listened.body.progress).toMatchObject({ mode: 'audio', paragraph: 2, audioSeconds: 42 })
  expect(await ReadingProgress.countDocuments({ accountId: reader.account._id })).toBe(1)
  expect(await resume()).toMatchObject({
    chapterId: first,
    mode: 'audio',
    paragraph: 2,
    audioSeconds: 42,
    duration: 120,
    percent: 50,
  })
  const detail = (await api.get(reader.cookie, `/api/catalog/stories/${storyId}`)).body
  expect(detail.viewer.resume).toMatchObject({ chapterId: first, mode: 'audio' })

  // Reading on moves the point; the old playback second no longer applies.
  await save(reader, { storyId, chapterId: first, paragraph: 3, paragraphCount: 4 })
  expect(await resume()).toMatchObject({ mode: 'text', paragraph: 3, audioSeconds: null })
  await save(reader, {
    storyId,
    chapterId: first,
    paragraph: 3,
    paragraphCount: 4,
    completed: true,
  })
  // Completion stays when the Reader scrolls back up.
  await save(reader, { storyId, chapterId: first, paragraph: 0, paragraphCount: 4 })
  expect(await resume()).toMatchObject({ paragraph: 0, completed: true, percent: 100 })
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
  await save(reader, {
    storyId: reading.storyId,
    chapterId: readingChapter,
    paragraph: 0,
    paragraphCount: 1,
  })
  await save(reader, {
    storyId: done.storyId,
    chapterId: doneChapter,
    paragraph: 0,
    paragraphCount: 1,
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
    resume: { chapterId: readingChapter, paragraph: 0 },
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
  const at = (storyId, chapterId, extra = {}) => ({
    storyId,
    chapterId,
    paragraph: 0,
    paragraphCount: 4,
    ...extra,
  })
  await save(reader, at(storyId, first, { completed: true }))
  await save(reader, at(storyId, second, { paragraph: 1 }))
  await save(reader, at(storyId, third, { paragraph: 1, audioSeconds: 30, duration: 120 }))
  await save(reader, at(later.storyId, laterChapter))
  await save(other, at(storyId, first))

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
    paragraph: 1,
    audioSeconds: 30,
    percent: 25,
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
  })

  expect((await api.write(reader.cookie, '/api/reader/history', undefined, 'delete')).status).toBe(
    204,
  )
  expect((await history(reader)).total).toBe(0)
  expect(await ReadingProgress.countDocuments({ accountId: other.account._id })).toBe(1)
})
