import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Chapter, NarrationAsset } from '../src/models/index.js'
import {
  createTtsProvider,
  TtsProviderError,
} from '../src/modules/reading-community/narration/tts-provider.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { readingClient, origin } from './fixtures/reading.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

// Scripted provider: each job answers polls from its own queue of results.
const provider = {
  name: 'fake',
  voiceId: 'fake-voice',
  maxCharacters: 2000,
  pollIntervalMs: 0,
  submits: [],
  script: new Map(),
  async submit({ text, callbackUrl }) {
    const jobId = `job-${this.submits.length + 1}`
    this.submits.push({ jobId, text, callbackUrl })
    return { jobId }
  },
  async poll(jobId) {
    const queue = this.script.get(jobId) ?? []
    return queue.length > 1 ? queue.shift() : (queue[0] ?? { state: 'processing' })
  },
  async download(audioUrl) {
    return [Buffer.from('mp3:'), Buffer.from(audioUrl)]
  },
}
// Cost guards are off unless a test turns them on.
const tts = { ...testConfig().tts, requestCooldownSeconds: 0, dailyCharacterLimit: 0 }
const base = { cookieName: 'novelhub_session', corsOrigin: origin, tts }
let root, app, api
beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'novelhub-narration-test-'))
  app = createApp(
    testConfig({
      ...base,
      mediaStorageDir: root,
      ttsProvider: provider,
    }),
  )
  api = readingClient(app)
})
afterAll(async () => {
  if (root && path.basename(root).startsWith('novelhub-narration-test-'))
    await rm(root, { recursive: true, force: true })
})
beforeEach(() => {
  provider.submits = []
  provider.script = new Map()
})

const url = (storyId, chapterId) => `/api/reader/narration/${storyId}/${chapterId}`
const play = (reader, storyId, chapterId) => api.write(reader.cookie, url(storyId, chapterId), {})
const status = (reader, storyId, chapterId) => api.get(reader.cookie, url(storyId, chapterId))

it('generates narration on first play, caches it per revision and serves it with ranges', async () => {
  const { author, storyId } = await api.publishStory()
  const chapterId = await api.publishChapter(author, storyId, 'Mở đầu', ['Câu một.', 'Câu hai.'])
  const reader = await authenticatedAccount()

  expect((await api.get(null, url(storyId, chapterId))).status).toBe(401)
  expect((await status(reader, storyId, chapterId)).body.narration).toMatchObject({
    status: 'none',
    audioUrl: null,
  })

  const [first, second] = await Promise.all([
    play(reader, storyId, chapterId),
    play(reader, storyId, chapterId),
  ])
  expect([first.status, second.status]).toEqual([202, 202])
  expect(first.body.narration.status).toBe('processing')
  expect(provider.submits).toHaveLength(1)
  expect(provider.submits[0]).toMatchObject({
    text: 'Mở đầu\nCâu một.\nCâu hai.',
    callbackUrl: 'http://localhost:5173/api/tts/vbee/callback',
  })

  provider.script.set('job-1', [
    { state: 'processing' },
    { state: 'completed', audioUrl: 'https://cdn/1.mp3' },
  ])
  expect((await status(reader, storyId, chapterId)).body.narration.status).toBe('processing')
  const ready = (await status(reader, storyId, chapterId)).body.narration
  expect(ready).toMatchObject({
    status: 'available',
    audioUrl: `/reader/narration/${storyId}/${chapterId}/audio`,
    failure: null,
  })
  const asset = await NarrationAsset.findOne({ chapterId }).select('+audioReference').lean()
  expect(await readFile(path.join(root, asset.audioReference), 'utf8')).toBe(
    'mp3:https://cdn/1.mp3',
  )

  const audio = await request(app)
    .get(`/api${ready.audioUrl}`)
    .set('Cookie', reader.cookie)
    .set('Range', 'bytes=0-3')
  expect(audio.status).toBe(206)
  expect(audio.headers['content-type']).toBe('audio/mpeg')
  expect(audio.body.toString()).toBe('mp3:')

  // Another Reader reuses the cached audio without a new provider job.
  const other = await authenticatedAccount()
  expect((await play(other, storyId, chapterId)).status).toBe(200)
  expect(provider.submits).toHaveLength(1)

  // A new published revision needs its own narration.
  await api.republishRevision(author, storyId, chapterId, ['Bản sửa.'])
  expect((await status(reader, storyId, chapterId)).body.narration.status).toBe('none')
  expect(
    (await request(app).get(`/api${ready.audioUrl}`).set('Cookie', reader.cookie)).status,
  ).toBe(404)
  await play(reader, storyId, chapterId)
  expect(provider.submits.map(item => item.text)).toEqual([
    'Mở đầu\nCâu một.\nCâu hai.',
    'Mở đầu\nBản sửa.',
  ])
  // Once the new revision's audio is stored, the superseded file is deleted.
  provider.script.set('job-2', [{ state: 'completed', audioUrl: 'https://cdn/2.mp3' }])
  expect((await status(reader, storyId, chapterId)).body.narration.status).toBe('available')
  await expect(access(path.join(root, asset.audioReference))).rejects.toMatchObject({
    code: 'ENOENT',
  })
  expect(await NarrationAsset.findById(asset._id).lean()).toMatchObject({
    status: 'failed',
    failureCode: 'superseded',
  })
})

