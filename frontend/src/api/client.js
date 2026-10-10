const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

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
