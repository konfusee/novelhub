import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark, Clock, Eye, Star } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import { StoryCover } from '../story/StoryCover'
export function SearchResultItem({ result }) {
  const navigate = useNavigate()
  const [bookmarked, setBookmarked] = useState(false)
  return (
    <Card className="flex gap-4 p-4 sm:gap-5 sm:p-5">
      <StoryCover
        story={result}
        className="aspect-[2/3] w-24 shrink-0 rounded-xl border border-line sm:w-28"
        badge={
          <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-1 text-[9px] font-semibold uppercase text-white">
            {result.format}
          </span>
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold sm:text-lg">{result.title}</h3>
            <p className="mt-1 text-xs">
              by <strong>{result.author}</strong>
            </p>
          </div>
          <button onClick={() => setBookmarked(value => !value)} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark'}>
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
            {result.reads} reads
          </span>
          <Badge tone={result.status === 'Completed' ? 'green' : 'orange'}>{result.status}</Badge>
        </div>
        <div className="mt-3 hidden flex-wrap gap-1.5 sm:flex">
          {result.genres.map(genre => (
            <span
              className="rounded-full border border-line px-2.5 py-1 text-[10px] text-muted"
              key={genre}
            >
              {genre}
            </span>
          ))}
        </div>
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">{result.description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
            <Clock size={13} />
            {result.duration}
          </span>
          <Button onClick={() => navigate(`/stories/${result.id}`)} className="ml-auto min-h-9 px-4 py-2 text-xs">Read Preview</Button>
        </div>
      </div>
    </Card>
  )
}
