import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bell, BellOff, Heart } from '../icons'
import { Badge, ButtonLink, Card, IconButton, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { useLocale } from '../../context/LocaleContext'

const genreTones = {
  'Kỳ ảo': 'orange',
  'Lãng mạn': 'rose',
  'Khoa học viễn tưởng': 'purple',
  'Phiêu lưu': 'green',
}

export function SavedStoryCard({ story }) {
  const { t } = useLocale()
  const [favorite, setFavorite] = useState(story.favorite)
  const [alerts, setAlerts] = useState(story.alerts)
  const href = `/stories/${story.id || 'demo'}`
  return (
    <Card as="article" className="group flex gap-4 p-4">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="shrink-0 self-start">
        <StoryCover story={story} className="aspect-[2/3] w-24 rounded-2xl" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold sm:text-lg">
              <Link to={href} className="whitespace-normal transition-colors hover:text-brand">
                {story.title}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted">{story.author}</p>
          </div>
          <IconButton
            label={t('following.toggleFavorite')}
            aria-pressed={favorite}
            tone="rose"
            shape="circle"
            size="md"
            onClick={() => setFavorite(!favorite)}
          >
            <Heart size={17} className={favorite ? 'fill-current' : ''} />
          </IconButton>
        </div>
        <div className="mt-2">
          <Badge tone={genreTones[story.genre] || 'neutral'}>{story.genre}</Badge>
        </div>
        <p className="mb-4 mt-3 flex items-start gap-2 rounded-2xl bg-brand-soft px-3 py-2 text-xs leading-5 text-brand-strong">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
          {story.update}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3">
          <button
            type="button"
            aria-pressed={alerts}
            onClick={() => setAlerts(!alerts)}
            className="flex min-h-9 items-center gap-1.5 rounded-full text-xs text-muted transition-colors hover:text-ink pointer-coarse:min-h-11"
          >
            {alerts ? <Bell size={16} className="text-brand" /> : <BellOff size={16} />}
            {t(alerts ? 'following.alertsOn' : 'following.muted')}
          </button>
          <ButtonLink to={href} size="sm" trailingIcon={ArrowRight}>
            {t('following.readNext')}
          </ButtonLink>
        </div>
      </div>
    </Card>
  )
}

/* SavedStoryCard frame: w-24 cover, title/author + heart, genre badge, update note, footer. */
export function SavedStoryCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex gap-4 p-4">
      <Skeleton className="aspect-[2/3] w-24 shrink-0 self-start rounded-2xl" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="flex h-6 items-center sm:h-7">
              <Skeleton className="h-4 w-3/4 sm:h-5" />
            </span>
            <span className="mt-0.5 flex h-4 items-center">
              <Skeleton className="h-2.5 w-1/3" />
            </span>
          </div>
          <Skeleton className="size-11 shrink-0" />
        </div>
        <span className="mt-2 flex h-[26px] items-center">
          <Skeleton className="h-6 w-20" />
        </span>
        <Skeleton className="mb-4 mt-3 h-14 w-full rounded-2xl" />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-hairline pt-3">
          <span className="flex h-9 items-center pointer-coarse:h-11">
            <Skeleton className="h-3 w-32" />
          </span>
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </Card>
  )
}
