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
import { queryPublishedStories, publishedCategoryCounts } from '../modules/catalog-query.js';
import { catalogPresentation } from '../modules/catalog-presentation.js';

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

export function createCatalogRouter(config) {
  const router = Router();
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
    try {
      const story = (await publishedCards({ ids: [req.params.storyId] }))[0];
      const chapter =
        story &&
        (await Chapter.findOne({
          _id: req.params.chapterId,
          storyId: req.params.storyId,
          status: 'published',
          publishedRevisionId: { $ne: null },
        }).lean());
      if (!chapter) throw new HttpError(404, 'not_found', 'Không tìm thấy chương đã xuất bản.');
      if (chapter.earlyAccess?.enabled && chapter.earlyAccess.endsAt > new Date()) {
        const auth = await resolveSession(readCookie(req.headers.cookie, config.cookieName));
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
      // Fail closed for an invalid early-access policy rather than exposing paid content.
      if (chapter.earlyAccess?.enabled && !chapter.earlyAccess.endsAt)
        throw new HttpError(403, 'chapter_locked', 'Chương chưa mở để đọc.');
      const revision = await ContentRevision.findOne({
        _id: chapter.publishedRevisionId,
        storyId: chapter.storyId,
        chapterId: chapter._id,
        contentType: 'chapter',
        status: { $in: ['approved', 'immutable'] },
      })
        .select('content')
        .lean();
      if (!revision) throw new HttpError(404, 'not_found', 'Chương chưa sẵn sàng.');
      res.json({
        chapter: {
          id: String(chapter._id),
          title: revision.content.title ?? '',
          publishedAt: chapter.publishedAt ?? null,
          blocks: (revision.content.blocks ?? [])
            .filter((block) => block.type === 'paragraph' && typeof block.text === 'string')
            .map((block) => ({ type: 'paragraph', text: block.text })),
        },
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
