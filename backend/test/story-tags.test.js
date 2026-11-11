import { expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Category, ContentRevision, Story } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { apiClient, claim, decide, markEvidenceReady, origin } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const api = apiClient(createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin })))
const tagError = {
  code: 'invalid_tags',
  message:
    'Thẻ dài 2–30 ký tự, chỉ gồm chữ, số, gạch nối hoặc gạch dưới; tối đa 10 thẻ, không trùng nhau.',
}

async function setup() {
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const create = body =>
    api.write(author.cookie, '/api/author/stories', {
      title: 'Truyện có thẻ',
      description: 'Tóm tắt truyện có thẻ.',
      categoryId: String(category._id),
      ...body,
    })
  const update = async (storyId, body) => {
    const { version } = await Story.findById(storyId)
    return api.write(
      author.cookie,
      `/api/author/stories/${storyId}`,
      {
        title: 'Truyện có thẻ',
        description: 'Tóm tắt truyện có thẻ.',
        expectedVersion: version,
        ...body,
      },
      'put',
    )
  }
  return { author, category, create, update }
}

async function submit(author, storyId) {
  const prepared = (
    await api.get(author.cookie, `/api/author/submissions/prepare?storyId=${storyId}`)
  ).body
  const sent = await api.write(author.cookie, '/api/author/submissions', {
    storyId,
    revisionId: prepared.target.revisionId,
    expectedVersion: prepared.target.version,
    rights: { basis: 'original', asserted: true, sourceLicenceNote: '' },
  })
  expect(sent.status).toBe(201)
  return { submissionId: sent.body.submission.id, revisionId: prepared.target.revisionId }
}

async function approveAndRelease(author, moderator, storyId, { submissionId, revisionId }) {
  await markEvidenceReady(submissionId)
  expect((await claim(api, moderator, submissionId)).status).toBe(200)
  expect((await decide(api, moderator, submissionId)).status).toBe(200)
  const { version } = await Story.findById(storyId)
  const released = await api.write(author.cookie, `/api/author/stories/${storyId}/release`, {
    revisionId,
    submissionId,
    expectedVersion: version,
  })
  expect(released.status).toBe(201)
}

const catalog = query => api.get('', `/api/catalog/stories?${new URLSearchParams(query)}`)

it('normalizes Author tags on create and update and rejects invalid ones', async () => {
  const f = await setup()
  const plain = await f.create({})
  expect(plain.status).toBe(201)
  expect(plain.body.story.tags).toEqual([])
  const longest = 'x'.repeat(30)
  const created = await f.create({
    tags: [' #Kỳ-ảo ', 'kỳ-ẢO', 'phiêu _lưu', 'ab', longest],
  })
  expect(created.status).toBe(201)
  const tags = ['Kỳ-ảo', 'phiêu_lưu', 'ab', longest]
  expect(created.body.story.tags).toEqual(tags)
  const story = await Story.findById(created.body.story.id).lean()
  expect(story).toMatchObject({ tags, tagKeys: ['kỳ-ảo', 'phiêu_lưu', 'ab', longest] })
  expect((await ContentRevision.findById(story.draftRevisionId).lean()).content.tags).toEqual(tags)

  const ten = Array.from({ length: 10 }, (_, index) => `the${index}`)
  const repeated = await f.create({ tags: [...ten, 'THE0'] })
  expect(repeated.status).toBe(201)
  expect(repeated.body.story.tags).toEqual(ten)
  for (const invalid of [['a'], ['x'.repeat(31)], ['sai!'], [...ten, 'the10'], 'the', [1]]) {
    const rejected = await f.create({ tags: invalid })
    expect(rejected.status).toBe(400)
    expect(rejected.body.error).toMatchObject(tagError)
  }
  expect((await f.create({ tagKeys: ['ab'] })).body.error.code).toBe('validation_error')
  expect(await Story.countDocuments()).toBe(3)

  const kept = await f.update(story._id, { title: 'Tên mới' })
  expect(kept.status).toBe(200)
  expect(kept.body.story.tags).toEqual(tags)
  const changed = await f.update(story._id, { tags: ['Mới'] })
  expect(changed.body.story.tags).toEqual(['Mới'])
  expect(await Story.findById(story._id).lean()).toMatchObject({
    tags: ['Mới'],
    tagKeys: ['mới'],
  })
  const rejected = await f.update(story._id, { tags: ['a'] })
  expect(rejected.status).toBe(400)
  expect(rejected.body.error).toMatchObject(tagError)
  const injected = await f.update(story._id, { tags: ['Mới'], tagKeys: ['giả-mạo'] })
  expect(injected.status).toBe(400)
  expect(injected.body.error.code).toBe('validation_error')
  expect(await Story.findById(story._id).lean()).toMatchObject({
    tags: ['Mới'],
    tagKeys: ['mới'],
  })
  const workspace = await api.get(f.author.cookie, `/api/author/stories/${story._id}/workspace`)
  expect(workspace.body.story.tags).toEqual(['Mới'])
  const list = await api.get(f.author.cookie, '/api/author/stories')
  expect(list.body.items.find(item => item.id === String(story._id)).tags).toEqual(['Mới'])
})

