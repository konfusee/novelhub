export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Calls the NovelHub API. Resolves to `{ ok, status, data }` so screens can
 * render success, failure and unknown states without inventing behavior.
 */
export async function apiGet(path, { signal } = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', signal });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { ok: false, status: 0, data: null };
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'network_error' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error?.message || 'Yêu cầu không thành công.', {
      status: response.status,
      code: data?.error?.code,
    });
  }
  return data;
}
