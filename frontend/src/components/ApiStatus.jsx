import { useEffect, useState } from 'react';
import { apiGet } from '../api/client.js';

const LABELS = {
  checking: 'Checking API…',
  ready: 'API and database ready',
  'not-ready': 'API is up, database not ready',
  unreachable: 'API unreachable',
};

export function ApiStatus() {
  const [state, setState] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();
    apiGet('/ready', { signal: controller.signal })
      .then(({ status, data }) => {
        if (status === 0) setState('unreachable');
        else setState(data?.status === 'ready' ? 'ready' : 'not-ready');
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <p role="status" data-state={state}>
      {LABELS[state]}
    </p>
  );
}