it('checks text access before generating or serving audio', async () => {
  const { author, storyId } = await api.publishStory()
  await api.publishChapter(author, storyId, 'Một')
  const locked = await api.publishChapter(author, storyId, 'Hai')
  await Chapter.updateOne(
    { _id: locked },
    { $set: { earlyAccess: { enabled: true, endsAt: new Date(Date.now() + 86400000) } } },
  )
  const reader = await authenticatedAccount()
  const denied = await play(reader, storyId, locked)
  expect(denied.status).toBe(403)
  expect(denied.body.error.code).toBe('chapter_locked')
  expect((await status(reader, storyId, locked)).status).toBe(403)
  expect(
    (
      await request(app)
        .get(`${url(storyId, locked)}/audio`)
        .set('Cookie', reader.cookie)
    ).status,
  ).toBe(403)
  expect(provider.submits).toHaveLength(0)
  expect(await NarrationAsset.countDocuments({ chapterId: locked })).toBe(0)
})

it('records failures with a retry and reports an unconfigured provider', async () => {
  const { author, storyId } = await api.publishStory()
  const chapterId = await api.publishChapter(author, storyId, 'Một')
  const reader = await authenticatedAccount()
  await play(reader, storyId, chapterId)
  provider.script.set('job-1', [{ state: 'failed', code: 'provider_failed' }])
  const failed = (await status(reader, storyId, chapterId)).body.narration
  expect(failed).toMatchObject({
    status: 'failed',
    audioUrl: null,
    failure: { code: 'provider_failed', retryable: true },
  })
  expect(failed.failure.message).toBeTruthy()

  const retried = await play(reader, storyId, chapterId)
  expect(retried.body.narration.status).toBe('processing')
  expect(provider.submits.map(item => item.jobId)).toEqual(['job-1', 'job-2'])
  provider.script.set('job-2', [{ state: 'completed', audioUrl: 'https://cdn/2.mp3' }])
  // The provider callback only triggers a poll with our own credentials.
  const callback = await request(app)
    .post('/api/tts/vbee/callback')
    .send({ requestId: 'job-2', status: 'SUCCESS', audioLink: 'https://evil/x.mp3' })
  expect(callback.status).toBe(204)
  const asset = await NarrationAsset.findOne({ chapterId }).select('+audioReference').lean()
  expect(asset).toMatchObject({ status: 'available', attempts: 2 })
  expect(await readFile(path.join(root, asset.audioReference), 'utf8')).toBe(
    'mp3:https://cdn/2.mp3',
  )

  const submitFails = {
    ...provider,
    submit: async () => {
      throw new TtsProviderError('provider_rejected', false)
    },
  }
  const other = await api.publishChapter(author, storyId, 'Hai')
  const rejecting = readingClient(
    createApp(testConfig({ ...base, mediaStorageDir: root, ttsProvider: submitFails })),
  )
  const rejected = (await rejecting.write(reader.cookie, url(storyId, other), {})).body.narration
  expect(rejected.failure).toMatchObject({ code: 'provider_rejected', retryable: false })

  const disabled = readingClient(createApp(testConfig({ ...base, ttsProvider: null })))
  const unavailable = await disabled.write(reader.cookie, url(storyId, chapterId), {})
  expect(unavailable.status).toBe(503)
})

