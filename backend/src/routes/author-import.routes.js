import { Router, raw } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { Story, Chapter, ContentRevision, ContentImport, AuditEvent } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { lockAuthor, ownStory, editable } from '../modules/author-ownership.js';
import { extractDocument } from '../modules/document-extraction.js';
import { chapterParagraphText } from '../modules/chapter-document.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const inputSchema = z
  .object({
    receipt: z.string().max(3000),
    storyId: z.string().regex(/^[a-f\d]{24}$/i),
    expectedVersion: z.number().int().min(0),
    chapters: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(200),
            paragraphs: z
              .array(chapterParagraphText)
              .min(1)
              .max(1000)
              .refine((paragraphs) => paragraphs.some((text) => text.trim())),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export function createAuthorImportRouter(config) {
  const router = Router();
  const secret = randomBytes(32);
  const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url');
  router.use('/author/imports', requireAuth(config), requireRole('author'));
  router.get('/author/imports/targets', async (req, res, next) => {
    try {
      const stories = await Story.find({
        authorAccountId: req.account._id,
        authoringFrozen: { $ne: true },
        publicationStatus: { $nin: ['submitted', 'under-review', 'archived'] },
      })
        .select('title version')
        .sort({ updatedAt: -1 })
        .lean();
      res.json({
        items: stories.map((story) => ({
          id: String(story._id),
          title: story.title,
          version: story.version,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post(
    '/author/imports/preview',
    raw({ type: 'application/octet-stream', limit: '10mb', inflate: false }),
    async (req, res, next) => {
      const controller = new AbortController();
      const abort = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on('close', abort);
      try {
        const parsed = z
          .object({ format: z.enum(['pdf', 'doc', 'docx', 'txt', 'md']) })
          .strict()
          .safeParse(req.query);
        if (!parsed.success || !Buffer.isBuffer(req.body) || !req.body.length)
          throw new HttpError(
            400,
            'invalid_document',
            'Hãy chọn PDF, DOC, DOCX, TXT hoặc MD, tối đa 10 MB.',
          );
        const checksum = digest(req.body);
        const result = await extractDocument(req.body, parsed.data.format, {
          signal: controller.signal,
        });
        const payload = Buffer.from(
          JSON.stringify({
            id: String(new mongoose.Types.ObjectId()),
            owner: String(req.account._id),
            epoch: req.account.authorizationEpoch,
            credential: req.account.credentialVersion,
            format: parsed.data.format,
            checksum,
            pageCount: result.pageCount,
            expires: Date.now() + 15 * 60 * 1000,
          }),
        ).toString('base64url');
        res.json({ ...result, format: parsed.data.format, receipt: `${payload}.${sign(payload)}` });
      } catch (error) {
        next(error);
      } finally {
        if (Buffer.isBuffer(req.body)) req.body.fill(0);
        req.body = undefined;
        res.off('close', abort);
      }
    },
  );
  router.post('/author/imports', async (req, res, next) => {
    try {
      const parsed = inputSchema.safeParse(req.body);
      if (!parsed.success)
        throw new HttpError(400, 'validation_error', 'Kiểm tra tiêu đề và nội dung các chương.');
      const input = parsed.data;
      if (
        input.chapters.reduce((total, chapter) => total + chapter.paragraphs.join('').length, 0) >
        200000
      )
        throw new HttpError(400, 'document_too_long', 'Tối đa 200.000 ký tự mỗi lần nhập.');
      const [payload, signature, extra] = input.receipt.split('.');
      const expected = sign(payload ?? '');
      if (
        extra !== undefined ||
        !signature ||
        !/^[A-Za-z0-9_-]+$/.test(signature) ||
        signature.length !== expected.length ||
        !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      )
        throw new HttpError(400, 'invalid_receipt', 'Phiên nhập không hợp lệ. Hãy chọn lại tệp.');
      let receipt;
      try {
        receipt = JSON.parse(Buffer.from(payload, 'base64url').toString());
      } catch {
        throw new HttpError(400, 'invalid_receipt', 'Phiên nhập không hợp lệ.');
      }
      if (
        receipt.owner !== String(req.account._id) ||
        receipt.epoch !== req.account.authorizationEpoch ||
        receipt.credential !== req.account.credentialVersion ||
        receipt.expires < Date.now()
      )
        throw new HttpError(409, 'expired_import', 'Phiên nhập hết hạn. Hãy chọn lại tệp.');
      const requestDigest = digest(
        JSON.stringify({ storyId: input.storyId, chapters: input.chapters }),
      );
      const result = await withTransaction(async (session) => {
        await lockAuthor(req.account, session);
        const story = await ownStory(req.account, input.storyId, session);
        const previous = await AuditEvent.find({
          actorId: req.account._id,
          action: 'content.imported',
          correlationId: receipt.id,
        })
          .sort({ _id: 1 })
          .session(session)
          .lean();
        if (previous.length) {
          if (previous.some((event) => event.dataDigest !== requestDigest))
            throw new HttpError(
              409,
              'import_conflict',
              'Tệp đã được nhập với nội dung khác. Hãy chọn lại tệp để nhập thêm.',
            );
          const revisions = await ContentRevision.find({
            _id: { $in: previous.map((event) => event.targetId) },
            storyId: story._id,
            authorAccountId: req.account._id,
          })
            .session(session)
            .lean();
          return {
            storyId: String(story._id),
            chapterIds: revisions.map((revision) => String(revision.chapterId)),
          };
        }
        editable(story);
        if (story.version !== input.expectedVersion)
          throw new HttpError(
            409,
            'version_conflict',
            'Truyện đã thay đổi. Hãy tải lại danh sách truyện trước khi nhập.',
          );
        const last = await Chapter.findOne({ storyId: story._id })
          .sort({ orderKey: -1 })
          .session(session);
        const chapterIds = [];
        const revisionIds = [];
        for (const [index, chapter] of input.chapters.entries()) {
          const chapterId = new mongoose.Types.ObjectId();
          const revisionId = new mongoose.Types.ObjectId();
          await Chapter.create(
            [
              {
                _id: chapterId,
                storyId: story._id,
                title: chapter.title,
                orderKey: Math.max(0, last?.orderKey ?? 0) + index + 1,
                draftRevisionId: revisionId,
                currentRevisionId: revisionId,
              },
            ],
            { session },
          );
          await ContentRevision.create(
            [
              {
                _id: revisionId,
                contentType: 'chapter',
                storyId: story._id,
                chapterId,
                authorAccountId: req.account._id,
                revisionNumber: 1,
                formatVersion: 'blocks-v1',
                content: {
                  title: chapter.title,
                  blocks: chapter.paragraphs.map((text) => ({ type: 'paragraph', text })),
                },
              },
            ],
            { session },
          );
          await AuditEvent.create(
            [
              {
                actorType: 'account',
                actorId: req.account._id,
                action: 'content.imported',
                targetType: 'ContentRevision',
                targetId: revisionId,
                result: 'succeeded',
                correlationId: receipt.id,
                operationType: `text-import.${receipt.format}`,
                dataDigest: requestDigest,
                reason: `source-checksum:${receipt.checksum}`,
                occurredAt: new Date(),
              },
            ],
            { session },
          );
          chapterIds.push(String(chapterId));
          revisionIds.push(String(revisionId));
        }
        if (receipt.format === 'pdf')
          await ContentImport.create(
            [
              {
                _id: receipt.id,
                accountId: req.account._id,
                storyId: story._id,
                sourceType: 'text-layer-pdf',
                checksum: receipt.checksum,
                extractionStatus: 'succeeded',
                createdRevisionId: revisionIds[0],
                formatMetadata: { pageCount: receipt.pageCount, chapterIds, revisionIds },
              },
            ],
            { session },
          );
        story.increment();
        await story.save({ session });
        return { storyId: String(story._id), chapterIds };
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });
  return router;
}
