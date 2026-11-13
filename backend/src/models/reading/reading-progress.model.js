import { defineModel, mutableOptions, ObjectId, Schema } from '../shared/schema.js'

/**
 * Where one Reader is in one chapter. One row per (account, story, chapter), shared by
 * reading and listening:
 * - `paragraph` is the index of the chapter block being read (or heard). It does not
 *   depend on font size or screen width, so the same paragraph comes back on any device.
 * - `audioSeconds`/`duration` are the exact playback point when the chapter was last
 *   listened to; reading the chapter clears `audioSeconds`.
 * - `position` (0–1) = paragraph / paragraphCount, 1 once completed; author statistics
 *   read it.
 */
const schema = new Schema(
  {
    accountId: { type: ObjectId, ref: 'Account', required: true },
    storyId: { type: ObjectId, ref: 'Story', required: true },
    chapterId: { type: ObjectId, ref: 'Chapter', required: true },
    revisionId: { type: ObjectId, ref: 'ContentRevision' },
    // How the chapter was last followed: 'text' (reading) or 'audio' (listening).
    mode: { type: String, required: true },
    paragraph: { type: Number, min: 0 },
    paragraphCount: { type: Number, min: 1 },
    position: Number,
    audioSeconds: Number,
    duration: Number,
    lastReadAt: Date,
    completedAt: Date,
  },
  mutableOptions,
)
schema.index({ accountId: 1, storyId: 1, chapterId: 1 }, { unique: true })
schema.index({ accountId: 1, lastReadAt: -1 })
export const ReadingProgress = defineModel('ReadingProgress', schema, 'readingProgress')
