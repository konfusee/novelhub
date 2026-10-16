import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { Category, Chapter, ContentRevision } from '../src/models/index.js';
import { authenticatedAccount } from './fixtures/accounts.js';
import { testConfig } from './config.js';
import { useTestDatabase } from './db.js';
useTestDatabase();
const origin = 'http://localhost:5173';
const app = createApp(testConfig({ cookieName: 'novelhub_session', corsOrigin: origin }));
const write = (method, path, cookie, body) =>
  request(app)[method](path).set('Cookie', cookie).set('Origin', origin).send(body);
async function fixture() {
  const author = await authenticatedAccount('author');
  const category = await Category.create({
    name: 'Thử nghiệm',
    normalizedName: 'thử nghiệm',
    createdBy: author.account._id,
  });
  const story = await write('post', '/api/author/stories', author.cookie, {
    title: 'Truyện',
    description: '',
    categoryIds: [String(category._id)],
  });
  const base = `/api/author/stories/${story.body.story.id}/chapters`;
  const created = await write('post', base, author.cookie, {
    title: 'Chương',
    paragraphs: ['Nội dung nguyên vẹn.'],
  });
  const chapter = await Chapter.findById(created.body.chapter.id);
  const revision = await ContentRevision.findById(chapter.draftRevisionId);
  return { author, chapter, revision, path: `${base}/${chapter._id}` };
}
describe('chapter editor round-trip protection', () => {
  it.each(['heading', 'image', 'marks', 'future-format'])(
    'does not flatten or overwrite %s content',
    async (kind) => {
      const f = await fixture();
      const content = {
        title: 'Chương',
        blocks: [{ type: 'paragraph', text: 'Nội dung nguyên vẹn.' }],
      };
      if (kind === 'heading')
        content.blocks.push({ type: 'heading', level: 2, text: 'Tiêu đề cần giữ' });
      if (kind === 'image')
        content.blocks.push({
          type: 'image',
          mediaId: String(f.author.account._id),
          alt: 'Ảnh cần giữ',
        });
      if (kind === 'marks') content.blocks[0].marks = [{ type: 'bold', from: 0, to: 8 }];
      f.revision.content = content;
      if (kind === 'future-format') f.revision.formatVersion = 'blocks-v99';
      await f.revision.save();
      const read = await request(app).get(f.path).set('Cookie', f.author.cookie);
      expect(read.status).toBe(409);
      expect(read.body.error.code).toBe('unsupported_editor_format');
      const saved = await write('put', f.path, f.author.cookie, {
        title: 'Ghi đè thiếu',
        paragraphs: ['Chỉ còn văn bản'],
        expectedVersion: f.chapter.version,
      });
      expect(saved.status).toBe(409);
      expect(saved.body.error.code).toBe('unsupported_editor_format');
      expect((await ContentRevision.findById(f.revision._id)).content).toEqual(content);
      expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1);
      expect((await Chapter.findById(f.chapter._id)).version).toBe(f.chapter.version);
    },
  );
  it('keeps a frozen revision read-only even when the chapter status is still draft', async () => {
    const f = await fixture();
    f.revision.immutableAt = new Date();
    f.revision.status = 'submitted';
    await f.revision.save();
    const read = await request(app).get(f.path).set('Cookie', f.author.cookie);
    expect(read.body.chapter.canEdit).toBe(false);
    expect(read.body.chapter.paragraphs).toEqual(['Nội dung nguyên vẹn.']);
    const result = await write('put', f.path, f.author.cookie, {
      title: 'Ghi đè',
      paragraphs: ['Sai'],
      expectedVersion: f.chapter.version,
    });
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('content_frozen');
    expect(await ContentRevision.countDocuments({ chapterId: f.chapter._id })).toBe(1);
  });
});
