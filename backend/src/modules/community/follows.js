import { Follow } from '../../models/index.js'
import { ownerWrite } from '../reading/owner-write.js'
import { requirePublishedStory } from './common.js'

/** Follows or unfollows a published story; returns the viewer state and active follower count. */
export async function setFollow(req, storyId, following, now = new Date()) {
  await requirePublishedStory(storyId)
  return ownerWrite(req, async (session, account) => {
    const follow = await Follow.findOne({ accountId: account._id, storyId }).session(session)
    if (following) {
      if (!follow) await Follow.create([{ accountId: account._id, storyId }], { session })
      else if (follow.status !== 'active') {
        follow.status = 'active'
        follow.removedAt = undefined
        await follow.save({ session })
      }
    } else if (follow?.status === 'active') {
      follow.status = 'removed'
      follow.removedAt = now
      await follow.save({ session })
    }
    const followers = await Follow.countDocuments({ storyId, status: 'active' }).session(session)
    return { following, followers }
  })
}
