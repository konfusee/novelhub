import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js';
export const CATEGORY_STATUSES = ['active', 'retired'];
const schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: CATEGORY_STATUSES, default: 'active', required: true },
    sortKey: { type: Number, required: true, default: 0 },
    createdBy: { type: ObjectId, ref: 'Account', required: true },
    retiredAt: Date,
  },
  mutableOptions,
);
schema.index({ normalizedName: 1 }, { unique: true });
schema.index({ status: 1, sortKey: 1 });
export const Category = defineModel('Category', schema, 'categories');
