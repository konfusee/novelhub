import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Bookmark, Clock, Eye, Headphones, BookOpen, Star } from '../icons'
import { Badge, ButtonLink, Card, IconButton, Skeleton } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { useLocale } from '../../context/LocaleContext'
const formatLabels = { Audio: 'Truyện âm thanh', Story: 'Truyện chữ' }
const statusLabels = { Completed: 'Đã hoàn tất', Ongoing: 'Đang phát hành' }
const genreLabels = {
  Romance: 'Lãng mạn',
  Fantasy: 'Kỳ ảo',
  Magic: 'Phép thuật',
  Adventure: 'Phiêu lưu',
  Action: 'Hành động',
  Drama: 'Chính kịch',
  'Slice of Life': 'Đời thường',
  Mystery: 'Bí ẩn',
}
export function SearchResultItem({ result }) {
  const { t } = useLocale()
  const [bookmarked, setBookmarked] = useState(false)
  const audio = result.format === 'Audio'
  return (
    <Card as="article" data-search-result={result.id} className="flex gap-4 p-4 sm:gap-6 sm:p-5">
      <Link
        to={`/stories/${result.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="group w-20 shrink-0 self-start sm:w-28"
      >
        <StoryCover
          story={result}
          className="aspect-[2/3] w-full rounded-2xl border border-hairline shadow-whisper"
          badge={
            <span
              title={formatLabels[result.format] ?? result.format}
              className={`absolute bottom-2 left-2 grid size-6 place-items-center rounded-full shadow-whisper ${audio ? 'bg-orange text-on-orange' : 'bg-brand text-on-brand'}`}
            >
              {audio ? <Headphones size={12} /> : <BookOpen size={12} />}
            </span>
          }
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-semibold sm:text-h3">
              <Link
                to={`/stories/${result.id}`}
                className="whitespace-normal transition-colors duration-200 hover:text-brand-strong"
              >
                {result.title}
              </Link>
            </h3>
            <p className="mt-1 break-words text-xs text-muted sm:text-sm">
              {t('history.byAuthor', { author: result.author })}
            </p>
          </div>
          <IconButton
            label={t(bookmarked ? 'story.removeBookmark' : 'story.bookmark')}
            tone="purple"
            size="sm"
            aria-pressed={bookmarked}
            onClick={() => setBookmarked(value => !value)}
          >
            <Bookmark size={16} className={bookmarked ? 'fill-current' : ''} />
          </IconButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-1 font-semibold tabular-nums text-ink">
            <Star size={13} className="fill-orange text-orange" aria-hidden="true" />
            {result.rating}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Eye size={13} aria-hidden="true" />
            {t('story.readCount', { count: result.reads })}
          </span>
          <Badge tone={result.status === 'Completed' ? 'green' : 'purple'}>
            {statusLabels[result.status] ?? result.status}
          </Badge>
          <Badge tone={audio ? 'orange' : 'neutral'}>
            {audio ? (
              <Headphones size={12} aria-hidden="true" />
            ) : (
              <BookOpen size={12} aria-hidden="true" />
            )}
            {formatLabels[result.format] ?? result.format}
          </Badge>
        </div>
        <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
          {result.genres.map(genre => (
            <Badge key={genre}>{genreLabels[genre] ?? genre}</Badge>
          ))}
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted" title={result.description}>
          {result.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <Clock size={13} className="shrink-0" aria-hidden="true" />
            {result.duration}
          </span>
          <ButtonLink
            to={`/stories/${result.id}`}
            size="sm"
            trailingIcon={ArrowRight}
            className="ml-auto"
          >
            {t('story.readPreview')}
          </ButtonLink>
        </div>
      </div>
    </Card>
  )
}

/* Mirrors SearchResultItem rows (cover width, title/meta/genre/description/footer heights). */
export function SearchResultItemSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex gap-4 p-4 sm:gap-6 sm:p-5">
      <Skeleton className="aspect-[2/3] w-20 shrink-0 self-start rounded-2xl sm:w-28" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <span className="flex flex-col justify-center gap-2 py-1 sm:h-7 sm:py-0">
              <Skeleton className="h-4 w-3/4 sm:h-5" />
              <Skeleton className="h-4 w-1/2 sm:hidden" />
            </span>
            <span className="mt-1 flex h-4 items-center sm:h-5">
              <Skeleton className="h-3 w-1/3" />
            </span>
          </div>
          <Skeleton className="size-9 shrink-0 rounded-2xl" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="mt-3 hidden gap-1.5 sm:flex">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
        <span className="mt-3 flex flex-col gap-3 py-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </span>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="ml-auto h-9 w-28" />
        </div>
      </div>
    </Card>
  )
}
