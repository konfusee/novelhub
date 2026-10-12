import { Button } from '../ui';
import { useLocale } from '../../context/LocaleContext';

const SEARCH_STATUSES = ['allStatuses', 'ongoing', 'completedOnly'];

const groups = [
  {
    title: 'search.contentType',
    items: [
      ['Stories', 'search.stories', '124'],
      ['Audiobooks', 'search.audiobooks', '42'],
      ['Authors', 'search.authors', '18'],
    ],
  },
  {
    title: 'search.genres',
    items: [
      ['Fantasy', 'genres.fantasy', '82'],
      ['Romance', 'genres.romance', '54'],
      ['Mystery & Thriller', 'genres.mysterythriller', '29'],
      ['Sci-Fi', 'genres.scifi', '21'],
      ['Adventure', 'genres.adventure', '18'],
    ],
  },
  {
    title: 'search.format',
    items: [
      ['Text Story', 'search.textStory', ''],
      ['Audiobook Edition', 'search.audiobookEdition', ''],
      ['Illustrated Chapters', 'search.illustratedChapters', ''],
    ],
  },
];

const legendClass = 'mb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-muted';
const optionClass =
  'flex min-h-8 cursor-pointer items-center gap-2.5 rounded-xl text-sm transition-colors duration-200 hover:text-brand-strong pointer-coarse:min-h-11';

export function SearchFilters({
  checked,
  status = 'allStatuses',
  onToggle,
  onStatusChange,
  onApply,
  onReset,
  showHeading = true,
}) {
  const { t } = useLocale();
  return (
    <div className="space-y-5">
      {showHeading && (
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <h2 className="text-base font-semibold">{t('search.filters')}</h2>
          <button
            type="button"
            onClick={onReset}
            className="min-h-9 rounded-full px-3 text-xs font-semibold text-orange-strong hover:bg-orange/12"
          >
            {t('common.reset')}
          </button>
        </div>
      )}
      {groups.map((group) => (
        <fieldset key={group.title} className="border-b border-hairline pb-5">
          <legend className={legendClass}>{t(group.title)}</legend>
          <div className="space-y-1">
            {group.items.map(([value, labelKey, count]) => (
              <label className={optionClass} key={value}>
                <input
                  type="checkbox"
                  checked={checked.includes(value)}
                  onChange={() => onToggle(value)}
                  className="size-4 shrink-0 accent-[var(--primary)]"
                />
                <span className="flex-1">{t(labelKey)}</span>
                {count && <span className="text-xs tabular-nums text-muted">{count}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend className={legendClass}>{t('search.publicationStatus')}</legend>
        <div className="space-y-1">
          {SEARCH_STATUSES.map((key) => (
            <label className={optionClass} key={key}>
              <input
                name="status"
                type="radio"
                checked={status === key}
                onChange={() => onStatusChange?.(key)}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              {t(`search.${key}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2 pt-2">
        <Button type="button" onClick={onApply} className="w-full">
          {t('search.applyFilters')}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset} className="w-full">
          {t('search.resetFilters')}
        </Button>
      </div>
    </div>
  );
}
