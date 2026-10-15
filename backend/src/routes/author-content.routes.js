import { Router } from 'express';
import { z } from 'zod';
import {
  Account,
  Category,
  ContentRevision,
  RoleAssignment,
  Story,
  Chapter,
} from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';
import { authorDashboard } from '../modules/author-dashboard.js';
import { authorStoryWorkspace } from '../modules/author-story-workspace.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const storyInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000),
    categoryIds: z
      .array(objectId)
      .min(1)
      .max(10)
      .transform((ids) => [...new Set(ids)]),
  })
  .strict();
const chapterInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    paragraphs: z.array(z.string().max(20000)).min(1).max(1000),
  })
  .strict();
function parse(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.');
  return parsed.data;
}

// Serialize with role/status changes and concurrent owner edits inside the same transaction.
async function lockAuthor(account, session) {
  const locked = await Account.findOneAndUpdate(
    {
      _id: account._id,
      status: 'active',
      authorizationEpoch: account.authorizationEpoch,
      credentialVersion: account.credentialVersion,
    },
    { $inc: { version: 1 } },
    { returnDocument: 'after', session },
  );
  const role = await RoleAssignment.exists({
    accountId: account._id,
    role: 'author',
    status: 'active',
  }).session(session);
  if (!locked || !role) throw new HttpError(403, 'forbidden', 'Quyền tác giả không còn hiệu lực.');
}
async function ownStory(account, id, session) {
  const story = await Story.findOne({ _id: id, authorAccountId: account._id }).session(
    session ?? null,
  );
  if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
  return story;
}
function editable(story) {
  if (
    story.authoringFrozen ||
    ['submitted', 'under-review', 'archived'].includes(story.publicationStatus)
  )
    throw new HttpError(409, 'content_frozen', 'Truyện đang bị khóa chỉnh sửa.');
}
function view(story) {
  return {
    id: String(story._id),
    title: story.title,
    description: story.description ?? '',
    categoryIds: story.categoryIds.map(String),
    status: story.publicationStatus,
    version: story.version,
    updatedAt: story.updatedAt,
  };
}

