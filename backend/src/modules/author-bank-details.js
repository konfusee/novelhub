import { Account, AuditEvent } from '../models/index.js';
import { withTransaction } from '../db/connection.js';
import { HttpError } from '../middleware/errors.js';
import { lockAuthor } from './author-ownership.js';
import { digest } from './submission-digests.js';

const view = (account) => ({
  version: account.version,
  bank: account.bankDetails
    ? {
        bankName: account.bankDetails.bankName,
        accountNumber: account.bankDetails.accountNumber,
        accountHolder: account.bankDetails.accountHolder,
      }
    : null,
});
export async function authorBankDetails(accountId) {
  const account = await Account.findById(accountId).select('version +bankDetails');
  if (!account) throw new HttpError(404, 'not_found', 'Không tìm thấy tài khoản.');
  return view(account);
}
export async function saveAuthorBankDetails(actor, input) {
  return withTransaction(async (session) => {
    await lockAuthor(actor, session);
    const account = await Account.findOne({ _id: actor._id, version: input.expectedVersion + 1 })
      .select('+bankDetails')
      .session(session);
    if (!account)
      throw new HttpError(
        409,
        'stale_account',
        'Thông tin tài khoản đã thay đổi. Hãy tải lại trước khi lưu.',
      );
    account.bankDetails = input.bank;
    await account.save({ session });
    await AuditEvent.create(
      [
        {
          actorType: 'account',
          actorId: actor._id,
          action: 'author.bank-details.updated',
          targetType: 'Account',
          targetId: actor._id,
          targetVersion: account.version,
          result: 'accepted',
          occurredAt: new Date(),
          dataDigest: digest(input.bank),
        },
      ],
      { session },
    );
    return view(account);
  });
}
