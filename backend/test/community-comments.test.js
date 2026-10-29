import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, Comment, CommentLike } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { publishedStory } from './fixtures/community.js'
import { apiClient, origin } from './fixtures/submissions.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }))
const api = apiClient(app)
const post = (reader, url, body) => api.write(reader.cookie, url, body)

describe('community comments', () => {
  it('creates, lists and replies one level deep with viewer flags', async () => {
    const { storyId } = await publishedStory()
    const [alice, bob] = [await authenticatedAccount(), await authenticatedAccount()]
    const url = `/api/community/stories/${storyId}/comments`

    const created = await post(alice, url, { body: '  Truyện hay quá!  ' })
    expect(created.status).toBe(201)
    expect(created.body.comment).toMatchObject({
      body: 'Truyện hay quá!',
      author: { id: String(alice.account._id), displayName: 'Test reader' },
      edited: false,
      deleted: false,
      likeCount: 0,
      liked: false,
      mine: true,
      parentId: null,
      replies: [],
    })
    const rootId = created.body.comment.id
    const reply = await post(bob, url, { body: 'Đồng ý', parentId: rootId })
    expect(reply.status).toBe(201)
    expect(reply.body.comment.parentId).toBe(rootId)
    const nested = await post(alice, url, { body: 'Sâu hơn', parentId: reply.body.comment.id })
    expect(nested.status).toBe(400)
    expect(nested.body.error.code).toBe('invalid_parent')
    const second = await post(bob, url, { body: 'Bình luận thứ hai' })
    const elsewhere = await publishedStory({ title: 'Truyện khác' })
    const crossTarget = await post(alice, `/api/community/stories/${elsewhere.storyId}/comments`, {
      body: 'Sai chỗ',
      parentId: rootId,
    })
    expect(crossTarget.body.error.code).toBe('invalid_parent')

    const asBob = await api.get(bob.cookie, url)
    expect(asBob.status).toBe(200)
    expect(asBob.body).toMatchObject({ total: 2, page: 1, pageSize: 20 })
    expect(asBob.body.items.map(item => item.id)).toEqual([second.body.comment.id, rootId])
    const thread = asBob.body.items[1]
    expect(thread.mine).toBe(false)
    expect(thread.replies).toHaveLength(1)
    expect(thread.replies[0]).toMatchObject({ body: 'Đồng ý', mine: true, parentId: rootId })

    const guest = await request(app).get(url)
    expect(guest.body.items[1].replies[0].mine).toBe(false)

    await Account.updateOne(
      { _id: alice.account._id },
      { status: 'anonymized', displayName: 'Ẩn danh' },
    )
    const afterDeletion = await request(app).get(url)
    expect(afterDeletion.body.items[1].author.displayName).toBe('Deleted user')
  })

  it('rejects guests and invalid bodies', async () => {
    const { storyId } = await publishedStory()
    const reader = await authenticatedAccount()
    const url = `/api/community/stories/${storyId}/comments`
    const guest = await request(app).post(url).set('Origin', origin).send({ body: 'Xin chào' })
    expect(guest.status).toBe(401)
    expect((await post(reader, url, { body: '   ' })).status).toBe(400)
    expect((await post(reader, url, { body: 'x'.repeat(2001) })).status).toBe(400)
    expect(await Comment.countDocuments()).toBe(0)
  })

  it('marks edits, enforces ownership and versions, and soft-deletes threads', async () => {
    const { storyId } = await publishedStory()
    const [alice, bob] = [await authenticatedAccount(), await authenticatedAccount()]
    const url = `/api/community/stories/${storyId}/comments`
    const root = (await post(alice, url, { body: 'Gốc' })).body.comment
    const lonely = (await post(alice, url, { body: 'Không ai trả lời' })).body.comment
    const reply = (await post(bob, url, { body: 'Trả lời', parentId: root.id })).body.comment

    const edit = (reader, comment, body, expectedVersion = comment.version) =>
      api.write(
        reader.cookie,
        `/api/community/comments/${comment.id}`,
        { body, expectedVersion },
        'put',
      )
    const edited = await edit(alice, root, 'Gốc đã sửa')
    expect(edited.status).toBe(200)
    expect(edited.body.comment).toMatchObject({ body: 'Gốc đã sửa', edited: true })
    expect((await edit(alice, root, 'Lần nữa')).body.error.code).toBe('stale_comment')
    expect((await edit(bob, edited.body.comment, 'Chiếm quyền')).status).toBe(403)

    const remove = (reader, comment) =>
      api.write(reader.cookie, `/api/community/comments/${comment.id}`, undefined, 'delete')
    expect((await remove(bob, root)).status).toBe(403)
    expect((await remove(alice, root)).status).toBe(204)
    expect((await remove(alice, root)).status).toBe(204)
    expect((await remove(alice, lonely)).status).toBe(204)
    expect((await Comment.findById(root.id)).status).toBe('soft-deleted')
    expect((await edit(alice, edited.body.comment, 'Sau khi xóa')).status).toBe(403)

    const listed = (await api.get(bob.cookie, url)).body
    expect(listed.total).toBe(1)
    expect(listed.items[0]).toMatchObject({ id: root.id, deleted: true, body: '' })
    expect(listed.items[0].replies.map(item => item.id)).toEqual([reply.id])

    expect((await remove(bob, reply)).status).toBe(204)
    expect((await api.get(bob.cookie, url)).body).toMatchObject({ total: 0, items: [] })
  })

  it('counts likes once per reader in the same transaction', async () => {
    const { storyId } = await publishedStory()
    const [alice, bob] = [await authenticatedAccount(), await authenticatedAccount()]
    const url = `/api/community/stories/${storyId}/comments`
    const comment = (await post(alice, url, { body: 'Thích không?' })).body.comment
    const like = (reader, liked) =>
      api.write(reader.cookie, `/api/community/comments/${comment.id}/like`, { liked }, 'put')

    expect((await like(bob, true)).body).toEqual({ liked: true, likeCount: 1 })
    expect((await like(bob, true)).body).toEqual({ liked: true, likeCount: 1 })
    expect((await like(alice, true)).body).toEqual({ liked: true, likeCount: 2 })
    expect((await like(bob, false)).body).toEqual({ liked: false, likeCount: 1 })
    expect((await like(bob, false)).body).toEqual({ liked: false, likeCount: 1 })
    expect(await CommentLike.countDocuments({ commentId: comment.id })).toBe(2)
    const listed = (await api.get(alice.cookie, url)).body.items[0]
    expect(listed).toMatchObject({ likeCount: 1, liked: true })

    await Comment.updateOne({ _id: comment.id }, { status: 'hidden' })
    expect((await like(bob, true)).status).toBe(404)
    expect((await api.get(alice.cookie, url)).body.total).toBe(0)
  })

  it('lists chapter comments for anyone but rejects comments on locked early-access chapters', async () => {
    const { storyId, chapterIds } = await publishedStory({
      chapters: [
        { title: 'Chương một', paragraphs: ['Mở đầu.'] },
        {
          title: 'Chương hai',
          paragraphs: ['Đọc sớm.'],
          earlyAccess: {
            enabled: true,
            durationDays: 3,
            coinPrice: 10,
            endsAt: new Date(Date.now() + 86400000),
          },
        },
      ],
    })
    const reader = await authenticatedAccount()
    const freeUrl = `/api/community/chapters/${chapterIds[0]}/comments`
    const lockedUrl = `/api/community/chapters/${chapterIds[1]}/comments`

    expect((await post(reader, freeUrl, { body: 'Chương hay' })).status).toBe(201)
    const locked = await post(reader, lockedUrl, { body: 'Muốn đọc' })
    expect(locked.status).toBe(403)
    expect(locked.body.error.code).toBe('comment_locked')
    expect((await request(app).get(lockedUrl)).body).toMatchObject({ total: 0, items: [] })
    expect((await request(app).get(freeUrl)).body.total).toBe(1)
    expect((await request(app).get(`/api/community/chapters/${storyId}/comments`)).status).toBe(404)
  })
})
