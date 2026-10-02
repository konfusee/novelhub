import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Clock, Eye, Headphones, BookOpen, Star } from '../icons'
import { Badge, Button, Card } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { useLocale } from '../../context/LocaleContext'
const formatLabels = { Audio: 'Truyện âm thanh', Story: 'Truyện chữ' }
const statusLabels = { Completed: 'Đã hoàn tất', Ongoing: 'Đang phát hành' }
const genreLabels = {
  Romance: 'Lãng mạn', Fantasy: 'Kỳ ảo', Magic: 'Phép thuật', Adventure: 'Phiêu lưu',
  Action: 'Hành động', Drama: 'Chính kịch', 'Slice of Life': 'Đời thường', Mystery: 'Bí ẩn',
}
export function SearchResultItem({ result }) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [bookmarked, setBookmarked] = useState(false)
  return (
    <Card data-search-result={result.id} className="flex gap-3 p-4 sm:gap-5 sm:p-5">
      <StoryCover
        story={result}
        className="aspect-[2/3] w-20 shrink-0 self-start rounded-xl border border-line sm:w-28"
        badge={
          <span title={formatLabels[result.format] ?? result.format} aria-label={formatLabels[result.format] ?? result.format} className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-1 text-[9px] font-semibold text-white">
            {result.format === 'Audio' ? <Headphones size={12} /> : <BookOpen size={12} />}
            <span className="hidden sm:inline">{result.format === 'Audio' ? 'Âm thanh' : 'Truyện chữ'}</span>
          </span>
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-base font-bold sm:text-lg">{result.title}</h3>
            <p className="mt-1 break-words text-xs">
              {t('history.byAuthor', { author: result.author })}
            </p>
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-xl" aria-pressed={bookmarked} onClick={() => setBookmarked(value => !value)} aria-label={t(bookmarked ? 'story.removeBookmark' : 'story.bookmark')}>
            <Bookmark size={18} className={bookmarked ? 'fill-brand text-brand' : 'text-muted'} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="flex items-center gap-1 font-semibold text-orange">
            <Star size={13} className="fill-orange" />
            {result.rating}
          </span>
          <span className="flex items-center gap-1">
            <Eye size={13} />
            {t('story.readCount', { count: result.reads })}
          </span>
          <Badge tone={result.status === 'Completed' ? 'green' : 'orange'}>{statusLabels[result.status] ?? result.status}</Badge>
        </div>
        <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
          {result.genres.map(genre => (
            <span
              className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted"
              key={genre}
            >
              {genreLabels[genre] ?? genre}
            </span>
          ))}
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{result.description}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
            <Clock size={13} className="shrink-0" />
            {result.duration}
          </span>
          <Button onClick={() => navigate(`/stories/${result.id}`)} className="ml-auto min-h-9 px-4 py-2 text-xs">{t('story.readPreview')}</Button>
        </div>
      </div>
    </Card>
  )
}
