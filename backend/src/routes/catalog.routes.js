import { Router } from 'express';
import { z } from 'zod';
import {
  Account,
  Category,
  Comment,
  ContentRevision,
  Chapter,
  Follow,
  Rating,
  StatisticsEvent,
  Story,
  UnlockEntitlement,
} from '../models/index.js';
import mongoose from 'mongoose';
import { readCookie, resolveSession } from '../auth/session.js';
import { HttpError } from '../middleware/errors.js';
import {
  queryPublishedStories,
  publishedCategoryCounts,
  publishedCatalogueStats,
} from '../modules/catalog-query.js';
import { catalogPresentation } from '../modules/catalog-presentation.js';
import { readRichChapter, chapterTextProjection } from '../modules/rich-chapter-document.js';
import { submittedImage } from '../modules/author-submitted-package.js';
import { PublicationSubmission } from '../models/index.js';

const filters = z
  .object({
    q: z.string().trim().max(200).default(''),
    sort: z.enum(['newest', 'reads', 'rating']).default('newest'),
    category: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict();

// Only the published revision is authoritative on public surfaces. Story.title may
// already contain an author's next draft and must not be used as a fallback.
export async function publishedCards(options) {
  return (await queryPublishedStories(options)).items;
}

async function categoryItems() {
  const [categories, counts, presentation] = await Promise.all([
    Category.find({ status: 'active' }).sort({ sortKey: 1, name: 1 }).lean(),
    publishedCategoryCounts(),
    catalogPresentation()
      .find({ _id: { $type: 'objectId' } })
      .toArray(),
  ]);
  const metadata = new Map(presentation.map((item) => [String(item._id), item]));
  return categories.map((category) => ({
    id: String(category._id),
    name: category.name,
    count: counts.get(String(category._id)) ?? 0,
    description: metadata.get(String(category._id))?.description ?? '',
    icon: metadata.get(String(category._id))?.icon ?? 'BookOpen',
    tone: metadata.get(String(category._id))?.tone ?? 'neutral',
  }));
}

async function visibleChapter(config, params, cookie) {
  const story = (await publishedCards({ ids: [params.storyId] }))[0];
  const chapter =
    story &&
    (await Chapter.findOne({
      _id: params.chapterId,
      storyId: params.storyId,
      status: 'published',
      publishedRevisionId: { $ne: null },
    }).lean());
  if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương đã xuất bản.');
  const auth = await resolveSession(readCookie(cookie, config.cookieName));
  if (chapter.orderKey !== 1 && !auth)
    throw new HttpError(401, 'authentication_required', 'Đăng nhập để đọc các chương tiếp theo.');
  if (chapter.earlyAccess?.enabled) {
    if (!chapter.earlyAccess.endsAt)
      throw new HttpError(403, 'chapter_locked', 'Chương chưa mở để đọc.');
    if (chapter.earlyAccess.endsAt > new Date()) {
      const entitlement =
        auth &&
        (await UnlockEntitlement.exists({
          accountId: auth.account._id,
          chapterId: chapter._id,
          publishedRevisionId: chapter.publishedRevisionId,
          status: 'active',
          expiresAt: { $gt: new Date() },
        }));
      if (!entitlement)
        throw new HttpError(403, 'chapter_locked', 'Chương đang trong thời gian đọc sớm.');
    }
  }
  return chapter;
}

export function createCatalogRouter(config) {
  const router = Router();
  router.get('/catalog/rankings', async (req, res) => {
    const parsed = z
      .object({
        category: z.enum(['trending', 'reads', 'audio', 'rating', 'newest']).default('trending'),
        period: z.enum(['day', 'week', 'month', 'all']).default('week'),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .strict()
      .safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid ranking filters');
    const input = parsed.data;
    const now = new Date();
    // Calendar boundaries in Vietnam (UTC+7); week starts on Monday.
    const local = new Date(now.getTime() + 7 * 3600000);
    local.setUTCHours(0, 0, 0, 0);
    if (input.period === 'week')
      local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
    if (input.period === 'month') local.setUTCDate(1);
    const since = input.period === 'all' ? undefined : new Date(local.getTime() - 7 * 3600000);
    if (input.category === 'audio')
      return res.json({
        items: [],
        podium: [],
        total: 0,
        page: input.page,
        updatedAt: now,
        unavailable: 'audio',
      });
    const options = {
      sort:
        input.category === 'newest' ? 'newest' : input.category === 'rating' ? 'rating' : 'reads',
      viewSince: since,
      publishedSince: input.category === 'newest' ? since : undefined,
      pageSize: 15,
    };
    const result = await queryPublishedStories({ ...options, page: input.page });
    const leaders =
      input.page === 1
        ? result.items.slice(0, 3)
        : (await queryPublishedStories({ ...options, pageSize: 3 })).items;
    const ranked = (item, index) => ({ ...item, rank: index + 1, change: null });
    res.json({
      ...result,
      items: result.items
        .map((item, index) => ranked(item, (input.page - 1) * 15 + index))
        .filter((item) => item.rank > 3),
      podium: leaders.map(ranked),
      updatedAt: now,
    });
  });

  router.param('storyId', async (req, _res, next, id) => {
    try {
      if (/^[a-f\d]{24}$/i.test(id)) return next();
      if (!/^[a-z0-9-]{1,150}$/.test(id))
        throw new HttpError(400, 'validation_error', 'ID truyện không hợp lệ.');
      const alias = await catalogPresentation().findOne({ _id: `alias:${id}` });
      if (!alias?.storyId) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
      req.params.storyId = String(alias.storyId);
      next();
    } catch (error) {
      next(error);
    }
  });
  router.param('chapterId', async (req, _res, next, id) => {
    try {
      if (/^[a-f\d]{24}$/i.test(id)) return next();
      if (!/^chapter-[1-9]\d{0,5}$/.test(id))
        throw new HttpError(400, 'validation_error', 'ID chương không hợp lệ.');
      const chapter = await Chapter.findOne({
        storyId: req.params.storyId,
        orderKey: Number(id.slice(8)),
      })
        .select('_id')
        .lean();
      if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương.');
      req.params.chapterId = String(chapter._id);
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get('/catalog/categories', async (_req, res, next) => {
    try {
      res.json({ items: await categoryItems() });
    } catch (error) {
      next(error);
    }
  });
  router.get('/catalog/home', async (_req, res, next) => {
    try {
      const presentation = await catalogPresentation().findOne({ _id: 'home-layout' });
      const [categories, stats, result, trending] = await Promise.all([
        categoryItems(),
        publishedCatalogueStats(),
        queryPublishedStories({
          pageSize: 6,
          ...(presentation?.storyIds?.length
            ? { ids: presentation.storyIds.map(String) }
            : { sort: 'reads' }),
        }),
        queryPublishedStories({ pageSize: 6, sort: 'reads' }),
      ]);
      const order = new Map((presentation?.storyIds ?? []).map((id, index) => [String(id), index]));
      const stories = result.items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      let preview = null;
      for (const story of stories) {
        const chapters = await Chapter.find({
          storyId: story.id,
          orderKey: 1,
          status: 'published',
          publishedRevisionId: { $ne: null },
          $or: [
            { 'earlyAccess.enabled': { $ne: true } },
            { 'earlyAccess.endsAt': { $lte: new Date() } },
          ],
        })
          .sort({ orderKey: 1 })
          .select('publishedRevisionId orderKey')
          .lean();
        for (const chapter of chapters) {
          const revision = await ContentRevision.findOne({
            _id: chapter.publishedRevisionId,
            chapterId: chapter._id,
            storyId: story.id,
            contentType: 'chapter',
            status: { $in: ['approved', 'immutable'] },
          })
            .select('content formatVersion mediaIds')
            .lean();
          if (!revision) continue;
          preview = {
            story,
            chapterId: String(chapter._id),
            number: chapter.orderKey,
            title: revision.content?.title ?? '',
            paragraphs: chapterTextProjection(revision).slice(0, 2),
          };
          break;
        }
        if (preview) break;
      }
      const featured = (presentation?.featured ?? []).map((item) => ({
        label: typeof item.label === 'string' ? item.label : '',
        title: typeof item.title === 'string' ? item.title : '',
        description: typeof item.description === 'string' ? item.description : '',
        tone: ['green', 'purple', 'orange', 'rose'].includes(item.tone) ? item.tone : 'green',
      }));
      res.json({ stories, trending: trending.items, categories, featured, stats, preview });
    } catch (error) {
      next(error);
    }
  });
  router.get('/catalog/discovery', async (_req, res, next) => {
    try {
      const [categories, curation] = await Promise.all([
        categoryItems(),
        catalogPresentation().findOne({ _id: 'curation' }),
      ]);
      const shelf = async (names) => {
        const category = categories.find((item) => names.includes(item.name));
        return category
          ? (await queryPublishedStories({ category: category.id, pageSize: 4 })).items
          : [];
      };
      const [fantasy, romance, scifi, gems] = await Promise.all([
        shelf(['Kỳ ảo', 'Fantasy']),
        shelf(['Lãng mạn', 'Romance']),
        shelf(['Khoa học viễn tưởng', 'Sci-Fi']),
        curation?.gems?.length
          ? publishedCards({ ids: curation.gems.map(String), pageSize: 100 })
          : [],
      ]);
      const tags = await Promise.all(
        (curation?.tags ?? []).map(async (label) => ({
          label,
          count: (
            await queryPublishedStories({
              q: label.replace(/^#/, '').replace(/([a-z])([A-Z])/g, '$1 $2'),
              pageSize: 1,
            })
          ).total,
        })),
      );
      res.json({ categories, collections: { fantasy, romance, scifi, gems }, tags });
    } catch (error) {
      next(error);
    }
  });
  router.get('/catalog/stories', async (req, res, next) => {
    try {
      const parsed = filters.safeParse(req.query);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Invalid catalogue filters');
      res.json(await queryPublishedStories(parsed.data));
    } catch (error) {
      next(error);
    }
  });
  router.get('/catalog/stories/:storyId', async (req, res, next) => {
    try {
      const story = (await publishedCards({ ids: [req.params.storyId] }))[0];
      if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện đã xuất bản.');
      const chapters = await Chapter.find({
        storyId: req.params.storyId,
        status: 'published',
        publishedRevisionId: { $ne: null },
      })
        .sort({ orderKey: 1 })
        .select('publishedRevisionId earlyAccess orderKey')
        .lean();
      const revisions = await ContentRevision.find({
        _id: { $in: chapters.map((chapter) => chapter.publishedRevisionId) },
        storyId: req.params.storyId,
        contentType: 'chapter',
        status: { $in: ['approved', 'immutable'] },
      })
        .select('chapterId content.title')
        .lean();
      const titles = new Map(revisions.map((revision) => [String(revision._id), revision]));
      const [followers, ratings, author, works, latestComment] = await Promise.all([
        Follow.countDocuments({ storyId: req.params.storyId, status: 'active' }),
        Rating.aggregate([
          {
            $match: { storyId: new mongoose.Types.ObjectId(req.params.storyId), status: 'active' },
          },
          { $group: { _id: '$value', count: { $sum: 1 } } },
        ]),
        Account.findById(story.authorId).select('profile.bio').lean(),
        Story.find({ authorAccountId: story.authorId, publicationStatus: 'published' })
          .select('_id')
          .lean(),
        Comment.findOne({ targetType: 'story', targetId: req.params.storyId, status: 'visible' })
          .sort({ createdAt: -1 })
          .select('body authorAccountId')
          .populate('authorAccountId', 'displayName status')
          .lean(),
      ]);
      const ratingCount = ratings.reduce((count, item) => count + item.count, 0);
      const [authorFollowers, authorReads] = await Promise.all([
        Follow.countDocuments({
          storyId: { $in: works.map((item) => item._id) },
          status: 'active',
        }),
        StatisticsEvent.countDocuments({
          storyId: { $in: works.map((item) => item._id) },
          eventType: 'view',
        }),
      ]);
      res.json({
        story: {
          ...story,
          synopsis: story.description,
          language: 'Tiếng Việt',
          followers,
          ratings: ratingCount,
          authorBio: author?.profile?.bio ?? '',
          authorStats: { works: works.length, followers: authorFollowers, reads: authorReads },
          ratingBreakdown: [5, 4, 3, 2, 1].map((value) =>
            ratingCount
              ? Math.round(
                  (100 * (ratings.find((item) => item._id === value)?.count ?? 0)) / ratingCount,
                )
              : 0,
          ),
          featuredReview: latestComment?.body ?? '',
          featuredReviewer:
            latestComment?.authorAccountId?.status === 'active'
              ? latestComment.authorAccountId.displayName
              : '',
        },
        chapters: chapters.flatMap((chapter) => {
          const revision = titles.get(String(chapter.publishedRevisionId));
          if (!revision || String(revision.chapterId) !== String(chapter._id)) return [];
          return [
            {
              id: String(chapter._id),
              title: revision.content?.title ?? '',
              orderKey: chapter.orderKey,
              locked: Boolean(
                chapter.earlyAccess?.enabled &&
                (!chapter.earlyAccess.endsAt || chapter.earlyAccess.endsAt > new Date()),
              ),
            },
          ];
        }),
      });
    } catch (error) {
      next(error);
    }
  });
  router.get('/catalog/stories/:storyId/chapters/:chapterId', async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store').vary('Cookie');
    try {
      const chapter = await visibleChapter(config, req.params, req.headers.cookie);
      const revision = await ContentRevision.findOne({
        _id: chapter.publishedRevisionId,
        storyId: chapter.storyId,
        chapterId: chapter._id,
        contentType: 'chapter',
        status: { $in: ['approved', 'immutable'] },
      })
        .select('content formatVersion mediaIds')
        .lean();
      if (!revision) throw new HttpError(404, 'not_found', 'Chương chưa sẵn sàng.');
      let document;
      try {
        document = readRichChapter(revision);
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        throw new HttpError(404, 'not_found', 'Chương chưa sẵn sàng.');
      }
      res.json({
        chapter: {
          id: String(chapter._id),
          title: revision.content.title ?? '',
          publishedAt: chapter.publishedAt ?? null,
          revisionId: String(revision._id),
          blocks:
            revision.formatVersion === 'blocks-v1'
              ? revision.content.blocks
                  .filter((block) => block.type === 'paragraph' && typeof block.text === 'string')
                  .map((block) => ({ type: 'paragraph', text: block.text }))
              : document.blocks,
        },
      });
    } catch (error) {
      next(error);
    }
  });
  router.get(
    '/catalog/stories/:storyId/chapters/:chapterId/revisions/:revisionId/media/:mediaId',
    async (req, res, next) => {
      res.set('Cache-Control', 'private, no-store').vary('Cookie');
      try {
        const chapter = await visibleChapter(config, req.params, req.headers.cookie);
        if (String(chapter.publishedRevisionId) !== req.params.revisionId)
          throw new HttpError(404, 'not_found', 'Ảnh không thuộc phiên bản công khai hiện tại.');
        const submission = await PublicationSubmission.findOne({
          storyId: chapter.storyId,
          chapterId: chapter._id,
          revisionId: chapter.publishedRevisionId,
          status: 'approved',
        }).lean();
        const revision =
          submission &&
          (await ContentRevision.exists({
            _id: chapter.publishedRevisionId,
            chapterId: chapter._id,
            storyId: chapter.storyId,
            authorAccountId: submission.authorAccountId,
            contentType: 'chapter',
            status: { $in: ['approved', 'immutable'] },
            immutableAt: { $ne: null },
          }));
        if (!revision) throw new HttpError(404, 'not_found', 'Ảnh chưa sẵn sàng.');
        const bytes = await submittedImage(
          config,
          { _id: submission.authorAccountId },
          submission._id,
          req.params.mediaId,
          { requireApproved: true },
        );
        res.set('X-Content-Type-Options', 'nosniff').type('image/webp').send(bytes);
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}
