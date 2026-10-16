import { API_BASE } from './client';
export const privateMediaUrl = (id) => `${API_BASE}/author/media/${encodeURIComponent(id)}/content`;
