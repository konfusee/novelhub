import { Eye, Star } from '../icons'
import { Link } from 'react-router-dom'
import { StoryCover } from '../story/StoryCover'
export function StoryCard({ story }) {
  return (
    <Link to={`/stories/${story.id}`} className="group min-w-0">
      <StoryCover
        story={story}
        className="aspect-[2/3] rounded-2xl border border-line"
        badge={
          <span className="absolute bottom-2 left-2 rounded-full bg-surface/95 px-2.5 py-1 text-[10px] font-medium text-ink">
            {story.genre}
          </span>
        }
      />
      <h3 className="mt-2 truncate text-sm font-semibold">{story.title}</h3>
      <p className="truncate text-xs text-muted">{story.author}</p>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <Star size={12} className="fill-orange text-orange" />
          {story.rating}
        </span>
        <span className="flex items-center gap-1">
          <Eye size={12} />
          {story.reads}
        </span>
      </div>
    </Link>
  )
}
