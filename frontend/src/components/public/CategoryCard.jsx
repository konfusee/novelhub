import * as icons from '../icons';
import { Skeleton } from '../ui';

const toneClasses = {
  purple: 'bg-purple/12 text-purple-strong',
  rose: 'bg-rose/14 text-rose-strong',
  blue: 'bg-ink/7 text-ink',
  green: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  neutral: 'bg-ink/5 text-ink/75',
};
export function CategoryCard({ category, selected = false, onSelect }) {
  const Icon = icons[category.icon] || icons.BookOpen;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect?.(category.name)}
      className={`group flex h-full w-full min-w-0 items-start gap-4 whitespace-normal rounded-3xl border bg-surface p-5 text-left shadow-whisper transition-[transform,border-color,box-shadow] duration-[420ms] ease-spring hover:-translate-y-0.5 hover:shadow-lift ${selected ? 'border-brand ring-2 ring-brand/20' : 'border-line hover:border-brand/60'}`}
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-2xl transition-transform duration-[420ms] ease-spring group-hover:scale-105 ${toneClasses[category.tone] || toneClasses.neutral}`}
      >
        <Icon size={24} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <strong className="text-base font-semibold transition-colors duration-200 group-hover:text-brand-strong">
            {category.name}
          </strong>
          <span className="shrink-0 text-xs tabular-nums text-muted">{category.count} truyện</span>
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">
          {category.description}
        </span>
      </span>
    </button>
  );
}

/* Placeholder with CategoryCard's padding, icon tile and two-line description. */
export function CategoryCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full min-w-0 items-start gap-4 rounded-3xl border border-line bg-surface p-5 shadow-whisper"
    >
      <Skeleton className="size-12 shrink-0 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <span className="flex h-6 items-center justify-between gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-14" />
        </span>
        <span className="mt-1 flex h-10 flex-col justify-center gap-2.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/5" />
        </span>
      </span>
    </div>
  );
}
