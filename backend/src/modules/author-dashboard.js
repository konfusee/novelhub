import {
  Chapter,
  Comment,
  ContentRevision,
  Follow,
  Rating,
  StatisticsEvent,
  Story,
  Wallet,
} from '../models/index.js';
import { chapterTextProjection } from './rich-chapter-document.js';

export async function authorDashboard(accountId) {
  const stories = await Story.find({ authorAccountId: accountId })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();
  const ids = stories.map((story) => story._id);
  const [chapters, views, ratings, followers, wallet, feedback, feedbackTotal] = await Promise.all([
    Chapter.find({ storyId: { $in: ids } })
      .select('storyId title status draftRevisionId updatedAt')
      .sort({ updatedAt: -1, _id: -1 })
      .lean(),
    StatisticsEvent.aggregate([
      { $match: { storyId: { $in: ids }, eventType: 'view' } },
      { $group: { _id: '$storyId', count: { $sum: 1 } } },
    ]),
    Rating.aggregate([
      { $match: { storyId: { $in: ids }, status: 'active' } },
      { $group: { _id: '$storyId', average: { $avg: '$value' } } },
    ]),
    Follow.distinct('accountId', { storyId: { $in: ids }, status: 'active' }),
    Wallet.findOne({ ownerType: 'account', ownerId: accountId, purpose: 'author-earnings' })
      .select('availableBalance')
      .lean(),
    Comment.find({
      targetType: 'story',
      targetId: { $in: ids },
      parentCommentId: null,
      status: 'visible',
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(2)
      .populate('authorAccountId', 'displayName status')
      .select('body targetId authorAccountId createdAt')
      .lean(),
    Comment.countDocuments({
      targetType: 'story',
      targetId: { $in: ids },
      parentCommentId: null,
      status: 'visible',
    }),
  ]);
  const editable = new Set(
    stories
      .filter(
        (story) =>
          !story.authoringFrozen &&
          !['submitted', 'under-review', 'archived'].includes(story.publicationStatus),
      )
      .map((story) => String(story._id)),
  );
  const draftChapters = chapters.filter(
    (chapter) =>
      chapter.status === 'draft' &&
      chapter.draftRevisionId &&
      editable.has(String(chapter.storyId)),
  );
  const revisions = await ContentRevision.find({
    _id: { $in: draftChapters.map((chapter) => chapter.draftRevisionId) },
    authorAccountId: accountId,
    contentType: 'chapter',
    status: 'editable',
  })
    .select('storyId chapterId content formatVersion')
    .lean();
  const validDrafts = draftChapters.flatMap((chapter) => {
    const revision = revisions.find(
      (item) =>
        item._id.equals(chapter.draftRevisionId) &&
        item.chapterId?.equals(chapter._id) &&
        item.storyId.equals(chapter.storyId),
    );
    if (!revision) return [];
    const story = stories.find((item) => item._id.equals(chapter.storyId));
    const written = chapterTextProjection(revision).reduce(
      (sum, text) => sum + (text.match(/\S+/gu)?.length ?? 0),
      0,
    );
    return [
      {
        id: String(story._id),
        title: story.title,
        chapterId: String(chapter._id),
        chapter: revision.content?.title ?? chapter.title,
        written,
      },
    ];
  });
  return {
    stats: {
      views: views.reduce((sum, row) => sum + row.count, 0),
      audioPlays: null,
      followers: followers.length,
      earnings: String(wallet?.availableBalance ?? '0'),
    },
    stories: stories.map((story) => ({
      id: String(story._id),
      title: story.title,
      status: story.publicationStatus,
      chapters: chapters.filter((chapter) => chapter.storyId.equals(story._id)).length,
      reads: String(views.find((item) => item._id.equals(story._id))?.count ?? 0),
      rating: ratings.find((item) => item._id.equals(story._id))?.average?.toFixed(1) ?? '—',
    })),
    drafts: validDrafts.slice(0, 2),
    draftCount: validDrafts.length,
    draftWords: validDrafts.reduce((sum, item) => sum + item.written, 0),
    feedback: feedback.map((comment) => ({
      id: String(comment._id),
      storyId: String(comment.targetId),
      author:
        comment.authorAccountId?.status === 'active'
          ? comment.authorAccountId.displayName
          : 'Tài khoản đã ngừng hoạt động',
      canReply: stories.some(
        (story) =>
          story._id.equals(comment.targetId) &&
          story.publicationStatus === 'published' &&
          story.publishedRevisionId,
      ),
      body: comment.body,
      createdAt: comment.createdAt,
    })),
    feedbackTotal,
    writingGoal: null,
    writingStreak: null,
    ai: null,
    guild: null,
  };
}
