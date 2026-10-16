import { useRef, useState } from 'react';
import { ArrowUp } from '../../components/icons';
import { Button, Modal } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
import { apiRequest } from '../../api/client';

export function ChapterOrderDialog({ story, chapters, onClose, onSaved, onReload }) {
  const { t } = useLocale();
  const [initial] = useState(() => [...chapters].sort((a, b) => a.number - b.number));
  const [version] = useState(story.version);
  const pending = useRef(false);
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const dirty = order.some((chapter, index) => chapter.id !== initial[index].id);
  function move(index, direction) {
    if (pending.current || conflict) return;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }
  async function save() {
    if (pending.current || conflict || !dirty) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/author/stories/${story.id}/chapters/reorder`, {
        method: 'POST',
        body: {
          expectedVersion: version,
          chapters: order.map((chapter) => ({ id: chapter.id, expectedVersion: chapter.version })),
        },
      });
      onSaved();
    } catch (failure) {
      setError(failure.message || t('chapterOrder.error'));
      setConflict(failure.status === 409);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title={t('chapterOrder.title')}
      onClose={() => {
        if (!pending.current) onClose();
      }}
    >
      <p className="text-sm text-muted">{t('chapterOrder.hint')}</p>
      <ol
        aria-label={t('chapterOrder.list')}
        className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1"
      >
        {order.map((chapter, index) => (
          <li
            key={chapter.id}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-line p-3"
          >
            <span className="shrink-0 text-sm font-semibold text-brand-strong">{index + 1}</span>
            <span className="min-w-0 flex-1 break-words text-sm" title={chapter.title}>
              {chapter.title}
            </span>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || conflict || index === 0}
                aria-label={t('chapterOrder.up', { number: index + 1, title: chapter.title })}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || conflict || index === order.length - 1}
                aria-label={t('chapterOrder.down', { number: index + 1, title: chapter.title })}
                onClick={() => move(index, 1)}
              >
                <ArrowUp size={16} className="rotate-180" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-strong">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('chapterOrder.cancel')}
        </Button>
        {conflict ? (
          <Button onClick={onReload}>{t('chapterOrder.reload')}</Button>
        ) : (
          <Button disabled={busy || !dirty} onClick={save}>
            {t(busy ? 'chapterOrder.saving' : 'chapterOrder.save')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
