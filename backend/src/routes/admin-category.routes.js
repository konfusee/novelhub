import { Router } from 'express';
import { z } from 'zod';
import { Account, AuditEvent, Category, RoleAssignment } from '../models/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../db/connection.js';

const categoryInput = z.object({ name: z.string().trim().min(1).max(100) }).strict();
export function createAdminCategoryRouter(config) {
  const router = Router();
  router.use('/admin/categories', requireAuth(config), requireRole('admin'));
  router.get('/admin/categories', async (_req, res, next) => {
    try {
      const items = await Category.find()
        .sort({ sortKey: 1, name: 1 })
        .select('name status version')
        .lean();
      res.json({
        items: items.map((item) => ({
          id: String(item._id),
          name: item.name,
          status: item.status,
          version: item.version,
        })),
      });
    } catch (error) {
      next(error);
    }
  });
  router.post('/admin/categories', async (req, res, next) => {
    try {
      const parsed = categoryInput.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'validation_error', 'Hãy nhập tên thể loại.');
      const category = await withTransaction(async (session) => {
        const locked = await Account.findOneAndUpdate(
          {
            _id: req.account._id,
            status: 'active',
            authorizationEpoch: req.account.authorizationEpoch,
            credentialVersion: req.account.credentialVersion,
          },
          { $inc: { version: 1 } },
          { session, returnDocument: 'after' },
        );
        const role = await RoleAssignment.exists({
          accountId: req.account._id,
          status: 'active',
          role: 'admin',
        }).session(session);
        if (!locked || !role)
          throw new HttpError(403, 'forbidden', 'Quyền quản trị không còn hiệu lực.');
        const [created] = await Category.create(
          [
            {
              name: parsed.data.name,
              normalizedName: parsed.data.name.normalize('NFC').toLocaleLowerCase('vi'),
              createdBy: req.account._id,
            },
          ],
          { session },
        );
        await AuditEvent.create(
          [
            {
              actorType: 'account',
              actorId: req.account._id,
              action: 'category.create',
              targetType: 'Category',
              targetId: created._id,
              targetVersion: created.version,
              result: 'success',
              occurredAt: new Date(),
            },
          ],
          { session },
        );
        return created;
      });
      res
        .status(201)
        .json({
          category: { id: String(category._id), name: category.name, status: category.status },
        });
    } catch (error) {
      next(
        error.code === 11000
          ? new HttpError(409, 'duplicate_category', 'Thể loại đã tồn tại.')
          : error,
      );
    }
  });
  return router;
}
