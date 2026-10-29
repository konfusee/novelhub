import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  ChevronRight,
  RefreshCw,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { SavedStoryCard, SavedStoryCardSkeleton } from '../../components/reader/SavedStoryCard'
import { useReaderFeed } from '../../components/reader/useReaderFeed'
import { Badge, Button, ButtonLink, Card, EmptyState, Skeleton } from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'
import { followStory } from '../../api/community'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const SKELETONS = 4

export function FollowingPage() {
  const { t } = useLocale()
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)
  const feed = useReaderFeed(`/reader/library?tab=following&page=${page}`)
  const data = feed.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const withUpdates = data?.items.filter(item => item.newChapters > 0).length ?? 0
  const unfollow = async item => {
    setBusyId(item.story.id)
    setNotice(null)
    try {
      await followStory(item.story.id, false)
      setNotice({ tone: 'status', text: t('following.unfollowed', { title: item.story.title }) })
      if (data.items.length === 1 && page > 1) setPage(page - 1)
      else feed.reload()
    } catch (error) {
      setNotice({ tone: 'alert', text: error.message })
    } finally {
      setBusyId(null)
    }
  }
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-muted">
            <li>
              <Link to={ROUTES.library} className="transition-colors hover:text-ink">
                {t('navigation.library')}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li aria-current="page" className="font-medium text-brand-strong">
              {t('following.pageTitle')}
            </li>
          </ol>
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-h2 sm:text-h1">{t('following.pageTitle')}</h1>
          {data ? (
            <Badge tone="green">{t('following.totalFollowed', { count: data.total })}</Badge>
          ) : (
            feed.status === 'loading' && <Skeleton className="h-6 w-32" />
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {t('following.pageDescription')}
        </p>
        {data && withUpdates > 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-strong">
            <BellRing size={16} aria-hidden="true" />
            {t('following.storiesWithUpdates', { count: withUpdates })}
          </p>
        )}
        {notice && (
          <p
            role={notice.tone}
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${notice.tone === 'alert' ? 'bg-rose/10 text-rose-strong' : 'bg-brand-soft text-brand-strong'}`}
          >
            {notice.text}
          </p>
        )}
        {feed.status === 'loading' ? (
          <div
            aria-busy="true"
            aria-label={t('following.loading')}
            className="nh-grid-12 mt-6 grid gap-4 nh-md-cols-2"
          >
            {Array.from({ length: SKELETONS }, (_, index) => (
              <SavedStoryCardSkeleton key={index} />
            ))}
          </div>
        ) : feed.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={t('following.error')}
              description={feed.error?.message}
              action={
                <Button variant="secondary" size="sm" onClick={feed.retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {t('following.retry')}
                </Button>
              }
            />
          </Card>
        ) : !data.items.length ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={BellRing}
              title={t('following.empty')}
              description={t('following.emptyDescription')}
              action={
                <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                  {t('following.explore')}
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <>
            <div className="nh-fade-enter nh-grid-12 mt-6 grid gap-4 nh-md-cols-2">
              {data.items.map(item => (
                <SavedStoryCard
                  key={item.story.id}
                  item={item}
                  busy={busyId === item.story.id}
                  onUnfollow={unfollow}
                />
              ))}
            </div>
            <div className="mt-6">
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </ReaderLayout>
  )
}
