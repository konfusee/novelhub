import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './client';

const emptyItems = Object.freeze([]);
const itemsFrom = (response) => {
  if (!Array.isArray(response.items)) throw new Error('Invalid resource response');
  return response.items;
};
const unchanged = (value) => value;

/** API state compatible with existing page UI, with no mock fallback or simulated latency. */
export function useBackendResource(path, initialData = emptyItems, select = itemsFrom) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ path: null, status: 'loading', data: initialData });
  useEffect(() => {
    const controller = new AbortController();
    apiRequest(path, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const data = select(response);
        setState({
          path,
          data,
          status: data == null || (Array.isArray(data) && !data.length) ? 'empty' : 'ready',
        });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ path, data: initialData, status: error.status === 404 ? 'empty' : 'error' });
      });
    return () => controller.abort();
  }, [path, attempt, initialData, select]);
  const retry = useCallback(() => {
    setState({ path: null, status: 'loading', data: initialData });
    setAttempt((value) => value + 1);
  }, [initialData]);
  return { ...(state.path === path ? state : { status: 'loading', data: initialData }), retry };
}

export function useBackendDocument(path, initialData) {
  return useBackendResource(path, initialData, unchanged);
}
