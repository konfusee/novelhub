import { Button, Select, Skeleton } from '../ui'
import { useLocale } from '../../context/LocaleContext'
import { CATALOG_SORTS, CATALOG_STATUSES } from './catalog'

const legendClass = 'mb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-muted'
const optionClass =
  'flex min-h-8 cursor-pointer items-center gap-2.5 rounded-xl text-sm transition-colors duration-200 hover:text-brand-strong pointer-coarse:min-h-11'

/**
 * Catalogue filters backed by `/api/catalog/stories`: one category, one publication status and
 * a sort order. Every change applies immediately through `onChange({ category, status, sort })`.
 */
export function SearchFilters({
  categories,
  categoriesStatus = 'ready',
  category = '',
  status = '',
  sort = 'popular',
  onChange,
  onReset,
  showHeading = true,
  idPrefix = 'filters',
}) {
  const { t } = useLocale()
  const change = patch => onChange({ category, status, sort, ...patch })
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
      <label className="block border-b border-hairline pb-5">
        <span className={`block ${legendClass}`}>{t('search.sortResults')}</span>
        <Select
          value={sort}
          onChange={event => change({ sort: event.target.value })}
          className="w-full text-sm"
        >
          {CATALOG_SORTS.map(value => (
            <option key={value} value={value}>
              {t(`search.sort.${value}`)}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className="border-b border-hairline pb-5">
        <legend className={legendClass}>{t('search.genres')}</legend>
        <div className="space-y-1">
          <label className={optionClass}>
            <input
              type="radio"
              name={`${idPrefix}-category`}
              checked={!category}
              onChange={() => change({ category: '' })}
              className="size-4 shrink-0 accent-[var(--primary)]"
            />
            <span className="flex-1">{t('search.allCategories')}</span>
          </label>
          {categoriesStatus === 'loading' &&
            [0, 1, 2].map(index => (
              <span key={index} className="flex h-8 items-center">
                <Skeleton className="h-3 w-3/4" />
              </span>
            ))}
          {categoriesStatus === 'error' && (
            <p className="text-xs text-rose-strong">{t('search.categoriesFailed')}</p>
          )}
          {categories.map(item => (
            <label className={optionClass} key={item.id}>
              <input
                type="radio"
                name={`${idPrefix}-category`}
                checked={category === item.id}
                onChange={() => change({ category: item.id })}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              <span className="flex-1">{item.name}</span>
              <span className="text-xs tabular-nums text-muted">{item.storyCount}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={legendClass}>{t('search.publicationStatus')}</legend>
        <div className="space-y-1">
          {['', ...CATALOG_STATUSES].map(value => (
            <label className={optionClass} key={value || 'all'}>
              <input
                name={`${idPrefix}-status`}
                type="radio"
                checked={status === value}
                onChange={() => change({ status: value })}
                className="size-4 shrink-0 accent-[var(--primary)]"
              />
              {t(`search.status.${value || 'all'}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {onReset && (
        <Button type="button" variant="ghost" onClick={onReset} className="w-full">
          {t('search.resetFilters')}
        </Button>
      )}
    </div>
  )
}
