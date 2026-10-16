import { useState } from 'react';
import { useBackendDocument } from '../../api/useBackendResource';
import { privateMediaUrl } from '../../api/media';
import { useLocale } from '../../context/LocaleContext';
import { Button, ButtonLink, Input, Modal } from '../../components/ui';
const empty = { items: [], nextCursor: null };
export function ChapterImagePicker({ storyId, onClose, onAdd }) {
  const { t } = useLocale();
  const [cursor, setCursor] = useState('');
  const [previous, setPrevious] = useState([]);
  const resource = useBackendDocument(`/author/media${cursor ? `?cursor=${cursor}` : ''}`, empty);
  const [selected, setSelected] = useState(null);
  const [alt, setAlt] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const items = [...previous, ...resource.data.items].filter(
    (asset) => asset.url && (!asset.storyId || asset.storyId === storyId),
  );
  return (
    <Modal open title={t('chapterImages.title')} onClose={onClose}>
      <p className="text-sm leading-6 text-muted">{t('chapterImages.hint')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ButtonLink
          to={`/author/media?storyId=${storyId}`}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          size="sm"
        >
          {t('chapterImages.library')}
        </ButtonLink>
        <Button
          variant="secondary"
          size="sm"
          disabled={resource.status === 'loading'}
          onClick={() => {
            setPrevious([]);
            setCursor('');
            setSelected(null);
            resource.retry();
          }}
        >
          {t('mediaData.refresh')}
        </Button>
      </div>
      {resource.status === 'loading' && (
        <p role="status" className="mt-3 text-sm">
          {t('chapterImages.loading')}
        </p>
      )}
      {resource.status === 'error' && (
        <p role="alert" className="mt-3 text-sm text-rose-strong">
          {resource.error?.message}
        </p>
      )}
      <div className="mt-4 grid max-h-64 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
        {items.map((asset) => (
          <button
            key={asset.id}
            type="button"
            aria-label={t('chapterImages.pick', { name: asset.name })}
            aria-pressed={selected === asset.id}
            onClick={() => {
              setSelected(asset.id);
              setError('');
            }}
            className={`min-w-0 rounded-2xl border p-2 text-left ${selected === asset.id ? 'border-brand bg-brand-soft' : 'border-line bg-elevated'}`}
          >
            <img
              src={privateMediaUrl(asset.id)}
              crossOrigin="use-credentials"
              alt=""
              loading="lazy"
              className="h-24 w-full object-contain"
            />
            <span className="mt-2 block truncate text-xs">{asset.name}</span>
          </button>
        ))}
      </div>
      {resource.status === 'ready' && !items.length && (
        <p className="mt-3 text-sm text-muted">{t('chapterImages.empty')}</p>
      )}
      {resource.data.nextCursor && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={() => {
            setPrevious([...previous, ...resource.data.items]);
            setCursor(resource.data.nextCursor);
          }}
        >
          {t('mediaData.more')}
        </Button>
      )}
      <label className="mt-4 block text-sm font-semibold">
        {t('chapterImages.alt')}
        <Input
          className="mt-2 w-full"
          value={alt}
          maxLength={500}
          onChange={(event) => setAlt(event.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        {t('chapterImages.caption')}
        <textarea
          rows={2}
          maxLength={1000}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-line bg-surface p-3 text-sm text-ink"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-strong">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('mediaData.cancel')}
        </Button>
        <Button
          disabled={!selected || resource.status === 'loading'}
          onClick={() => {
            if (!alt.trim()) {
              setError(t('chapterImages.altRequired'));
              return;
            }
            if (!onAdd({ type: 'image', mediaId: selected, alt: alt.trim(), caption }))
              setError(t('chapterImages.limit'));
          }}
        >
          {t('chapterImages.add')}
        </Button>
      </div>
    </Modal>
  );
}
