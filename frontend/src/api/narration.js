import { API_BASE, apiRequest } from './client'

/* While a narration is `processing` the player re-reads its status at this interval. */
export const NARRATION_POLL_MS = 3000

const narrationPath = (storyId, chapterId) =>
  `/reader/narration/${encodeURIComponent(storyId)}/${encodeURIComponent(chapterId)}`

/* GET: read-only status (also advances a processing job on the server). Canonical ids only. */
export const fetchNarration = (storyId, chapterId, { signal } = {}) =>
  apiRequest(narrationPath(storyId, chapterId), { signal }).then(response => response.narration)

/* POST: starts generation on first play or retries after `failed`; idempotent otherwise. */
export const startNarration = (storyId, chapterId, { signal } = {}) =>
  apiRequest(narrationPath(storyId, chapterId), { method: 'POST', body: {}, signal }).then(
    response => response.narration,
  )

/* `audioUrl` is relative to the API base; cookies travel with the same-origin request. */
export const narrationSource = audioUrl => `${API_BASE}${audioUrl}`

/* PUT /reader/progress while listening: the paragraph heard plus the exact playback second. */
export const saveListenProgress = ({
  storyId,
  chapterId,
  paragraph,
  paragraphCount,
  audioSeconds,
  duration,
  completed,
}) =>
  apiRequest('/reader/progress', {
    method: 'PUT',
    body: {
      storyId,
      chapterId,
      paragraph,
      paragraphCount,
      audioSeconds,
      ...(duration ? { duration } : {}),
      ...(completed ? { completed: true } : {}),
    },
  })
