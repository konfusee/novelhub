import { useLocale } from '../../context/LocaleContext';
import { ArrowRight, Crown, Star } from '../icons';
import { Badge, ButtonLink, Card, Skeleton, Trend } from '../ui';
import { StoryCover } from '../story/StoryCover';
export function PodiumCard({ story }) {
  const { t } = useLocale();
  const champion = story.rank === 1;
  return (
    <Card
      as="article"
      className={`relative flex h-full flex-col p-5 ${champion ? 'border-orange/70 shadow-[0_28px_56px_-36px_var(--accent-orange)] lg:-mt-4 lg:min-h-[440px]' : 'lg:min-h-[400px]'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={champion ? 'orange' : 'neutral'}>
          {champion ? (
            <>
              <Crown size={12} aria-hidden="true" /> Champion #1
            </>
          ) : (
            `Hạng #0${story.rank}`
          )}
        </Badge>
        {story.change == null ? (
          <Badge aria-label={t('rankings.noHistory')}>—</Badge>
        ) : (
          <Trend value={story.change} />
        )}
      </div>
      <StoryCover
        story={story}
        eager
        className="mt-4 aspect-[2/3] max-h-56 rounded-2xl border border-hairline"
      />
      <Badge tone="green" className="mt-4 w-fit">
        {story.genre}
      </Badge>
      <h3 className={`mt-2 ${champion ? 'text-h3' : 'text-lg font-semibold'}`}>{story.title}</h3>
      <p className="text-sm text-muted">tác giả {story.author}</p>
      {champion && <p className="mt-3 text-sm leading-6 text-muted">{story.description}</p>}
      <div className="mb-4 mt-4 flex items-center justify-between border-t border-hairline pt-3 text-xs">
        <span className="flex items-center gap-1 font-semibold tabular-nums">
          <Star size={13} className="fill-orange text-orange" aria-hidden="true" />
          {story.rating}
        </span>
        <span className="tabular-nums text-muted">
          <strong className="text-ink">{story.reads}</strong> lượt đọc
        </span>
      </div>
      <ButtonLink
        to={`/stories/${story.id || 'demo'}`}
        variant={champion ? 'primary' : 'secondary'}
        size="sm"
        trailingIcon={champion ? ArrowRight : undefined}
        className="mt-auto w-full"
      >
        {champion ? 'Bắt đầu đọc' : 'Đọc thử'}
      </ButtonLink>
    </Card>
  );
}

/* Same card min-heights, cover cap and rows as PodiumCard; `champion` adds the blurb lines. */
export function PodiumCardSkeleton({ champion = false }) {
  return (
    <Card
      as="div"
      aria-hidden="true"
      className={`relative flex h-full flex-col p-5 ${champion ? 'border-orange/70 lg:-mt-4 lg:min-h-[440px]' : 'lg:min-h-[400px]'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-12" />
      </div>
      <Skeleton className="mt-4 aspect-[2/3] max-h-56 w-full rounded-2xl" />
      <Skeleton className="mt-4 h-6 w-20" />
      <span className="mt-2 flex h-7 items-center">
        <Skeleton className="h-5 w-3/4" />
      </span>
      <span className="flex h-5 items-center">
        <Skeleton className="h-3 w-1/2" />
      </span>
      {champion && (
        <span className="mt-3 flex flex-col gap-3 py-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full lg:w-3/5" />
          <Skeleton className="h-3 w-2/5 lg:hidden" />
        </span>
      )}
      <div className="mb-4 mt-4 flex h-[1.8125rem] items-end justify-between border-t border-hairline">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="mt-auto h-9 w-full" />
    </Card>
  );
}
