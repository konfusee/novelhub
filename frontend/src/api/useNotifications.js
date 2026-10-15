import { useEffect, useState } from 'react';
import { apiRequest } from './client';

export function useNotifications() {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState({
    status: 'loading',
    data: [],
    hasMore: false,
    unreadCount: 0,
  });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      Array.from({ length: page }, (_, index) =>
        apiRequest(`/reader/notifications?page=${index + 1}`, { signal: controller.signal }),
      ),
    )
      .then((pages) => {
        if (controller.signal.aborted) return;
        if (
          pages.some(
            (response) =>
              !Array.isArray(response.items) ||
              typeof response.hasMore !== 'boolean' ||
              !Number.isInteger(response.unreadCount),
          )
        )
          throw new Error('Invalid notifications response');
        setState({
          status: 'ready',
          data: [
            ...new Map(
              pages
                .flatMap((response) => response.items)
                .map((item) => [
                  item.id,
                  { ...item, time: new Date(item.createdAt).toLocaleString('vi-VN') },
                ]),
            ).values(),
          ],
          hasMore: pages[pages.length - 1].hasMore,
          unreadCount: pages[0].unreadCount,
        });
        if (attempt > 0) window.dispatchEvent(new Event('novelhub:notifications-updated'));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({ ...previous, status: 'error', error: error.message }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [page, attempt]);
  const retry = () => {
    setBusy(true);
    setError('');
    setAttempt((value) => value + 1);
  };
  const write = async (path, method, body) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      await apiRequest(path, { method, body });
      setAttempt((value) => value + 1);
      return true;
    } catch (error) {
      setError(error.message);
      setBusy(false);
      return false;
    }
  };
  const loadMore = () => {
    if (!busy && state.hasMore) {
      setBusy(true);
      setPage((value) => value + 1);
    }
  };
  return { ...state, busy, actionError: error, write, retry, loadMore };
}
