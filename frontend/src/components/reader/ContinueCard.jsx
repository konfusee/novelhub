import { Link } from 'react-router'
import { BookOpen } from '../icons'
import { Badge, ButtonLink, Card, ProgressBar, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { chapterLabel } from './chapterLabel'
import { resumeHref, storyPercent } from './readerLinks'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

/* A story in progress (`LibraryItem` of GET /reader/library): saved chapter and story progress. */
export function ContinueCard({ item }) {
  const { t } = useLocale()
  const { story, resume } = item
  const percent = storyPercent(item)
  return (
    <Card as="article" className="flex flex-col p-4 sm:p-5">
      <div className="flex gap-4">
        <Link to={ROUTES.story(story.id)} tabIndex={-1} aria-hidden="true" className="shrink-0">
          <StoryCover story={story} className="aspect-[2/3] w-24 rounded-2xl" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-strong">
            {t('readerHome.continueReading')}
          </p>
          <h3
            className="mt-1.5 line-clamp-2 whitespace-normal text-base font-semibold"
            title={story.title}
          >
            <Link to={ROUTES.story(story.id)} className="transition-colors hover:text-brand">
              {story.title}
            </Link>
          </h3>
          <p className="truncate text-xs text-muted" title={story.author}>
            {story.author}
          </p>
          <p className="mt-auto truncate pt-3 text-xs text-muted">
            {resume ? chapterLabel(t, resume) : t('readerHome.notStarted')}
          </p>
          {resume?.contentUpdated && (
            <Badge tone="orange" className="mt-1.5 self-start">
              {t('readerHome.contentUpdated')}
            </Badge>
          )}
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar
              value={percent}
              size="sm"
              label={t('readerHome.storyProgress', { title: story.title })}
              className="flex-1"
            />
            <span className="text-xs font-semibold tabular-nums text-ink/80">
              {t('readerHome.chaptersRead', {
                read: item.chaptersRead,
                total: item.totalChapters,
              })}
            </span>
          </div>
        </div>
      </div>
      <ButtonLink to={resumeHref(story.id, resume)} size="sm" className="mt-4 w-full">
        <BookOpen size={15} />
        {resume?.available === false ? t('readerHome.openStory') : t('readerHome.continueReading')}
      </ButtonLink>
    </Card>
  )
}

/* ContinueCard geometry: w-24 2:3 cover, label/title/author, chapter + progress, full button. */
export function ContinueCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-4 sm:p-5">
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-24 shrink-0 rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <Skeleton className="mt-1 h-2.5 w-28" />
          <span className="mt-2.5 flex h-6 items-center">
            <Skeleton className="h-4 w-3/4" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-1/3" />
          </span>
          <span className="mt-auto flex h-7 items-end pt-3">
            <Skeleton className="mb-0.5 h-2.5 w-2/5" />
          </span>
          <div className="mt-2 flex items-center gap-3">
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </div>
      <Skeleton className="mt-4 h-9 w-full" />
    </Card>
  )
}
