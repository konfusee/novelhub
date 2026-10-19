import { useState } from 'react'
import { BookOpen, Bookmark, Headphones } from '../icons'
import { ButtonLink, Card, IconButton, ProgressBar, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { useLocale } from '../../context/LocaleContext'

const slugify = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export function ContinueCard({ item, audio = false }) {
  const { t } = useLocale()
  const [saved, setSaved] = useState(false)
  const storyId = item.id || slugify(item.title)
  const label = t(audio ? 'readerHome.continueListening' : 'readerHome.continueReading')
  return (
    <Card as="article" className="flex flex-col p-4 sm:p-5">
      <div className="flex gap-4">
        <StoryCover story={item} className="aspect-[2/3] w-24 shrink-0 rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className={`text-[11px] font-semibold uppercase tracking-[.16em] ${audio ? 'text-orange-strong' : 'text-brand-strong'}`}
              >
                {label}
              </p>
              <h3
                className="mt-1.5 line-clamp-2 whitespace-normal text-base font-semibold"
                title={item.title}
              >
                {item.title}
              </h3>
              <p className="truncate text-xs text-muted" title={item.author}>
                {item.author}
              </p>
            </div>
            <IconButton
              label={saved ? 'Bỏ lưu truyện' : 'Lưu truyện'}
              aria-pressed={saved}
              tone="purple"
              shape="circle"
              size="sm"
              onClick={() => setSaved(!saved)}
            >
              <Bookmark size={16} className={saved ? 'fill-current' : ''} />
            </IconButton>
          </div>
          <p className="mt-auto pt-3 text-xs text-muted">{item.chapter}</p>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar
              value={item.progress}
              tone={audio ? 'orange' : 'brand'}
              size="sm"
              label={`Tiến độ ${item.title}`}
              className="flex-1"
            />
            <span className="text-xs font-semibold tabular-nums text-ink/80">{item.progress}%</span>
          </div>
        </div>
      </div>
      <ButtonLink
        to={audio ? `/listen/${storyId}/chapter-1` : `/read/${storyId}/chapter-1`}
        variant={audio ? 'accent' : 'primary'}
        size="sm"
        className="mt-4 w-full"
      >
        {audio ? <Headphones size={15} /> : <BookOpen size={15} />}
        {label}
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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Skeleton className="mt-1 h-2.5 w-28" />
              <span className="mt-2.5 flex h-6 items-center">
                <Skeleton className="h-4 w-3/4" />
              </span>
              <span className="flex h-4 items-center">
                <Skeleton className="h-2.5 w-1/3" />
              </span>
            </div>
            <Skeleton className="size-9 shrink-0" />
          </div>
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
