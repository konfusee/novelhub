import { Button } from './index'
import { ChevronLeft, ChevronRight } from '../icons'
import { useLocale } from '../../context/LocaleContext'
export function Pagination({ page, pageCount, onChange, className = '' }) {
  const { t } = useLocale()
  if (pageCount <= 1) return null
  const marginClass = /(^|\s)mt-/.test(className) ? '' : 'mt-5'
  const pages = [
    ...new Set([
      1,
      ...[page - 1, page, page + 1].filter(value => value > 1 && value < pageCount),
      pageCount,
    ]),
  ].sort((a, b) => a - b)
  return (
    <nav
      aria-label={t('pagination.label')}
      className={`${marginClass} flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      <Button
        variant="secondary"
        size="sm"
        aria-label={t('pagination.previous')}
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft size={16} />
      </Button>
      {pages.map((value, index) => (
        <span key={value} className="inline-flex items-center gap-2">
          {index > 0 && value > pages[index - 1] + 1 && (
            <span aria-hidden="true" className="text-muted">
              …
            </span>
          )}
          <Button
            variant={value === page ? 'primary' : 'secondary'}
            size="sm"
            aria-current={value === page ? 'page' : undefined}
            aria-label={t('pagination.page', { page: value })}
            onClick={() => onChange(value)}
          >
            {value}
          </Button>
        </span>
      ))}
      <Button
        variant="secondary"
        size="sm"
        aria-label={t('pagination.next')}
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
      >
        <ChevronRight size={16} />
      </Button>
      <form
        className="flex items-center gap-2"
        onSubmit={event => {
          event.preventDefault()
          const value = Number(new FormData(event.currentTarget).get('page'))
          if (Number.isInteger(value) && value >= 1 && value <= pageCount) onChange(value)
        }}
      >
        <label className="flex items-center gap-2 text-xs text-muted">
          {t('pagination.goTo')}
          <input
            key={page}
            name="page"
            type="number"
            min={1}
            max={pageCount}
            required
            defaultValue={page}
            className="h-9 w-16 rounded-full border border-line bg-surface px-3 text-ink"
          />
        </label>
        <Button type="submit" variant="ghost" size="sm">
          {t('pagination.go')}
        </Button>
      </form>
    </nav>
  )
}
