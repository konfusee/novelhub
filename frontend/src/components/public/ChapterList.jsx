import { Lock } from '../icons';
import { Badge, ButtonLink, Skeleton } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

export function ChapterList({ chapters, storyId }) {
  const { isAuthenticated } = useAuth();
  const { t } = useLocale();
  return (
    <ol className="space-y-3">
      {chapters.map((chapter) => {
        const readable = chapter.free || isAuthenticated;
        return (
          <li
            className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-[border-color,background-color] duration-200 ease-spring sm:px-5 ${readable ? 'border-hairline bg-surface hover:border-brand/40' : 'border-hairline bg-elevated'}`}
            key={chapter.number}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[.1em] text-brand-strong">
                  {t('story.chapterNumber', { number: chapter.number })}
                </span>
                <Badge tone={chapter.free ? 'green' : 'neutral'}>
                  {chapter.free ? (
                    t('story.freePreview')
                  ) : (
                    <>
                      <Lock size={11} aria-hidden="true" />
                      {t('story.locked')}
                    </>
                  )}
                </Badge>
              </div>
              <h3
                className={`mt-1.5 text-sm font-semibold sm:text-base ${readable ? '' : 'text-ink/70'}`}
              >
                {chapter.title}
              </h3>
              <p className="mt-0.5 text-xs text-muted">{chapter.meta}</p>
            </div>
            <ButtonLink
              to={
                isAuthenticated
                  ? `/read/${storyId}/${chapter.id ?? `chapter-${chapter.number}`}`
                  : chapter.free
                    ? `/stories/${storyId}/preview/${chapter.id ?? `chapter-${chapter.number}`}`
                    : '/login'
              }
              state={
                !isAuthenticated && !chapter.free
                  ? { from: `/read/${storyId}/${chapter.id ?? `chapter-${chapter.number}`}` }
                  : undefined
              }
              variant={readable ? 'outline' : 'secondary'}
              size="sm"
              className="shrink-0"
            >
              {!readable && <Lock size={13} aria-hidden="true" />}
              {isAuthenticated
                ? t('story.read')
                : chapter.free
                  ? t('story.preview')
                  : t('auth.signIn')}
            </ButtonLink>
          </li>
        );
      })}
    </ol>
  );
}

/* Chapter rows at ChapterList's padding and line heights (label + badge, title, meta, button). */
export function ChapterListSkeleton({ count = 5 }) {
  return (
    <ol aria-hidden="true" className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface p-4 sm:px-5"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
            <span className="mt-1.5 flex flex-col justify-center gap-2 sm:h-6">
              <Skeleton className="mt-1 h-3.5 w-3/5 sm:mt-0 sm:h-4" />
              <Skeleton className="mb-0.5 h-3.5 w-2/5 sm:hidden" />
            </span>
            <span className="mt-0.5 flex h-4 items-center">
              <Skeleton className="h-2.5 w-2/5" />
            </span>
          </div>
          <Skeleton className="h-9 w-20 shrink-0" />
        </li>
      ))}
    </ol>
  );
}
