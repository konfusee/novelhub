import { digest } from '../submissions/submission-digests.js'
import { imageManifest } from './author-chapter-media.js'

// A story package with a cover or banner freezes them as role-tagged manifest entries. Story
// packages without images, and legacy ones frozen before this format, carry no manifest.
export const STORY_MEDIA_MANIFEST = 'story-media-v1'
export const STORY_MEDIA_VALIDATOR = 'publishing-story-images-v1'

/** The cover and banner a story revision references, in manifest order. */
export function storyImageRefs(content) {
  return [
    ['cover', content?.coverMediaId],
    ['banner', content?.coverBannerMediaId],
  ]
    .filter(([, mediaId]) => mediaId)
    .map(([role, mediaId]) => ({ mediaId: String(mediaId).toLowerCase(), role }))
}

export function inspectStoryImages(config, account, storyId, content, session) {
  return storyImageSnapshot(config, account, storyId, content, session, false)
}

// Runs within the submission transaction, after the owner account lock.
export function pinStoryImages(config, account, storyId, content, session) {
  return storyImageSnapshot(config, account, storyId, content, session, true)
}

async function storyImageSnapshot(config, account, storyId, content, session, pin) {
  const refs = storyImageRefs(content)
  if (!refs.length) return null
  const manifest = await imageManifest(config, account, storyId, refs, session, pin)
  return {
    mediaDigest: digest(manifest),
    validation: { mediaManifestVersion: STORY_MEDIA_MANIFEST, mediaManifest: manifest },
  }
}
