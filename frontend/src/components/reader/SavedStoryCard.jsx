import { Link } from 'react-router'
import { ArrowRight, BellOff } from '../icons'
import { Badge, Button, ButtonLink, Card, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { resumeHref } from './readerLinks'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

/* A followed story (`LibraryItem`): new chapters since the last read, resume and unfollow. */
export function SavedStoryCard({ item, onUnfollow, busy = false }) {
  const { t } = useLocale()
  const { story, resume } = item
  const href = ROUTES.story(story.id)
  return (
    <Card as="article" className="group flex gap-4 p-4">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="shrink-0 self-start">
        <StoryCover story={story} className="aspect-[2/3] w-24 rounded-2xl" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-2 text-base font-semibold sm:text-lg">
          <Link to={href} className="whitespace-normal transition-colors hover:text-brand">
            {story.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted">{story.author}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {story.genre && <Badge tone="neutral">{story.genre}</Badge>}
          <Badge tone={story.status === 'Completed' ? 'green' : 'orange'}>
            {t(story.status === 'Completed' ? 'following.completed' : 'following.ongoing')}
          </Badge>
        </div>
        <p
          className={`mb-4 mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-xs leading-5 ${item.newChapters > 0 ? 'bg-brand-soft text-brand-strong' : 'bg-elevated text-muted'}`}
        >
          <span
            aria-hidden="true"
            className={`mt-2 size-1.5 shrink-0 rounded-full ${item.newChapters > 0 ? 'bg-brand' : 'bg-ink/25'}`}
          />
          {item.newChapters > 0
            ? t('following.newChapters', { count: item.newChapters })
            : t('following.upToDate')}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onUnfollow(item)}
            aria-label={t('following.unfollowStory', { title: story.title })}
          >
            <BellOff size={15} aria-hidden="true" />
            {t('following.unfollow')}
          </Button>
          <ButtonLink to={resumeHref(story.id, resume)} size="sm" trailingIcon={ArrowRight}>
            {t(resume?.available ? 'following.readNext' : 'following.viewStory')}
          </ButtonLink>
        </div>
      </div>
    </Card>
  )
}

/* SavedStoryCard frame: w-24 cover, title/author, badges, update note, footer. */
export function SavedStoryCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex gap-4 p-4">
      <Skeleton className="aspect-[2/3] w-24 shrink-0 self-start rounded-2xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex h-6 items-center sm:h-7">
          <Skeleton className="h-4 w-3/4 sm:h-5" />
        </span>
        <span className="mt-0.5 flex h-4 items-center">
          <Skeleton className="h-2.5 w-1/3" />
        </span>
        <span className="mt-2 flex h-[26px] items-center">
          <Skeleton className="h-6 w-20" />
        </span>
        <Skeleton className="mb-4 mt-3 h-9 w-full rounded-2xl" />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </Card>
  )
}