export function createAuthorContentRouter(config) {
  const router = Router();
  router.get(
    '/author/dashboard',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        res.json(await authorDashboard(req.account._id));
      } catch (error) {
        next(error);
      }
    },
  );
  router.use('/author/stories', requireAuth(config), requireRole('author'));
  router.param('storyId', (req, _res, next, id) => {
    if (!objectId.safeParse(id).success)
      return next(new HttpError(400, 'validation_error', 'ID truyện không hợp lệ.'));
    next();
  });
  router.param('chapterId', (req, _res, next, id) => {
    if (!objectId.safeParse(id).success)
      return next(new HttpError(400, 'validation_error', 'ID chương không hợp lệ.'));
    next();
  });
  router.get('/author/stories', async (req, res, next) => {
    try {
      const stories = await Story.find({ authorAccountId: req.account._id })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
      res.json({ items: stories.map(view) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/author/stories', async (req, res, next) => {
    try {
      const input = parse(storyInput, req.body);
      const story = await withTransaction(async (session) => {
        await lockAuthor(req.account, session);
        const count = await Category.countDocuments({
          _id: { $in: input.categoryIds },
          status: 'active',
        }).session(session);
        if (count !== input.categoryIds.length)
          throw new HttpError(400, 'invalid_categories', 'Hãy chọn thể loại đang hoạt động.');
        const [created] = await Story.create([{ ...input, authorAccountId: req.account._id }], {
          session,
        });
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'story',
              storyId: created._id,
              authorAccountId: req.account._id,
              revisionNumber: 1,
              formatVersion: 'story-v1',
              content: input,
            },
          ],
          { session },
        );
        created.draftRevisionId = revision._id;
        created.currentRevisionId = revision._id;
        await created.save({ session });
        return created;
      });
      res.status(201).json({ story: view(story) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/author/stories/:storyId/workspace', async (req, res, next) => {
    try {
      res.json(await authorStoryWorkspace(req.account, req.params.storyId));
    } catch (error) {
      next(error);
    }
  });
  router.put('/author/stories/:storyId', async (req, res, next) => {
    try {
      const input = parse(
        storyInput.omit({ categoryIds: true }).extend({ expectedVersion: z.number().int().min(0) }),
        req.body,
      );
      const story = await withTransaction(async (session) => {
        await lockAuthor(req.account, session);
        const current = await ownStory(req.account, req.params.storyId, session);
        editable(current);
        if (current.version !== input.expectedVersion)
          throw new HttpError(
            409,
            'stale_content',
            'Truyện đã thay đổi. Hãy tải lại trước khi lưu.',
          );
        const last = await ContentRevision.findOne({ storyId: current._id, contentType: 'story' })
          .sort({ revisionNumber: -1 })
          .session(session);
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'story',
              storyId: current._id,
              authorAccountId: req.account._id,
              revisionNumber: (last?.revisionNumber ?? 0) + 1,
              parentRevisionId: last?._id,
              formatVersion: 'story-v1',
              content: {
                title: input.title,
                description: input.description,
                categoryIds: current.categoryIds.map(String),
              },
            },
          ],
          { session },
        );
        current.title = input.title;
        current.description = input.description;
        current.draftRevisionId = revision._id;
        current.currentRevisionId = revision._id;
        await current.save({ session });
        return current;
      });
      res.json({ story: view(story) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/author/stories/:storyId', async (req, res, next) => {
    try {
      res.json({ story: view(await ownStory(req.account, req.params.storyId)) });
    } catch (error) {
      next(error);
    }
  });
  router.get('/author/stories/:storyId/chapters', async (req, res, next) => {
    try {
      await ownStory(req.account, req.params.storyId);
      const chapters = await Chapter.find({ storyId: req.params.storyId })
        .sort({ orderKey: 1 })
        .limit(1000)
        .lean();
      res.json({
        items: chapters.map((chapter) => ({
          id: String(chapter._id),
          title: chapter.title,
          orderKey: chapter.orderKey,
          status: chapter.status,
          version: chapter.version,
          updatedAt: chapter.updatedAt,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/author/stories/:storyId/chapters', async (req, res, next) => {
    try {
      const input = parse(chapterInput, req.body);
      const chapter = await withTransaction(async (session) => {
        await lockAuthor(req.account, session);
        const story = await ownStory(req.account, req.params.storyId, session);
        editable(story);
        const last = await Chapter.findOne({ storyId: story._id })
          .sort({ orderKey: -1 })
          .session(session);
        const [created] = await Chapter.create(
          [{ storyId: story._id, title: input.title, orderKey: (last?.orderKey ?? 0) + 1 }],
          { session },
        );
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'chapter',
              storyId: story._id,
              chapterId: created._id,
              authorAccountId: req.account._id,
              revisionNumber: 1,
              formatVersion: 'blocks-v1',
              content: {
                title: input.title,
                blocks: input.paragraphs.map((text) => ({ type: 'paragraph', text })),
              },
            },
          ],
          { session },
        );
        created.draftRevisionId = revision._id;
        created.currentRevisionId = revision._id;
        await created.save({ session });
        return created;
      });
      res.status(201).json({ chapter: { id: String(chapter._id), version: chapter.version } });
    } catch (error) {
      next(error);
    }
  });
  router.get('/author/stories/:storyId/chapters/:chapterId', async (req, res, next) => {
    try {
      const story = await ownStory(req.account, req.params.storyId);
      const chapter = await Chapter.findOne({
        _id: req.params.chapterId,
        storyId: req.params.storyId,
      }).lean();
      if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.');
      const revision = await ContentRevision.findOne({
        _id: chapter.draftRevisionId ?? chapter.currentRevisionId ?? chapter.publishedRevisionId,
        chapterId: chapter._id,
        storyId: story._id,
        contentType: 'chapter',
        authorAccountId: req.account._id,
      }).lean();
      if (!revision)
        throw new HttpError(409, 'missing_revision', 'Không tải được bản nội dung của chương.');
      const outline = await Chapter.find({ storyId: story._id })
        .sort({ orderKey: 1 })
        .select('title orderKey')
        .lean();
      const canCreate =
        !story.authoringFrozen &&
        !['submitted', 'under-review', 'archived'].includes(story.publicationStatus);
      res.json({
        chapter: {
          id: String(chapter._id),
          storyId: String(story._id),
          storyTitle: story.title,
          number: chapter.orderKey,
          canCreate,
          canEdit: canCreate && chapter.status === 'draft',
          outline: outline.map((item) => ({
            id: String(item._id),
            number: item.orderKey,
            title: item.title,
          })),
          title: chapter.title,
          version: chapter.version,
          status: chapter.status,
          paragraphs: (revision?.content?.blocks ?? [])
            .filter((block) => block.type === 'paragraph')
            .map((block) => block.text),
        },
      });
    } catch (error) {
      next(error);
    }
  });
  router.put('/author/stories/:storyId/chapters/:chapterId', async (req, res, next) => {
    try {
      const input = parse(
        chapterInput.extend({ expectedVersion: z.number().int().min(0) }),
        req.body,
      );
      const result = await withTransaction(async (session) => {
        await lockAuthor(req.account, session);
        const story = await ownStory(req.account, req.params.storyId, session);
        editable(story);
        const chapter = await Chapter.findOne({
          _id: req.params.chapterId,
          storyId: story._id,
        }).session(session);
        if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.');
        if (chapter.version !== input.expectedVersion || chapter.status !== 'draft')
          throw new HttpError(
            409,
            'stale_content',
            'Chương đã thay đổi hoặc bị khóa. Hãy tải lại.',
          );
        const last = await ContentRevision.findOne({ chapterId: chapter._id })
          .sort({ revisionNumber: -1 })
          .session(session);
        const [revision] = await ContentRevision.create(
          [
            {
              contentType: 'chapter',
              storyId: story._id,
              chapterId: chapter._id,
              authorAccountId: req.account._id,
              revisionNumber: (last?.revisionNumber ?? 0) + 1,
              parentRevisionId: last?._id,
              formatVersion: 'blocks-v1',
              content: {
                title: input.title,
                blocks: input.paragraphs.map((text) => ({ type: 'paragraph', text })),
              },
            },
          ],
          { session },
        );
        chapter.title = input.title;
        chapter.draftRevisionId = revision._id;
        chapter.currentRevisionId = revision._id;
        await chapter.save({ session });
        return { id: String(chapter._id), version: chapter.version };
      });
      res.json({ chapter: result });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