it('caps provider attempts and refuses to resubmit permanent failures', async () => {
  const { author, storyId } = await api.publishStory()
  const chapterId = await api.publishChapter(author, storyId, 'Một')
  const reader = await authenticatedAccount()
  for (const attempt of [1, 2, 3]) {
    await play(reader, storyId, chapterId)
    provider.script.set(`job-${attempt}`, [{ state: 'failed', code: 'provider_failed' }])
    await status(reader, storyId, chapterId)
  }
  const exhausted = (await status(reader, storyId, chapterId)).body.narration
  expect(exhausted.failure).toMatchObject({ code: 'provider_failed', retryable: false })
  expect(exhausted.failure.message).toContain('3 lần')
  expect((await play(reader, storyId, chapterId)).body.narration.status).toBe('failed')
  expect(provider.submits).toHaveLength(3)

  // A failure the provider marks permanent is never submitted again.
  const other = await api.publishChapter(author, storyId, 'Hai')
  await play(reader, storyId, other)
  await NarrationAsset.updateOne(
    { chapterId: other },
    { $set: { status: 'failed', failureCode: 'provider_rejected', retryable: false } },
  )
  expect((await play(reader, storyId, other)).body.narration.failure.retryable).toBe(false)
  expect(provider.submits).toHaveLength(4)
})

it('limits new provider jobs per account and per day', async () => {
  const { author, storyId } = await api.publishStory()
  const first = await api.publishChapter(author, storyId, 'Một', ['Một câu ngắn.'])
  const second = await api.publishChapter(author, storyId, 'Hai', ['Một câu ngắn khác.'])
  const reader = await authenticatedAccount()
  const cooled = readingClient(
    createApp(
      testConfig({
        ...base,
        mediaStorageDir: root,
        ttsProvider: provider,
        tts: { ...tts, requestCooldownSeconds: 60 },
      }),
    ),
  )
  expect((await cooled.write(reader.cookie, url(storyId, first), {})).status).toBe(202)
  const throttled = await cooled.write(reader.cookie, url(storyId, second), {})
  expect(throttled.status).toBe(429)
  expect(throttled.body.error.code).toBe('narration_cooldown')
  // Playing a job that already exists is not a new job.
  expect((await cooled.write(reader.cookie, url(storyId, first), {})).status).toBe(202)
  // Another account is not affected by this reader's cooldown.
  const other = await authenticatedAccount()
  expect((await cooled.write(other.cookie, url(storyId, second), {})).status).toBe(202)
  expect(provider.submits).toHaveLength(2)

  const third = await api.publishChapter(author, storyId, 'Ba', ['Câu thứ ba.'])
  const budgeted = readingClient(
    createApp(
      testConfig({
        ...base,
        mediaStorageDir: root,
        ttsProvider: provider,
        tts: { ...tts, dailyCharacterLimit: provider.submits[0].text.length + 5 },
      }),
    ),
  )
  const overBudget = await budgeted.write(reader.cookie, url(storyId, third), {})
  expect(overBudget.status).toBe(429)
  expect(overBudget.body.error.code).toBe('tts_daily_limit')
  expect(provider.submits).toHaveLength(2)
})

it('turns a narration whose file disappeared into a retryable failure', async () => {
  const { author, storyId } = await api.publishStory()
  const chapterId = await api.publishChapter(author, storyId, 'Một')
  const reader = await authenticatedAccount()
  await play(reader, storyId, chapterId)
  provider.script.set('job-1', [{ state: 'completed', audioUrl: 'https://cdn/1.mp3' }])
  expect((await status(reader, storyId, chapterId)).body.narration.status).toBe('available')
  const asset = await NarrationAsset.findOne({ chapterId }).select('+audioReference').lean()
  await rm(path.join(root, asset.audioReference))

  const audio = await request(app)
    .get(`${url(storyId, chapterId)}/audio`)
    .set('Cookie', reader.cookie)
  expect(audio.status).toBe(404)
  expect((await status(reader, storyId, chapterId)).body.narration.failure).toMatchObject({
    code: 'audio_missing',
    retryable: true,
  })
  expect((await play(reader, storyId, chapterId)).body.narration.status).toBe('processing')
  expect(provider.submits).toHaveLength(2)
})

