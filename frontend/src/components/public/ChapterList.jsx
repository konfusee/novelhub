import { Coins, Lock } from '../icons'
import { Badge, ButtonLink, Skeleton } from '../ui'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

/**
 * Published chapters of one story. Each chapter carries its 1-based reading `number`.
 * Guests may preview chapter 1 only; early-access chapters show the coin price and end date,
 * unless this Reader already unlocked them (`unlocked`).
 */
export function ChapterList({ chapters, storyId }) {
  const { isAuthenticated } = useAuth()
  const { t, formatDate } = useLocale()
  return (
    <ol className="space-y-3">
      {chapters.map(chapter => {
        const guestPreview = !isAuthenticated && chapter.number === 1
        const readable = (isAuthenticated || guestPreview) && !chapter.locked
        const readHref = ROUTES.read(storyId, chapter.id)
        return (
          <li
            className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition-[border-color,background-color] duration-200 ease-spring sm:px-5 ${readable ? 'border-hairline bg-surface hover:border-brand/40' : 'border-hairline bg-elevated'}`}
            key={chapter.id}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[.1em] text-brand-strong">
                  {t('story.chapterNumber', { number: chapter.number })}
                </span>
                {chapter.locked ? (
                  <Badge tone="orange" data-testid="chapter-lock">
                    <Lock size={11} aria-hidden="true" />
                    {t('story.earlyAccess')}
                    {chapter.earlyAccess?.coinPrice != null && (
                      <>
                        {' · '}
                        <Coins size={11} aria-hidden="true" />
                        {t('story.coinPrice', { count: chapter.earlyAccess.coinPrice })}
                      </>
                    )}
                  </Badge>
                ) : chapter.unlocked ? (
                  <Badge tone="green" data-testid="chapter-unlocked">
                    {t('story.unlockedBadge')}
                  </Badge>
                ) : (
                  guestPreview && <Badge tone="green">{t('story.freePreview')}</Badge>
                )}
              </div>
              <h3
                className={`mt-1.5 text-sm font-semibold sm:text-base ${readable ? '' : 'text-ink/70'}`}
              >
                {chapter.title}
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {chapter.locked && chapter.earlyAccess?.endsAt
                  ? t('story.earlyAccessEnds', { date: formatDate(chapter.earlyAccess.endsAt) })
                  : chapter.publishedAt
                    ? formatDate(chapter.publishedAt)
                    : ''}
              </p>
            </div>
            <ButtonLink
              to={
                isAuthenticated
                  ? readHref
                  : guestPreview
                    ? `/stories/${storyId}/preview/${chapter.id}`
                    : ROUTES.login
              }
              state={!isAuthenticated && !guestPreview ? { from: readHref } : undefined}
              variant={readable ? 'outline' : 'secondary'}
              size="sm"
              className="shrink-0"
            >
              {!readable && <Lock size={13} aria-hidden="true" />}
              {isAuthenticated
                ? t(chapter.locked ? 'story.unlock' : 'story.read')
                : guestPreview
                  ? t('story.preview')
                  : t('auth.signIn')}
            </ButtonLink>
          </li>
        )
      })}
    </ol>
  )
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
  )
}
