import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';

export const AUTHOR_APPLICATION_STATUSES = ['submitted', 'approved', 'rejected'];
const schema = new Schema(
  {
    applicantAccountId: { type: ObjectId, ref: 'Account', required: true },
    status: {
      type: String,
      enum: AUTHOR_APPLICATION_STATUSES,
      default: 'submitted',
      required: true,
    },
    submittedAt: { type: Date, required: true, default: Date.now },
    decidedAt: Date,
    decidedBy: { type: ObjectId, ref: 'Account' },
    decisionReason: { type: String, trim: true, maxlength: 1000 },
    evidenceRefs: [{ type: ObjectId }],
  },
  mutableOptions,
);
schema.index({ applicantAccountId: 1, submittedAt: -1 });
schema.index({ status: 1, submittedAt: 1 });
export const AuthorApplication = defineModel('AuthorApplication', schema, 'authorApplications');
