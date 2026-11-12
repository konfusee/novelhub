import { ArrowRight, Star } from '../icons'
import { ButtonLink, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const columns =
  'grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3 sm:grid-cols-[2.5rem_3rem_minmax(0,1fr)_7rem_auto] sm:gap-4 sm:px-5'

/** One ranked story card; `metric` is the value the board is ordered by. */
export function RankingRow({ rank, story, metric, featured = false }) {
  const { t } = useLocale()
  return (
    <div
      className={`${featured ? 'flex h-full flex-col gap-3 rounded-3xl border border-orange/30 bg-surface p-4 shadow-soft' : columns} transition-colors duration-200 hover:bg-elevated/60`}
    >
      <strong
        className={`${featured ? 'text-2xl' : 'text-base'} font-bold tabular-nums text-orange-strong`}
      >
        {String(rank).padStart(2, '0')}
      </strong>
      <StoryCover
        story={story}
        className={`${featured ? 'w-full' : 'w-full'} aspect-[2/3] rounded-xl border border-hairline`}
      />
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold" title={story.title}>
          {story.title}
        </h3>
        <p className="text-xs text-muted">
          {story.author}
          {story.genre ? ` · ${story.genre}` : ''}
        </p>
      </div>
      <div
        className={`${featured ? 'mt-auto' : 'hidden text-right sm:block'} text-xs tabular-nums`}
      >
        <strong className="block font-semibold">{metric}</strong>
        <span className="flex items-center justify-end gap-1 text-muted">
          <Star size={11} className="fill-orange text-orange" aria-hidden="true" />
          {story.rating}
        </span>
      </div>
      <ButtonLink
        to={ROUTES.story(story.id)}
        variant="secondary"
        size="sm"
        aria-label={t('rankings.viewStory', { title: story.title })}
        className="size-11 px-0 sm:size-auto sm:px-4"
      >
        <ArrowRight size={16} aria-hidden="true" className="sm:hidden" />
        <span className="hidden sm:inline">{t('rankings.view')}</span>
      </ButtonLink>
    </div>
  )
}

/* Uses RankingRow's column template so rows keep their height when data arrives. */
export function RankingRowSkeleton() {
  return (
    <div aria-hidden="true" className={columns}>
      <Skeleton className="h-4 w-6" />
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="hidden flex-col items-end gap-2 sm:flex">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-8" />
      </div>
      <Skeleton className="size-11 sm:h-9 sm:w-[5.25rem]" />
    </div>
  )
}
