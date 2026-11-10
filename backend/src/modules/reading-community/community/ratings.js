import mongoose from 'mongoose'
import { Rating } from '../../../models/index.js'
import { ownerWrite } from '../reading/owner-write.js'
import { requirePublishedStory } from './common.js'

async function ratingSummary(storyId, session) {
  const [row] = await Rating.aggregate([
    { $match: { storyId: new mongoose.Types.ObjectId(storyId), status: 'active' } },
    { $group: { _id: null, average: { $avg: '$value' }, count: { $sum: 1 } } },
  ]).session(session)
  return {
    average: row ? Math.round(row.average * 10) / 10 : null,
    count: row?.count ?? 0,
  }
}

/** Sets (value 1..5) or removes (value null) the reader's single rating of a published story. */
export async function setRating(req, storyId, value, now = new Date()) {
  await requirePublishedStory(storyId)
  return ownerWrite(req, async (session, account) => {
    const rating = await Rating.findOne({ accountId: account._id, storyId }).session(session)
    if (value != null) {
      if (!rating) await Rating.create([{ accountId: account._id, storyId, value }], { session })
      else if (rating.status !== 'active' || rating.value !== value) {
        rating.value = value
        rating.status = 'active'
        rating.removedAt = undefined
        await rating.save({ session })
      }
    } else if (rating?.status === 'active') {
      rating.status = 'removed'
      rating.removedAt = now
      await rating.save({ session })
    }
    return { value, ...(await ratingSummary(storyId, session)) }
  })
}
