import { Account, RoleAssignment, Story } from '../models/index.js';
import { HttpError } from '../middleware/errors.js';

export async function lockAuthor(account, session) {
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
export async function ownStory(account, id, session) {
  const story = await Story.findOne({ _id: id, authorAccountId: account._id }).session(
    session ?? null,
  );
  if (!story) throw new HttpError(404, 'not_found', 'Không tìm thấy truyện.');
  return story;
}
export function editable(story) {
  if (
    story.authoringFrozen ||
    ['submitted', 'under-review', 'archived'].includes(story.publicationStatus)
  )
    throw new HttpError(409, 'content_frozen', 'Truyện đang bị khóa chỉnh sửa.');
}
