import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from './client';

const empty = {
  categories: [],
  collections: { fantasy: [], romance: [], scifi: [], gems: [] },
  tags: [],
};
/** Keeps the existing page's loading/empty/error contract; never falls back to fixtures. */
export function useDiscoveryData() {
  const [state, setState] = useState({ status: 'loading', value: empty });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/catalog/discovery', { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        if (
          !Array.isArray(value.categories) ||
          !Array.isArray(value.tags) ||
          !value.collections ||
          !['fantasy', 'romance', 'scifi', 'gems'].every((key) =>
            Array.isArray(value.collections[key]),
          )
        ) {
          throw new Error('Invalid discovery response');
        }
        setState({ status: 'ready', value });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error', value: empty });
      });
    return () => controller.abort();
  }, [attempt]);
  const retry = useCallback(() => {
    setState({ status: 'loading', value: empty });
    setAttempt((value) => value + 1);
  }, []);
  const { status, value } = state;
  return {
    catalog: {
      status: status === 'ready' && !value.categories.length ? 'empty' : status,
      data: value.categories,
      retry,
    },
    curated: {
      status:
        status === 'ready' && Object.values(value.collections).every((items) => !items.length)
          ? 'empty'
          : status,
      data: value.collections,
      retry,
    },
    tags: value.tags,
  };
}
