import { useLocale } from '../../context/LocaleContext'

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
]
export function SearchFilters({ checked, onToggle, onApply, onReset }) {
  const { t } = useLocale()
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="font-bold">{t('search.filters')}</h2>
        <button onClick={onReset} className="text-xs font-semibold text-orange">
          {t('common.reset')}
        </button>
      </div>
      {groups.map(group => (
        <fieldset key={group.title} className="border-b border-line pb-5">
          <legend className="mb-3 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
            {t(group.title)}
          </legend>
          <div className="space-y-2.5">
            {group.items.map(([value, labelKey, count]) => (
              <label className="flex cursor-pointer items-center gap-2 text-xs" key={value}>
                <input
                  type="checkbox"
                  checked={checked.includes(value)}
                  onChange={() => onToggle(value)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="flex-1">{t(labelKey)}</span>
                {count && <span className="text-muted">{count}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <fieldset>
        <legend className="mb-3 text-[11px] font-bold uppercase tracking-[.14em] text-muted">
          {t('search.publicationStatus')}
        </legend>
        {['allStatuses', 'ongoing', 'completedOnly'].map((key, index) => (
          <label className="mb-2 flex items-center gap-2 text-xs" key={key}>
            <input
              name="status"
              type="radio"
              defaultChecked={index === 0}
              className="size-4 accent-[var(--primary)]"
            />
            {t(`search.${key}`)}
          </label>
        ))}
      </fieldset>
      <ButtonPair onApply={onApply} onReset={onReset} />
    </div>
  )
}
function ButtonPair({ onApply, onReset }) {
  const { t } = useLocale()
  return (
    <div className="grid gap-2 pt-2">
      <button
        onClick={onApply}
        className="rounded-xl bg-brand px-4 py-3 text-xs font-semibold text-white"
      >
        {t('search.applyFilters')}
      </button>
      <button
        onClick={onReset}
        className="rounded-xl border border-line px-4 py-3 text-xs font-semibold"
      >
        {t('search.resetFilters')}
      </button>
    </div>
  )
}
