import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpen,
  ChevronRight,
  Compass,
  PenLine,
  RefreshCw,
  Star,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { ContinueCard, ContinueCardSkeleton } from '../../components/reader/ContinueCard'
import { resumeHref } from '../../components/reader/readerLinks'
import { StoryCover } from '../../components/story/StoryCover'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  SectionHeader,
  Skeleton,
} from '../../components/ui'
import { useBackendResource } from '../../api/useBackendResource'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

const NO_ITEMS = Object.freeze([])
const CONTINUE_LIMIT = 4
const DISCOVERY_SIZE = 6
const withNewChapters = response => {
  if (!Array.isArray(response.items)) throw new Error('Invalid library response')
  return response.items.filter(item => item.newChapters > 0)
}

function ErrorCard({ title, onRetry, t }) {
  return (
    <Card className="mt-4 p-0">
      <EmptyState
        tone="rose"
        headingAs="h3"
        icon={AlertTriangle}
        title={title}
        description={t('readerHome.errorDescription')}
        action={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden="true" />
            {t('readerHome.retry')}
          </Button>
        }
      />
    </Card>
  )
}

function StoryTileSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-3">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <span className="mt-3 flex h-5 items-center">
        <Skeleton className="h-3.5 w-4/5" />
      </span>
      <span className="flex h-4 items-center">
        <Skeleton className="h-2.5 w-1/2" />
      </span>
      <span className="mt-1.5 flex h-4 items-center">
        <Skeleton className="h-3 w-10" />
      </span>
    </Card>
  )
}

function StoryTile({ story, t }) {
  const href = ROUTES.story(story.id)
  return (
    <Card as="article" interactive className="group flex flex-col p-3">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="block">
        <StoryCover
          story={story}
          className="aspect-[2/3] rounded-2xl"
          badge={
            story.genre && (
              <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] rounded-full bg-surface/90 shadow-whisper">
                <Badge tone="purple" className="max-w-full">
                  <span className="truncate">{story.genre}</span>
                </Badge>
              </span>
            )
          }
        />
      </Link>
      <h3 className="mt-3 line-clamp-2 whitespace-normal text-sm font-semibold" title={story.title}>
        <Link to={href} className="whitespace-normal transition-colors hover:text-brand">
          {story.title}
        </Link>
      </h3>
      <p className="truncate text-xs text-muted" title={story.author}>
        {story.author}
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-ink/80">
        <Star size={12} aria-hidden="true" className="fill-orange text-orange" />
        {story.rating}
        <span className="sr-only">{t('readerHome.ratingCount', { count: story.ratingCount })}</span>
        <span aria-hidden="true" className="text-muted">
          ({story.ratingCount})
        </span>
      </p>
    </Card>
  )
}

