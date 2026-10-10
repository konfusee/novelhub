import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../db.js';
import { Story } from '../../src/models/content/story.model.js';
import { Chapter } from '../../src/models/content/chapter.model.js';
import { ContentRevision } from '../../src/models/content/content-revision.model.js';
import { NarrationAsset } from '../../src/models/content/narration-asset.model.js';
useTestDatabase();
const id = '507f1f77bcf86cd799439011';
describe('content models', () => {
  it('validates chapter statuses and unique story order', async () => {
    const data = { storyId: id, orderKey: 1, title: 'One' };
    await Chapter.create(data);
    await expect(Chapter.create(data)).rejects.toMatchObject({ code: 11000 });
    await expect(
      new Chapter({ ...data, orderKey: 2, status: 'invalid' }).validate(),
    ).rejects.toThrow();
  });
  it('prevents immutable revision content changes', async () => {
    const revision = await ContentRevision.create({
      contentType: 'chapter',
      storyId: id,
      chapterId: id,
      authorAccountId: id,
      revisionNumber: 1,
      content: { type: 'doc' },
      formatVersion: '1',
      immutableAt: new Date(),
    });
    revision.content = { type: 'changed' };
    await expect(revision.validate()).rejects.toThrow(/immutable/);
  });
  it('enforces narration revision and voice uniqueness', async () => {
    const data = { chapterId: id, revisionId: id, voiceId: 'default' };
    await NarrationAsset.create(data);
    await expect(NarrationAsset.create(data)).rejects.toMatchObject({ code: 11000 });
  });
  it('stores story theme and authoring freeze', async () => {
    const story = await Story.create({
      authorAccountId: id,
      title: 'Story',
      categoryIds: [id],
      authoringFrozen: true,
      theme: { accentColor: '#fff', fontFamily: 'system', headingDividerPreset: 'simple' },
    });
    expect(story.authoringFrozen).toBe(true);
    expect(story.theme.headingDividerPreset).toBe('simple');
  });

  it('requires at least one category and scopes revision numbers to content', async () => {
    await expect(
      Story.create({ authorAccountId: id, title: 'No categories', categoryIds: [] }),
    ).rejects.toThrow(/at least one category/);
    const base = {
      storyId: id,
      authorAccountId: id,
      content: { type: 'doc' },
      formatVersion: '1',
    };
    await ContentRevision.create({
      ...base,
      contentType: 'chapter',
      chapterId: id,
      revisionNumber: 1,
    });
    await ContentRevision.create({
      ...base,
      contentType: 'chapter',
      chapterId: '507f1f77bcf86cd799439012',
      revisionNumber: 1,
    });
    await expect(
      ContentRevision.create({ ...base, contentType: 'chapter', chapterId: id, revisionNumber: 1 }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('sets firstReleasedAt once and freezes submitted fields', async () => {
    const chapter = await Chapter.create({ storyId: id, orderKey: 10, title: 'Draft' });
    chapter.firstReleasedAt = new Date();
    await chapter.save();
    chapter.firstReleasedAt = new Date(Date.now() + 1000);
    await expect(chapter.save()).rejects.toThrow(/cannot be changed once set/);
    const revision = await ContentRevision.create({
      contentType: 'chapter',
      storyId: id,
      chapterId: id,
      authorAccountId: id,
      revisionNumber: 2,
      content: { type: 'doc' },
      formatVersion: '1',
      immutableAt: new Date(),
      mediaIds: [id],
      packageDigest: 'a',
    });
    revision.mediaIds = ['507f1f77bcf86cd799439012'];
    await expect(revision.save()).rejects.toThrow(/cannot be changed/);
    await expect(
      ContentRevision.updateOne({ _id: revision._id }, { $set: { content: { changed: true } } }),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      ContentRevision.updateOne(
        { _id: revision._id },
        { $set: { immutableAt: null, content: { changed: true } } },
      ),
    ).rejects.toThrow(/cannot be changed/);
  });
});
