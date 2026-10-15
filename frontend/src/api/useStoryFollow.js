import { useEffect, useState } from 'react';
import { apiRequest } from './client';

// A confirmed server mutation keeps repeated story cards on the same page in sync.
const eventName = 'novelhub:story-follow-updated';
export function useStoryFollow(storyId, initialFollowing) {
  const [saved, setSaved] = useState(Boolean(initialFollowing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const update = (event) => {
      if (event.detail.id === storyId) setSaved(event.detail.following);
    };
    window.addEventListener(eventName, update);
    return () => window.removeEventListener(eventName, update);
  }, [storyId]);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const result = await apiRequest(`/reader/follows/${storyId}`, {
        method: 'PUT',
        body: { following: !saved },
      });
      if (typeof result.following !== 'boolean') throw new Error('Invalid follow response');
      setSaved(result.following);
      window.dispatchEvent(
        new CustomEvent(eventName, { detail: { id: storyId, following: result.following } }),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return { saved, busy, error, toggle };
}
