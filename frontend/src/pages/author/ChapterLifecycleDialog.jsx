import { useRef, useState } from 'react';
import { Button, Modal } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
import { apiRequest } from '../../api/client';

export function ChapterLifecycleDialog({ story, chapter, action, onClose, onSaved, onReload }) {
  const { t } = useLocale();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  async function confirm() {
    if (pending.current || conflict) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/author/stories/${story.id}/chapters/${chapter.id}/lifecycle`, {
        method: 'POST',
        body: { action, expectedVersion: chapter.version, expectedStoryVersion: story.version },
      });
      onSaved();
    } catch (failure) {
      setError(failure.message || t('chapterLifecycle.error'));
      setConflict(failure.status === 409);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={t(`chapterLifecycle.${action}`)}
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <p className="break-words text-sm font-semibold">{chapter.title}</p>
      <p className="mt-3 text-sm leading-6 text-muted">{t(`chapterLifecycle.${action}Hint`)}</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-strong">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('chapterLifecycle.cancel')}
        </Button>
        {conflict ? (
          <Button onClick={onReload}>{t('chapterLifecycle.reload')}</Button>
        ) : (
          <Button disabled={busy} onClick={confirm}>
            {t(busy ? 'chapterLifecycle.saving' : 'chapterLifecycle.confirm')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
