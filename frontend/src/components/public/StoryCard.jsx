import { Eye, Star } from '../icons';
import { Link } from 'react-router';
import { StoryCover } from '../story/StoryCover';
import { Skeleton } from '../ui';

/* Same box model as StoryCard: 2:3 cover, title, author and stat rows. */
export function StoryCardSkeleton() {
  return (
    <div aria-hidden="true" className="min-w-0">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <span className="mt-3 flex h-5 items-center">
        <Skeleton className="h-3.5 w-4/5" />
      </span>
      <span className="mt-0.5 flex h-4 items-center">
        <Skeleton className="h-3 w-1/2" />
      </span>
      <span className="mt-1.5 flex h-4 items-center gap-3">
        <Skeleton className="h-2.5 w-8" />
        <Skeleton className="h-2.5 w-10" />
      </span>
    </div>
  );
}

export function StoryCard({ story }) {
  return (
    <Link to={`/stories/${story.id}`} className="group block min-w-0 rounded-2xl">
      <StoryCover
        story={story}
        className="aspect-[2/3] rounded-2xl border border-hairline shadow-whisper transition-[transform,box-shadow] duration-[420ms] ease-spring group-hover:-translate-y-1 group-hover:shadow-lift"
        badge={
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-ink shadow-whisper">
            {story.genre}
          </span>
        }
      />
      <h3
        className="mt-3 line-clamp-2 whitespace-normal text-sm font-semibold transition-colors duration-200 group-hover:text-brand-strong"
        title={story.title}
      >
        {story.title}
      </h3>
      <p className="mt-0.5 truncate text-xs text-ink/70" title={story.author}>
        {story.author}
      </p>
      <div className="mt-1.5 flex items-center gap-3 text-xs tabular-nums text-ink/70">
        <span className="flex items-center gap-1">
          <Star size={12} className="fill-orange text-orange" aria-hidden="true" />
          {story.rating}
        </span>
        <span className="flex items-center gap-1">
          <Eye size={12} aria-hidden="true" />
          {story.reads}
        </span>
      </div>
    </Link>
  );
}
