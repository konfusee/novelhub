import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { withTransaction } from '../src/db/connection.js';
import { hashPassword } from '../src/auth/password.js';
import {
  Account,
  AuditEvent,
  AuthorRevenueRate,
  Category,
  Chapter,
  Comment,
  ContentReport,
  ContentRevision,
  Follow,
  LedgerEntry,
  Notification,
  PolicyVersion,
  PublicationSubmission,
  ReadingProgress,
  RoleAssignment,
  Wallet,
  TopUpPackage,
  Story,
} from '../src/models/index.js';
import { categories } from './reference/categories.js';
import {
  extendedStories,
  hiddenGems,
  featuredStories,
  stories as homeStories,
} from './reference/stories.js';
import { searchResults } from './reference/search.js';
import { authorStories, managedChapters } from './reference/author.js';
import {
  chapterPreview,
  previewParagraphs,
  fullChapter,
  libraryItems,
  readerHome,
  storyDetail,
} from './reference/reader.js';
import { adminUsers } from './reference/admin.js';
import { communityReports, submissionQueue } from './reference/moderation.js';
import { notifications } from './reference/notifications.js';
import { coinPackages } from './reference/wallet.js';
import { popularTags } from './reference/categories.js';
import { catalogPresentation } from '../src/modules/catalog-presentation.js';

const namespace = 'novelhub-reference-v1';
const seedId = (key) =>
  new mongoose.Types.ObjectId(
    createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 24),
  );
const keyFor = (value) => value.normalize('NFC').trim().toLocaleLowerCase('vi');
const genres = {
  Fantasy: 'Kỳ ảo',
  Romance: 'Lãng mạn',
  Mystery: 'Bí ẩn',
  'Sci-Fi': 'Khoa học viễn tưởng',
  Adventure: 'Phiêu lưu',
  Drama: 'Chính kịch',
  'Slice of Life': 'Đời thường',
  History: 'Lịch sử',
  Horror: 'Kinh dị',
};

