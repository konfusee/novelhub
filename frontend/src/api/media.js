import { API_BASE } from './client';
export const privateMediaUrl = (id) => `${API_BASE}/author/media/${encodeURIComponent(id)}/content`;
export const submittedMediaUrl = (submissionId, mediaId) =>
  `${API_BASE}/author/submissions/${encodeURIComponent(submissionId)}/media/${encodeURIComponent(mediaId)}/content`;
