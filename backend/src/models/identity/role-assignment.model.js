import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
import { Account } from './account.model.js';

export const ROLES = ['author', 'moderator', 'admin'];
export const ROLE_ASSIGNMENT_STATUSES = ['active', 'revoked'];
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    role: { type: String, enum: ROLES, required: true },
    staffSlot: { type: String, enum: ['staff'], required: true, default: 'staff' },
    status: { type: String, enum: ROLE_ASSIGNMENT_STATUSES, default: 'active', required: true },
    grantedBy: { type: ObjectId, ref: 'Account', required: true },
    grantedAt: { type: Date, required: true, default: Date.now },
    revokedAt: Date,
  },
  mutableOptions,
);
schema.pre('validate', function normalizeStaffSlot() {
  if (ROLES.includes(this.role)) this.staffSlot = 'staff';
});
schema.pre('validate', async function preventFormerAuthorModerator() {
  if (this.role !== 'moderator' || this.status !== 'active') return;
  const account = await Account.findById(this.accountId).select('everAuthor');
  if (account?.everAuthor) this.invalidate('role', 'An account that ever held Author cannot become Moderator');
});
schema.index(
  { accountId: 1, staffSlot: 1 },
  { unique: true, partialFilterExpression: { status: 'active', staffSlot: 'staff' } },
);
schema.index({ role: 1, status: 1 });
export const RoleAssignment = defineModel('RoleAssignment', schema, 'roleAssignments');
