import { apiRequest } from './client'

const targetPaths = { story: 'stories', chapter: 'chapters' }

const commentsPath = (targetType, targetId) => {
  const segment = targetPaths[targetType]
  if (!segment) throw new Error(`Unsupported comment target: ${targetType}`)
  return `/community/${segment}/${encodeURIComponent(targetId)}/comments`
}

export const followStory = (storyId, following) =>
  apiRequest(`/community/stories/${encodeURIComponent(storyId)}/follow`, {
    method: 'PUT',
    body: { following },
  })

export const rateStory = (storyId, value) =>
  apiRequest(`/community/stories/${encodeURIComponent(storyId)}/rating`, {
    method: 'PUT',
    body: { value },
  })

export const clearRating = storyId =>
  apiRequest(`/community/stories/${encodeURIComponent(storyId)}/rating`, { method: 'DELETE' })

export const listComments = (targetType, targetId, page = 1, signal) =>
  apiRequest(`${commentsPath(targetType, targetId)}?page=${page}`, { signal })

export const postComment = (targetType, targetId, { body, parentId }) =>
  apiRequest(commentsPath(targetType, targetId), {
    method: 'POST',
    body: parentId ? { body, parentId } : { body },
  })

export const editComment = (id, { body, expectedVersion }) =>
  apiRequest(`/community/comments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: { body, expectedVersion },
  })

export const deleteComment = id =>
  apiRequest(`/community/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const likeComment = (id, liked) =>
  apiRequest(`/community/comments/${encodeURIComponent(id)}/like`, {
    method: 'PUT',
    body: { liked },
  })

export const reportContent = ({ targetType, targetId, reason, details }) =>
  apiRequest('/community/reports', {
    method: 'POST',
    body: details ? { targetType, targetId, reason, details } : { targetType, targetId, reason },
  })