it('releases reviewed tags and finds published stories by tag', async () => {
  const f = await setup()
  const moderator = await authenticatedAccount('moderator')
  const created = await f.create({ tags: ['Kiếm-hiệp', 'Xuyên_không'] })
  const storyId = created.body.story.id
  const first = await submit(f.author, storyId)
  const detail = await api.get(moderator.cookie, `/api/moderator/submissions/${first.submissionId}`)
  expect(detail.body.metadata.tags).toEqual(['Kiếm-hiệp', 'Xuyên_không'])
  await approveAndRelease(f.author, moderator, storyId, first)

  expect((await catalog({ tag: 'kiếm-HIỆP' })).body).toMatchObject({
    total: 1,
    items: [{ id: storyId, tags: ['Kiếm-hiệp', 'Xuyên_không'] }],
  })
  expect((await catalog({ q: '#xuyên_KHÔNG' })).body.total).toBe(1)
  expect((await catalog({ q: 'xuyên' })).body.total).toBe(0)
  expect((await catalog({ tag: 'a' })).status).toBe(400)
  expect((await api.get('', `/api/catalog/stories/${storyId}`)).body.story.tags).toEqual([
    'Kiếm-hiệp',
    'Xuyên_không',
  ])

  // An unreviewed draft never changes the public tags or tag search.
  expect((await f.update(storyId, { tags: ['Đô-thị'] })).status).toBe(200)
  expect(await Story.findById(storyId).lean()).toMatchObject({
    tags: ['Kiếm-hiệp', 'Xuyên_không'],
    tagKeys: ['kiếm-hiệp', 'xuyên_không'],
  })
  expect((await catalog({ tag: 'đô-thị' })).body.total).toBe(0)
  expect((await catalog({ tag: 'kiếm-hiệp' })).body.items[0].tags).toEqual([
    'Kiếm-hiệp',
    'Xuyên_không',
  ])
  const workspace = await api.get(f.author.cookie, `/api/author/stories/${storyId}/workspace`)
  expect(workspace.body.story.tags).toEqual(['Đô-thị'])

  await approveAndRelease(f.author, moderator, storyId, await submit(f.author, storyId))
  expect(await Story.findById(storyId).lean()).toMatchObject({
    tags: ['Đô-thị'],
    tagKeys: ['đô-thị'],
  })
  expect((await catalog({ tag: 'ĐÔ-THỊ' })).body.total).toBe(1)
  expect((await catalog({ tag: 'kiếm-hiệp' })).body.total).toBe(0)
})

it('reads a revision without tags as having none', async () => {
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: author.account._id,
  })
  const story = await Story.create({
    authorAccountId: author.account._id,
    title: 'Truyện cũ',
    categoryId: category._id,
    publicationStatus: 'published',
  })
  const revision = await ContentRevision.create({
    storyId: story._id,
    authorAccountId: author.account._id,
    contentType: 'story',
    revisionNumber: 1,
    status: 'approved',
    formatVersion: 'story-v1',
    content: { title: 'Truyện cũ', description: 'Chưa có thẻ.', categoryId: String(category._id) },
  })
  story.publishedRevisionId = revision._id
  await story.save()
  expect((await catalog({})).body.items).toMatchObject([{ id: String(story._id), tags: [] }])
})

it('lists tag usage read-only for Admin', async () => {
  const admin = await authenticatedAccount('admin')
  const author = await authenticatedAccount('author')
  const category = await Category.create({
    name: 'Kỳ ảo',
    normalizedName: 'kỳ ảo',
    createdBy: admin.account._id,
  })
  const rows = [
    ['published', ['Kiếm-hiệp']],
    ['published', ['kiếm-HIỆP', 'Đô-thị']],
    ['draft', ['KIẾM-HIỆP']],
    ['draft', ['kiếm-HIỆP', 'Ab']],
    ['draft', []],
  ]
  for (const [publicationStatus, tags] of rows)
    await Story.create({
      authorAccountId: author.account._id,
      title: 'Truyện',
      categoryId: category._id,
      publicationStatus,
      tags,
      tagKeys: tags.map(tag => tag.toLowerCase()),
    })
  const list = query =>
    api.get(admin.cookie, `/api/admin/taxonomy/tags?${new URLSearchParams(query)}`)
  expect((await list({})).body).toEqual({
    items: [
      { key: 'kiếm-hiệp', label: 'kiếm-HIỆP', publishedStories: 2, totalStories: 4 },
      { key: 'đô-thị', label: 'Đô-thị', publishedStories: 1, totalStories: 1 },
      { key: 'ab', label: 'Ab', publishedStories: 0, totalStories: 1 },
    ],
    total: 3,
    page: 1,
    pageSize: 20,
  })
  expect((await list({ q: '#KIẾM' })).body).toMatchObject({
    items: [{ key: 'kiếm-hiệp' }],
    total: 1,
  })
  expect((await list({ page: 2, pageSize: 2 })).body).toMatchObject({
    items: [{ key: 'ab' }],
    total: 3,
    page: 2,
    pageSize: 2,
  })
  expect((await list({ pageSize: 51 })).status).toBe(400)
  expect((await api.get(author.cookie, '/api/admin/taxonomy/tags')).status).toBe(403)
  expect((await api.get('', '/api/admin/taxonomy/tags')).status).toBe(401)
  expect((await api.write(admin.cookie, '/api/admin/taxonomy/tags', { name: 'Ab' })).status).toBe(
    404,
  )
})
