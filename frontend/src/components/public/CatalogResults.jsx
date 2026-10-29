import { AlertTriangle, RefreshCw, Search } from '../icons'
import { Button, EmptyState } from '../ui'
import { Pagination } from '../ui/Pagination'
import { useLocale } from '../../context/LocaleContext'
import { StoryCard, StoryCardSkeleton } from './StoryCard'

const grid = 'nh-grid-12 grid nh-cols-2 gap-x-4 gap-y-6 nh-sm-cols-3 nh-lg-cols-4'

/** Grid of catalogue cards with loading, error(+retry), empty and paginated states. */
export function CatalogResults({ resource, onPageChange, emptyAction }) {
  const { t } = useLocale()
  if (resource.status === 'loading')
    return (
      <div aria-busy="true" aria-label={t('search.loading')} className={grid}>
        {Array.from({ length: 8 }, (_, index) => (
          <StoryCardSkeleton key={index} />
        ))}
      </div>
    )
  if (resource.status === 'error')
    return (
      <EmptyState
        tone="rose"
        icon={AlertTriangle}
        title={t('search.loadFailed')}
        description={resource.error?.message}
        action={
          <Button variant="secondary" size="sm" onClick={resource.retry}>
            <RefreshCw size={14} aria-hidden="true" />
            {t('search.retry')}
          </Button>
        }
        className="rounded-2xl border border-hairline"
      />
    )
  if (resource.status === 'empty')
    return (
      <EmptyState
        icon={Search}
        title={t('search.noResults')}
        description={t('search.tryAnother')}
        action={emptyAction}
        className="rounded-2xl border border-hairline"
      />
    )
  const { items, total, page, pageSize } = resource.data
  return (
    <div>
      <ul className={grid}>
        {items.map(story => (
          <li key={story.id} className="min-w-0">
            <StoryCard story={story} />
          </li>
        ))}
      </ul>
      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / pageSize))}
        onChange={onPageChange}
      />
    </div>
  )
}
