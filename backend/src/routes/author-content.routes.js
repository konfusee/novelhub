import { Router } from 'express';
import { z } from 'zod';
import { Category, ContentRevision, Story, Chapter } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';
import { authorDashboard } from '../modules/author-dashboard.js';
import { authorStoryWorkspace } from '../modules/author-story-workspace.js';
import { authorDrafts } from '../modules/author-drafts.js';
import { authorAnalytics } from '../modules/author-analytics.js';
import { authorEarnings } from '../modules/author-earnings.js';
import { lockAuthor, ownStory, editable } from '../modules/author-ownership.js';
import { assertTextEditorRevision, chapterParagraphText } from '../modules/chapter-document.js';
import { changeDraftLifecycle } from '../modules/author-story-lifecycle.js';
import { reorderDraftChapters } from '../modules/author-chapter-order.js';

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
    paragraphs: z.array(chapterParagraphText).min(1).max(1000),
  })
  .strict();
function parse(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Thông tin không hợp lệ.');
  return parsed.data;
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
  router.post('/author/stories/:storyId/chapters/reorder', async (req, res, next) => {
    try {
      const input = parse(
        z
          .object({
            expectedVersion: z.number().int().min(0),
            chapters: z
              .array(z.object({ id: objectId, expectedVersion: z.number().int().min(0) }).strict())
              .min(2)
              .max(1000),
          })
          .strict()
          .refine(
            (value) =>
              new Set(value.chapters.map((chapter) => chapter.id)).size === value.chapters.length,
          ),
        req.body,
      );
      res.json(await reorderDraftChapters(req.account, parse(objectId, req.params.storyId), input));
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/author/earnings',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const { period } = parse(
          z.object({ period: z.enum(['day', 'week', 'month']).default('month') }).strict(),
          req.query,
        );
        res.json(await authorEarnings(req.account._id, period));
      } catch (error) {
        next(error);
      }
    },
  );
  router.get(
    '/author/analytics',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        const input = parse(
          z
            .object({
              days: z.coerce
                .number()
                .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
                .default(30),
              storyId: objectId.optional(),
            })
            .strict(),
          req.query,
        );
        res.json(await authorAnalytics(req.account._id, input));
      } catch (error) {
        next(error);
      }
    },
  );
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
        .lean();
      res.json({ items: stories.map(view) });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/author/drafts',
    requireAuth(config),
    requireRole('author'),
    async (req, res, next) => {
      try {
        res.json(await authorDrafts(req.account._id));
      } catch (error) {
        next(error);
      }
    },
  );
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
  router.post('/author/stories/:storyId/lifecycle', async (req, res, next) => {
    try {
      const id = parse(objectId, req.params.storyId);
      const input = parse(
        z
          .object({
            action: z.enum(['archive', 'restore']),
            expectedVersion: z.number().int().min(0),
          })
          .strict(),
        req.body,
      );
      res.json({ story: await changeDraftLifecycle(req.account, id, input) });
    } catch (error) {
      next(error);
    }
  });
  router.put('/author/stories/:storyId', async (req, res, next) => {
    try {
      const input = parse(
        storyInput.extend({
          categoryIds: storyInput.shape.categoryIds.optional(),
          expectedVersion: z.number().int().min(0),
        }),
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
        const categoryIds = input.categoryIds ?? current.categoryIds.map(String);
        if (input.categoryIds) {
          const count = await Category.countDocuments({
            _id: { $in: categoryIds },
            status: 'active',
          }).session(session);
          if (count !== categoryIds.length)
            throw new HttpError(400, 'invalid_categories', 'Hãy chọn thể loại đang hoạt động.');
        }
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
                categoryIds,
              },
            },
          ],
          { session },
        );
        current.title = input.title;
        current.description = input.description;
        current.categoryIds = categoryIds;
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
      assertTextEditorRevision(revision);
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
          canEdit:
            canCreate &&
            chapter.status === 'draft' &&
            revision.status === 'editable' &&
            !revision.immutableAt,
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
        const source = await ContentRevision.findOne({
          _id: chapter.draftRevisionId ?? chapter.currentRevisionId,
          storyId: story._id,
          chapterId: chapter._id,
          contentType: 'chapter',
          authorAccountId: req.account._id,
        }).session(session);
        if (!source)
          throw new HttpError(409, 'missing_revision', 'Không tìm thấy bản nháp hiện tại.');
        assertTextEditorRevision(source);
        if (source.status !== 'editable' || source.immutableAt)
          throw new HttpError(409, 'content_frozen', 'Phiên bản hiện tại đã bị khóa chỉnh sửa.');
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
