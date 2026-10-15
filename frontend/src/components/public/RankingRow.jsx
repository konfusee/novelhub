import { ArrowRight, Star } from '../icons';
import { ButtonLink, Skeleton, Trend } from '../ui';
import { StoryCover } from '../story/StoryCover';
export function RankingRow({ item }) {
  return (
    <div className="grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3 transition-colors duration-200 hover:bg-elevated/60 sm:grid-cols-[2.5rem_3rem_minmax(0,1fr)_5.5rem_4.5rem_auto] sm:gap-4 sm:px-5">
      <strong className="text-base font-bold tabular-nums text-orange-strong">
        {String(item.rank).padStart(2, '0')}
      </strong>
      <StoryCover story={item} className="aspect-[2/3] w-full rounded-xl border border-hairline" />
      <div className="min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold" title={item.title}>
          {item.title}
        </h3>
        <p className="text-xs text-muted">
          {item.author} · {item.genre}
        </p>
      </div>
      <div className="hidden text-right text-xs tabular-nums sm:block">
        <strong className="block font-semibold">{item.reads}</strong>
        <span className="flex items-center justify-end gap-1 text-muted">
          <Star size={11} className="fill-orange text-orange" aria-hidden="true" />
          {item.rating}
        </span>
      </div>
      <span className="hidden justify-center sm:flex">
        <Trend value={item.change} />
      </span>
      <ButtonLink
        to={`/stories/${item.id || 'demo'}`}
        variant="secondary"
        size="sm"
        aria-label={`Xem thử ${item.title}`}
        className="size-11 px-0 sm:size-auto sm:px-4"
      >
        <ArrowRight size={16} aria-hidden="true" className="sm:hidden" />
        <span className="hidden sm:inline">Xem thử</span>
      </ButtonLink>
    </div>
  );
}

/* Uses RankingRow's column template so rows keep their height when data arrives. */
export function RankingRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[1.5rem_2.5rem_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-3 sm:grid-cols-[2.5rem_3rem_minmax(0,1fr)_5.5rem_4.5rem_auto] sm:gap-4 sm:px-5"
    >
      <Skeleton className="h-4 w-6" />
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <div className="min-w-0 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="hidden flex-col items-end gap-2 sm:flex">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-8" />
      </div>
      <span className="hidden justify-center sm:flex">
        <Skeleton className="h-6 w-12" />
      </span>
      <Skeleton className="size-11 sm:h-9 sm:w-[5.25rem]" />
    </div>
  );
}
