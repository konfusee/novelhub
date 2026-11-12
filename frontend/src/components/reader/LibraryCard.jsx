import { Link } from 'react-router'
import { BellOff, BookOpen, Headphones } from '../icons'
import { Badge, Button, ButtonLink, Card, ProgressBar, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { chapterLabel } from './chapterLabel'
import { formatWhen, listenHref, resumeHref, storyPercent } from './readerLinks'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

/* Status badges shared by both views: finished, new chapters, updated or unavailable chapter. */
function ItemBadges({ item, t }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {item.completed && <Badge tone="green">{t('library.completedBadge')}</Badge>}
      {item.newChapters > 0 && (
        <Badge tone="purple">{t('library.newChapters', { count: item.newChapters })}</Badge>
      )}
      {item.resume?.contentUpdated && <Badge tone="orange">{t('library.contentUpdated')}</Badge>}
      {item.resume && !item.resume.available && (
        <Badge tone="rose">{t('library.unavailable')}</Badge>
      )}
    </span>
  )
}

/* One `LibraryItem` of GET /reader/library: progress, resume link and unfollow. */
export function LibraryCard({ item, view = 'grid', onUnfollow, busy = false }) {
  const { t } = useLocale()
  const { story, resume, listenResume } = item
  const href = resumeHref(story.id, resume)
  const listenTo = listenHref(story.id, listenResume)
  const percent = storyPercent(item)
  const actionLabel = resume?.available ? t('library.continue') : t('library.openStory')
  const listenLabel = t('library.continueListening')
  const chapter = resume
    ? chapterLabel(t, resume)
    : listenResume
      ? chapterLabel(t, listenResume)
      : t('library.notStarted')
  const listen = listenTo && (
    <ButtonLink
      to={listenTo}
      size="sm"
      variant="secondary"
      aria-label={`${listenLabel}: ${story.title}`}
      title={chapterLabel(t, listenResume)}
    >
      <Headphones size={14} aria-hidden="true" />
      <span className="hidden sm:inline">{listenLabel}</span>
    </ButtonLink>
  )
  const progress = (
    <div className="flex items-center gap-3">
      <ProgressBar
        value={percent}
        size="sm"
        label={t('library.progressOf', { title: story.title })}
        className="flex-1"
      />
      <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-strong">
        {t('library.chaptersRead', { read: item.chaptersRead, total: item.totalChapters })}
      </span>
    </div>
  )
  const unfollow = item.following && (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={() => onUnfollow(item)}
      aria-label={t('library.unfollowStory', { title: story.title })}
    >
      <BellOff size={14} aria-hidden="true" />
      {t('library.unfollow')}
    </Button>
  )

  if (view === 'list')
    return (
      <Card as="article" className="flex items-center gap-3 p-3 sm:gap-4">
        <Link
          to={ROUTES.story(story.id)}
          tabIndex={-1}
          aria-hidden="true"
          className="group shrink-0"
        >
          <StoryCover story={story} className="aspect-[2/3] w-16 rounded-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <h3
            className="line-clamp-2 whitespace-normal text-base font-semibold"
            title={story.title}
          >
            <Link to={ROUTES.story(story.id)} className="transition-colors hover:text-brand">
              {story.title}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted" title={story.author}>
            {story.author}
          </p>
          <div className="mt-2">{progress}</div>
          <p className="mt-1.5 truncate text-xs text-muted">
            {chapter}
            {item.lastActivityAt && ` · ${formatWhen(item.lastActivityAt)}`}
          </p>
          <div className="mt-1.5">
            <ItemBadges item={item} t={t} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          {unfollow}
          {listen}
          <ButtonLink to={href} size="sm" aria-label={`${actionLabel}: ${story.title}`}>
            <BookOpen size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{actionLabel}</span>
          </ButtonLink>
        </div>
      </Card>
    )

  return (
    <Card as="article" className="group flex flex-col p-3">
      <Link to={ROUTES.story(story.id)} tabIndex={-1} aria-hidden="true" className="block">
        <StoryCover story={story} className="aspect-[2/3] rounded-2xl" />
      </Link>
      <h3 className="mt-3 line-clamp-2 whitespace-normal text-sm font-semibold" title={story.title}>
        <Link to={ROUTES.story(story.id)} className="transition-colors hover:text-brand">
          {story.title}
        </Link>
      </h3>
      <p className="truncate text-xs text-muted" title={story.author}>
        {story.author}
      </p>
      <p className="mt-2 truncate text-xs text-muted">{chapter}</p>
      <div className="mt-1.5">{progress}</div>
      <div className="mt-2">
        <ItemBadges item={item} t={t} />
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-2">
        {unfollow || <span />}
        <span className="flex flex-wrap items-center justify-end gap-2">
          {listen}
          <ButtonLink to={href} size="sm" aria-label={`${actionLabel}: ${story.title}`}>
            {actionLabel}
          </ButtonLink>
        </span>
      </div>
    </Card>
  )
}

/* Placeholder for both LibraryCard views, matching cover sizes and row heights. */
export function LibraryCardSkeleton({ view = 'grid' }) {
  if (view === 'list')
    return (
      <Card as="div" aria-hidden="true" className="flex items-center gap-3 p-3 sm:gap-4">
        <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <span className="flex h-6 items-center">
            <Skeleton className="h-4 w-3/5" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-1/3" />
          </span>
          <div className="mt-2 flex h-4 items-center gap-3">
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-3 w-8" />
          </div>
          <span className="mt-1.5 flex h-4 items-center">
            <Skeleton className="h-2.5 w-2/5" />
          </span>
        </div>
        <Skeleton className="h-9 w-10 shrink-0 sm:w-28" />
      </Card>
    )
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-3">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <span className="mt-3 flex h-5 items-center">
        <Skeleton className="h-3.5 w-4/5" />
      </span>
      <span className="flex h-4 items-center">
        <Skeleton className="h-2.5 w-1/2" />
      </span>
      <span className="mt-2 flex h-4 items-center">
        <Skeleton className="h-2.5 w-2/3" />
      </span>
      <div className="mt-1.5 flex h-4 items-center gap-3">
        <Skeleton className="h-1.5 flex-1" />
        <Skeleton className="h-3 w-8" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-hairline pt-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
    </Card>
  )
}