/** Idempotent, insert-only development data. No schema modifications, deletes or real payments. */
export async function seedReferenceData({ password, readerEmail = 'reader@seed.novelhub.local' }) {
  if (!password || password.length < 10)
    throw new Error('A development seed password of at least 10 characters is required');
  const passwordHash = await hashPassword(password);
  return withTransaction(async (session) => {
    const references = [
      ...extendedStories,
      ...hiddenGems,
      ...searchResults,
      ...readerHome.recommendations,
      ...authorStories,
      ...submissionQueue,
    ];
    const aliases = new Map([['demo', 'The Silent Forest']]);
    for (const item of references) {
      if (item.id) aliases.set(item.id, item.title);
      aliases.set(
        item.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, ''),
        item.title,
      );
    }
    for (const [alias, title] of aliases)
      await catalogPresentation().updateOne(
        { _id: `alias:${alias}` },
        { $setOnInsert: { storyId: seedId(`story:${keyFor(title)}`) } },
        { upsert: true, session },
      );
    await catalogPresentation().updateOne(
      { _id: 'home-layout' },
      {
        $setOnInsert: {
          featured: featuredStories,
          storyIds: homeStories.map((item) => seedId(`story:${keyFor(item.title)}`)),
        },
      },
      { upsert: true, session },
    );
    // This marker is written last in the same transaction as the whole import.
    // A completed import is immutable; later user edits are never overwritten.
    if (await AuditEvent.exists({ _id: seedId('import-audit') }).session(session)) return {};
    const counts = {};
    const ensure = async (Model, key, fields) => {
      const _id = seedId(key);
      const existing = await Model.findById(_id).session(session);
      if (existing) return existing;
      const [created] = await Model.create([{ _id, ...fields }], { session });
      counts[Model.collection.name] = (counts[Model.collection.name] ?? 0) + 1;
      return created;
    };
    const account = async (name, role = 'reader', email) => {
      const user = await ensure(Account, `account:${keyFor(name)}`, {
        displayName: name,
        email:
          email ??
          `${createHash('sha256').update(name).digest('hex').slice(0, 12)}@seed.novelhub.local`,
        status: 'active',
        emailVerifiedAt: new Date(),
        everAuthor: role === 'author',
        password: { hash: passwordHash, algorithm: 'scrypt', updatedAt: new Date() },
      });
      if (role !== 'reader')
        await ensure(RoleAssignment, `role:${keyFor(name)}`, {
          accountId: user._id,
          role,
          grantedBy: user._id,
        });
      return user;
    };
    const admin = await account('Reference Admin', 'admin', 'admin@seed.novelhub.local');
    const reader = await account('Reference Reader', 'reader', readerEmail);
    await account('Reference Moderator', 'moderator', 'moderator@seed.novelhub.local');
    for (const item of adminUsers) {
      if (item.name === 'Mira Lane') continue;
      await account(
        item.name,
        item.role === 'Admin'
          ? 'admin'
          : item.role === 'Moderator'
            ? 'moderator'
            : item.role === 'Author'
              ? 'author'
              : 'reader',
      );
    }
    const policy = await ensure(PolicyVersion, 'policy', {
      actorAccountId: admin._id,
      status: 'effective',
      effectiveAt: new Date('2026-01-01T00:00:00Z'),
    });
    const categoryMap = new Map();
    for (const [sortKey, item] of categories.entries()) {
      const existing = await Category.findOne({ normalizedName: keyFor(item.name) }).session(
        session,
      );
      const category =
        existing ??
        (await ensure(Category, `category:${keyFor(item.name)}`, {
          name: item.name,
          normalizedName: keyFor(item.name),
          createdBy: admin._id,
          sortKey,
        }));
      categoryMap.set(item.name, category._id);
      await catalogPresentation().updateOne(
        { _id: category._id },
        {
          $setOnInsert: {
            description: item.description,
            icon: item.icon,
            tone: item.tone,
            referenceCount: item.count,
          },
        },
        { upsert: true, session },
      );
    }
    const catalog = new Map();
    for (const item of [
      ...extendedStories,
      ...hiddenGems,
      ...searchResults,
      ...readerHome.recommendations,
      ...authorStories,
      ...submissionQueue,
    ]) {
      if (!catalog.has(keyFor(item.title))) catalog.set(keyFor(item.title), item);
    }
    const ownStatus = new Map(authorStories.map((item) => [keyFor(item.title), item.status]));
    const stories = new Map();
    const authors = new Map();
    for (const [key, item] of catalog) {
      const authorName = item.author ?? 'Mira Lane';
      const author = await account(
        authorName,
        'author',
        authorName === 'Mira Lane' ? 'author@seed.novelhub.local' : undefined,
      );
      authors.set(keyFor(authorName), author);
      const status =
        ownStatus.get(key) === 'Draft'
          ? 'draft'
          : ownStatus.get(key) === 'In Review' ||
              submissionQueue.some((row) => keyFor(row.title) === key)
            ? 'submitted'
            : 'published';
      const names = (item.genres ?? [item.genre ?? 'Fantasy'])
        .map((name) => genres[name] ?? name)
        .filter((name) => categoryMap.has(name));
      const categoryIds = (names.length ? names : ['Kỳ ảo']).map((name) => categoryMap.get(name));
      const description =
        item.description ??
        (item.title === storyDetail.title
          ? storyDetail.synopsis
          : `Bản tham khảo được nhập từ dữ liệu frontend cũ: ${item.title}.`);
      const revisionId = seedId(`story-revision:${key}`);
      const story = await ensure(Story, `story:${key}`, {
        authorAccountId: author._id,
        title: item.title,
        description,
        categoryIds,
        publicationStatus: status,
        completionStatus: item.status === 'Completed' ? 'completed' : 'ongoing',
        draftRevisionId: revisionId,
        currentRevisionId: revisionId,
        ...(status === 'published'
          ? { publishedRevisionId: revisionId, publishedAt: new Date('2026-10-01T00:00:00Z') }
          : {}),
      });
      await ensure(ContentRevision, `story-revision:${key}`, {
        contentType: 'story',
        storyId: story._id,
        authorAccountId: author._id,
        revisionNumber: 1,
        formatVersion: 'story-v1',
        content: { title: item.title, description, categoryIds: categoryIds.map(String) },
        status: status === 'draft' ? 'editable' : status === 'submitted' ? 'submitted' : 'approved',
        ...(status === 'draft' ? {} : { immutableAt: new Date() }),
      });
      if (status === 'submitted')
        await ensure(PublicationSubmission, `submission:${key}`, {
          storyId: story._id,
          revisionId,
          authorAccountId: author._id,
          status: 'pending-review',
        });
      stories.set(key, story);
      // Use actual chapter records, not synthetic counts such as "148 chapters".
      const sourceChapters =
        item.title === 'The Silent Forest'
          ? [...chapterPreview, ...managedChapters]
          : [{ number: 1, title: `${item.title} — Chương mở đầu`, free: true }];
      const seen = new Set();
      for (const source of sourceChapters) {
        if (seen.has(source.number)) continue;
        seen.add(source.number);
        const chapterKey = `${key}:${source.number}`;
        const chapterStatus =
          status === 'published' && source.status !== 'Draft' && source.status !== 'Scheduled'
            ? 'published'
            : 'draft';
        const chapterRevisionId = seedId(`chapter-revision:${chapterKey}`);
        const chapter = await ensure(Chapter, `chapter:${chapterKey}`, {
          storyId: story._id,
          orderKey: source.number,
          title: source.title,
          status: chapterStatus,
          draftRevisionId: chapterRevisionId,
          currentRevisionId: chapterRevisionId,
          ...(chapterStatus === 'published'
            ? {
                publishedRevisionId: chapterRevisionId,
                firstReleasedAt: new Date('2026-10-01T00:00:00Z'),
                publishedAt: new Date('2026-10-01T00:00:00Z'),
              }
            : {}),
        });
        const paragraphs =
          item.title === 'The Silent Forest' && source.number === fullChapter.number
            ? fullChapter.paragraphs
            : previewParagraphs;
        await ensure(ContentRevision, `chapter-revision:${chapterKey}`, {
          contentType: 'chapter',
          storyId: story._id,
          chapterId: chapter._id,
          authorAccountId: author._id,
          revisionNumber: 1,
          formatVersion: 'blocks-v1',
          content: {
            title: source.title,
            blocks: paragraphs.map((text) => ({ type: 'paragraph', text })),
          },
          status: chapterStatus === 'published' ? 'approved' : 'editable',
          ...(chapterStatus === 'published' ? { immutableAt: new Date() } : {}),
        });
      }
    }
    for (const [index, source] of libraryItems.entries()) {
      const story = stories.get(keyFor(source.title));
      if (!story) continue;
      await ensure(Follow, `follow:${story._id}`, { accountId: reader._id, storyId: story._id });
      const chapter = await Chapter.findOne({ storyId: story._id, status: 'published' })
        .sort({ orderKey: 1 })
        .session(session);
      if (chapter)
        await ensure(ReadingProgress, `progress:${story._id}`, {
          accountId: reader._id,
          storyId: story._id,
          chapterId: chapter._id,
          revisionId: chapter.publishedRevisionId,
          mode: 'text',
          position: source.progress / 100,
          lastReadAt: new Date(Date.now() - index * 3600000),
        });
    }
    for (const item of notifications)
      await ensure(Notification, `notification:${item.id}`, {
        recipientAccountId: reader._id,
        eventType: `reference.${item.type}`,
        sourceEventKey: `${namespace}:${item.id}`,
        payload: { title: item.title, body: item.body, label: item.label },
        ...(item.unread ? {} : { readAt: new Date() }),
      });
    const forest = stories.get(keyFor('The Silent Forest'));
    await catalogPresentation().updateOne(
      { _id: 'curation' },
      {
        $setOnInsert: {
          gems: hiddenGems.map((item) => stories.get(keyFor(item.title))?._id).filter(Boolean),
          tags: popularTags,
        },
      },
      { upsert: true, session },
    );
    if (forest) {
      await ensure(Comment, 'comment:forest', {
        authorAccountId: reader._id,
        targetType: 'story',
        targetId: forest._id,
        body: 'Một bình luận tham khảo được nhập từ dữ liệu cũ để kiểm tra cộng đồng.',
      });
      for (const item of communityReports)
        await ensure(ContentReport, `report:${item.id}`, {
          reporterAccountId: reader._id,
          targetType: 'story',
          targetId: forest._id,
          targetSnapshot: { title: item.title, excerpt: item.excerpt, source: namespace },
          status: item.status === 'In Review' ? 'under-review' : 'open',
        });
    }
    for (const item of coinPackages)
      await ensure(TopUpPackage, `package:${item.id}`, {
        priceVnd: item.coins,
        coinAmount: item.coins,
        status: 'active',
        policyVersionId: policy._id,
        actorAccountId: admin._id,
      });
    const credit = async (owner, purpose, amount) => {
      const wallet = await ensure(Wallet, `wallet:${owner._id}:${purpose}`, {
        ownerType: 'account',
        ownerId: owner._id,
        purpose,
        availableBalance: amount,
      });
      await ensure(LedgerEntry, `ledger:${wallet._id}`, {
        walletId: wallet._id,
        ledgerType: 'adjustment',
        direction: 'credit',
        amount,
        reason: 'Dữ liệu khởi tạo tham khảo từ frontend cũ; không phải giao dịch ngân hàng.',
        actorAccountId: admin._id,
        sourceType: 'reference-import',
        sourceId: seedId('import-audit'),
        idempotencyScope: { operation: 'reference-seed', ownerId: owner._id, key: namespace },
      });
    };
    await credit(reader, 'reader-coins', 1420);
    const mira = authors.get(keyFor('Mira Lane'));
    if (mira) {
      await credit(mira, 'author-earnings', 48250);
      await ensure(AuthorRevenueRate, `rate:${mira._id}`, {
        authorAccountId: mira._id,
        percentage: policy.authorSharePercent,
        effectiveAt: policy.effectiveAt,
        actorAccountId: admin._id,
        policyVersionId: policy._id,
      });
    }
    await ensure(AuditEvent, 'import-audit', {
      actorType: 'account',
      actorId: admin._id,
      action: 'reference-data.import',
      targetType: 'Account',
      targetId: admin._id,
      result: 'success',
      reason: 'Imported frontend reference data using existing schemas',
      occurredAt: new Date(),
    });
    return counts;
  });
}