it('keeps listening progress separate from reading progress', async () => {
  const { author, storyId } = await api.publishStory({ title: 'Nghe thử' })
  const first = await api.publishChapter(author, storyId, 'Một')
  const second = await api.publishChapter(author, storyId, 'Hai')
  const reader = await authenticatedAccount()
  const save = body => api.write(reader.cookie, '/api/reader/progress', body, 'put')

  expect((await save({ storyId, chapterId: first, position: 0.4 })).body.progress).toMatchObject({
    mode: 'text',
    position: 0.4,
  })
  const listened = await save({
    storyId,
    chapterId: second,
    mode: 'audio',
    position: 42,
    duration: 120,
  })
  expect(listened.body.progress).toMatchObject({ mode: 'audio', position: 42, duration: 120 })
  expect((await save({ storyId, chapterId: second, mode: 'audio', position: 90000 })).status).toBe(
    400,
  )
  expect((await save({ storyId, chapterId: second, mode: 'text', position: 42 })).status).toBe(400)
  expect((await save({ storyId, chapterId: first, position: 0.1, duration: 3 })).status).toBe(400)

  const resume = (await api.get(reader.cookie, `/api/reader/progress/${storyId}`)).body
  expect(resume.resume).toMatchObject({ chapterId: first, mode: 'text', position: 0.4 })
  expect(resume.listen).toMatchObject({
    chapterId: second,
    mode: 'audio',
    position: 42,
    duration: 120,
    fraction: 0.35,
  })
  const detail = (await api.get(reader.cookie, `/api/catalog/stories/${storyId}`)).body
  expect(detail.viewer.resume.chapterId).toBe(first)
  expect(detail.viewer.listenResume.chapterId).toBe(second)

  await save({ storyId, chapterId: second, mode: 'audio', position: 120, completed: true })
  const library = (await api.get(reader.cookie, '/api/reader/library')).body.items[0]
  expect(library).toMatchObject({ chaptersRead: 2, totalChapters: 2, completed: false })
  expect(library.listenResume.chapterId).toBe(second)

  const history = (await api.get(reader.cookie, '/api/reader/history')).body.items
  expect(history.map(item => [item.chapter.id, item.mode, item.completed])).toEqual([
    [second, 'audio', true],
  ])
})

it('talks to Vbee with App-Id and bearer token and maps request states', async () => {
  const calls = []
  const replies = [
    { ok: true, status: 200, json: { requestId: 'r1', status: 'PROCESSING' } },
    { ok: true, status: 200, json: { requestId: 'r1', status: 'PROCESSING' } },
    {
      ok: true,
      status: 200,
      json: { requestId: 'r1', status: 'COMPLETED', audioLink: 'https://a/b.mp3' },
    },
    { ok: false, status: 401, json: { error: { code: 'UNAUTHORIZED', message: 'x' } } },
  ]
  const fetchImpl = async (target, init) => {
    calls.push({ target, init })
    if (target === 'https://a/b.mp3') return new Response('mp3-bytes')
    const reply = replies.shift()
    return { ok: reply.ok, status: reply.status, json: async () => reply.json }
  }
  const vbee = createTtsProvider(
    {
      tts: {
        vbee: { appId: 'app', token: 'tok', apiUrl: 'https://api.vbee.vn/v1', timeoutMs: 1000 },
        voiceCode: 'voice-1',
      },
    },
    fetchImpl,
  )
  expect(vbee).toMatchObject({ name: 'vbee', voiceId: 'voice-1' })
  expect(await vbee.submit({ text: 'Xin chào', callbackUrl: 'https://cb' })).toEqual({
    jobId: 'r1',
  })
  expect(calls[0].target).toBe('https://api.vbee.vn/v1/tts')
  expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer tok', 'App-Id': 'app' })
  expect(JSON.parse(calls[0].init.body)).toMatchObject({
    text: 'Xin chào',
    voiceCode: 'voice-1',
    mode: 'async',
    outputFormat: 'mp3',
    webhookUrl: 'https://cb',
  })
  expect(await vbee.poll('r1')).toEqual({ state: 'processing' })
  expect(calls[1].target).toBe('https://api.vbee.vn/v1/tts/requests/r1')
  expect(await vbee.poll('r1')).toEqual({ state: 'completed', audioUrl: 'https://a/b.mp3' })
  const chunks = []
  for await (const chunk of await vbee.download('https://a/b.mp3')) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString()).toBe('mp3-bytes')
  await expect(vbee.poll('r1')).rejects.toMatchObject({
    code: 'provider_unauthorized',
    retryable: true,
  })
  expect(createTtsProvider({ tts: { voiceCode: 'voice-1' } })).toBeNull()
})