export function ReaderHomePage() {
  const { currentUser, hasRole } = useAuth()
  const { t } = useLocale()
  const reading = useBackendResource('/reader/library?tab=reading')
  const updates = useBackendResource('/reader/library?tab=following', NO_ITEMS, withNewChapters)
  const discovery = useBackendResource(`/catalog/stories?sort=popular&pageSize=${DISCOVERY_SIZE}`)
  return (
    <ReaderLayout>
      <div className="page-reader py-6">
        {!hasRole('author') && (
          <Card className="mb-6 flex flex-col gap-4 border-brand/25 bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-brand-strong">
                <PenLine size={22} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{t('reader.authorInvitationTitle')}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {t('reader.authorInvitationDescription')}
                </p>
              </div>
            </div>
            <ButtonLink to={ROUTES.authorApply} trailingIcon={ArrowRight} className="shrink-0">
              {t('navigation.becomeAuthor')}
            </ButtonLink>
          </Card>
        )}
        <Card bezel as="section" innerClassName="p-6 sm:p-8">
          <p className="nh-eyebrow">{t('readerHome.sanctuary')}</p>
          <h1 className="mt-3 text-h2 sm:text-h1">
            {t('readerHome.welcome', {
              name: currentUser?.name?.split(' ')[0] || t('auth.reader'),
            })}
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            {t('readerHome.nextChapterWaiting')}
          </p>
          <ButtonLink to={ROUTES.library} trailingIcon={ArrowRight} className="mt-5">
            {t('readerHome.openLibrary')}
          </ButtonLink>
        </Card>

        <div className="nh-grid-12 mt-8 grid gap-6 nh-layout-2xl-8-4">
          <div className="min-w-0 space-y-8">
            <section>
              <SectionHeader
                title={t('readerHome.pickUp')}
                description={t('readerHome.pickUpDescription')}
                action={
                  <Link
                    to={ROUTES.library}
                    className="inline-flex min-h-9 items-center gap-1 rounded-full text-sm font-semibold text-brand-strong transition-colors hover:text-brand"
                  >
                    {t('readerHome.seeAll')} <ChevronRight size={15} />
                  </Link>
                }
              />
              {reading.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label={t('readerHome.loadingReading')}
                  className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2"
                >
                  <ContinueCardSkeleton />
                  <ContinueCardSkeleton />
                </div>
              ) : reading.status === 'error' ? (
                <ErrorCard title={t('readerHome.readingError')} onRetry={reading.retry} t={t} />
              ) : reading.status === 'empty' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    headingAs="h3"
                    icon={BookOpen}
                    title={t('readerHome.readingEmpty')}
                    description={t('readerHome.readingEmptyDescription')}
                    action={
                      <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                        {t('readerHome.explore')}
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : (
                <div className="nh-fade-enter nh-grid-12 mt-4 grid gap-4 nh-md-cols-2">
                  {reading.data.slice(0, CONTINUE_LIMIT).map(item => (
                    <ContinueCard key={item.story.id} item={item} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                title={t('readerHome.popular')}
                description={t('readerHome.popularDescription')}
                action={
                  <Link
                    to="/reader/explore"
                    className="inline-flex min-h-9 items-center gap-1 rounded-full text-sm font-semibold text-brand-strong transition-colors hover:text-brand"
                  >
                    {t('readerHome.seeAll')} <ChevronRight size={15} />
                  </Link>
                }
              />
              {discovery.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label={t('readerHome.loadingPopular')}
                  className="nh-grid-12 mt-4 grid nh-cols-2 gap-3 nh-sm-cols-3"
                >
                  {Array.from({ length: DISCOVERY_SIZE }, (_, index) => (
                    <StoryTileSkeleton key={index} />
                  ))}
                </div>
              ) : discovery.status === 'error' ? (
                <ErrorCard title={t('readerHome.popularError')} onRetry={discovery.retry} t={t} />
              ) : discovery.status === 'empty' ? (
                <Card className="mt-4 p-0">
                  <EmptyState headingAs="h3" icon={Compass} title={t('readerHome.popularEmpty')} />
                </Card>
              ) : (
                <div className="nh-fade-enter nh-grid-12 mt-4 grid nh-cols-2 gap-3 nh-sm-cols-3">
                  {discovery.data.map(story => (
                    <StoryTile key={story.id} story={story} t={t} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="min-w-0">
            <SectionHeader
              title={t('readerHome.recentlyUpdated')}
              description={t('readerHome.recentlyUpdatedDescription')}
            />
            {updates.status === 'loading' ? (
              <Card
                aria-busy="true"
                aria-label={t('readerHome.loadingUpdates')}
                className="mt-4 divide-y divide-hairline p-0"
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} aria-hidden="true" className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-14 w-10 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </span>
                  </div>
                ))}
              </Card>
            ) : updates.status === 'error' ? (
              <ErrorCard title={t('readerHome.updatesError')} onRetry={updates.retry} t={t} />
            ) : updates.status === 'empty' ? (
              <Card className="mt-4 p-0">
                <EmptyState
                  headingAs="h3"
                  icon={BellRing}
                  title={t('readerHome.updatesEmpty')}
                  description={t('readerHome.updatesEmptyDescription')}
                  action={
                    <ButtonLink to="/reader/following" size="sm" trailingIcon={ArrowRight}>
                      {t('readerHome.manageFollowing')}
                    </ButtonLink>
                  }
                />
              </Card>
            ) : (
              <Card className="nh-fade-enter mt-4 divide-y divide-hairline p-0">
                {updates.data.map(item => (
                  <div className="group flex items-center gap-3 px-4 py-3" key={item.story.id}>
                    <StoryCover story={item.story} className="h-14 w-10 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <h3
                        className="line-clamp-2 whitespace-normal text-sm font-semibold"
                        title={item.story.title}
                      >
                        {item.story.title}
                      </h3>
                      <p className="truncate text-xs text-brand-strong">
                        {t('readerHome.newChapters', { count: item.newChapters })}
                      </p>
                    </div>
                    <ButtonLink
                      to={resumeHref(item.story.id, item.resume)}
                      variant="outline"
                      size="sm"
                      aria-label={t('readerHome.readStory', { title: item.story.title })}
                      className="shrink-0 px-4"
                    >
                      {t('readerHome.read')}
                    </ButtonLink>
                  </div>
                ))}
              </Card>
            )}
          </aside>
        </div>
      </div>
    </ReaderLayout>
  )
}
