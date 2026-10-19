import { Button, Input } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
export function ChapterImageControls({ document, disabled, onChange }) {
  const { t } = useLocale();
  const images = document.blocks
    .map((block, index) => ({ block, index }))
    .filter((item) => item.block.type === 'image');
  if (!images.length) return null;
  return (
    <section
      className="mt-6 space-y-4 rounded-3xl border border-line bg-elevated p-4"
      aria-label={t('chapterImages.controls')}
    >
      <h2 className="text-base font-semibold">{t('chapterImages.controls')}</h2>
      <p className="text-sm text-muted">{t('chapterImages.draftOnly')}</p>
      {images.map(({ block, index }, number) => (
        <div key={index} className="space-y-3 border-t border-hairline pt-4">
          <p className="text-sm font-semibold">
            {t('chapterImages.number', { number: number + 1 })}
          </p>
          <label className="block text-sm">
            {t('chapterImages.alt')}
            <Input
              disabled={disabled}
              value={block.alt}
              maxLength={500}
              onChange={(event) => onChange(index, { alt: event.target.value })}
              className="mt-2 w-full"
            />
          </label>
          <label className="block text-sm">
            {t('chapterImages.caption')}
            <textarea
              rows={2}
              disabled={disabled}
              maxLength={1000}
              value={block.caption ?? ''}
              onChange={(event) => onChange(index, { caption: event.target.value })}
              className="mt-2 w-full rounded-2xl border border-line bg-surface p-3 text-sm text-ink"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(index, null)}
          >
            {t('chapterImages.remove', { number: number + 1 })}
          </Button>
        </div>
      ))}
    </section>
  );
}
