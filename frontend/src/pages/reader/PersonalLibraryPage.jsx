import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Grid2X2,
  List,
  RefreshCw,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { LibraryCard, LibraryCardSkeleton } from '../../components/reader/LibraryCard'
import { useReaderFeed } from '../../components/reader/useReaderFeed'
import { Badge, Button, ButtonLink, Card, EmptyState, Skeleton, Tabs } from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'
import { followStory } from '../../api/community'
import { useLocale } from '../../context/LocaleContext'

const TABS = ['all', 'reading', 'following', 'completed']
const SKELETONS = 8

export function PersonalLibraryPage() {
  const { t } = useLocale()
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [view, setView] = useState('grid')
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState(null)
  const library = useReaderFeed(`/reader/library?tab=${tab}&page=${page}`)
  const data = library.data
  const counts = data?.counts
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const changeTab = value => {
    setTab(value)
    setPage(1)
    setNotice(null)
  }
  const unfollow = async item => {
    setBusyId(item.story.id)
    setNotice(null)
    try {
      await followStory(item.story.id, false)
      setNotice({ tone: 'status', text: t('library.unfollowed', { title: item.story.title }) })
      /* The last item of a later page moves the reader back one page. */
      if (tab === 'following' && data.items.length === 1 && page > 1) setPage(page - 1)
      else library.reload()
    } catch (error) {
      setNotice({ tone: 'alert', text: error.message })
    } finally {
      setBusyId(null)
    }
  }
  const views = [
    ['grid', t('library.gridView'), Grid2X2],
    ['list', t('library.listView'), List],
  ]
  return (
    <ReaderLayout>
      <div className="page-reader py-6">
        <Card bezel innerClassName="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-h2 sm:text-h1">{t('library.title')}</h1>
            {counts ? (
              <Badge tone="green">{t('library.totalStories', { count: counts.all })}</Badge>
            ) : (
              library.status === 'loading' && <Skeleton className="h-6 w-36" />
            )}
          </div>
          <p className="mt-2 text-sm text-muted">{t('library.description')}</p>
        </Card>

        <section
          aria-label={t('library.filters')}
          className="mt-6 flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <Tabs
            singleRow
            label={t('library.filterByStatus')}
            value={tab}
            onChange={changeTab}
            items={TABS.map(value => ({
              value,
              label: counts
                ? `${t(`library.tab.${value}`)} (${counts[value] ?? 0})`
                : t(`library.tab.${value}`),
            }))}
          />
          <div
            role="group"
            aria-label={t('library.viewMode')}
            className="flex items-center gap-1 self-start rounded-full border border-hairline bg-elevated p-1 pointer-coarse:gap-2"
          >
            {views.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`grid size-9 place-items-center rounded-full transition-[background-color,color] duration-200 pointer-coarse:size-11 ${view === value ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-surface hover:text-ink'}`}
              >
                <Icon size={17} />
              </button>
            ))}
          </div>
        </section>

        {notice && (
          <p
            role={notice.tone}
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${notice.tone === 'alert' ? 'bg-rose/10 text-rose-strong' : 'bg-brand-soft text-brand-strong'}`}
          >
            {notice.text}
          </p>
        )}

        {library.status === 'loading' ? (
          <section
            aria-busy="true"
            aria-label={t('library.loading')}
            className={`mt-6 ${view === 'grid' ? 'nh-grid-12 grid nh-cols-2 gap-3 nh-md-cols-3 nh-xl-cols-4' : 'space-y-3'}`}
          >
            {Array.from({ length: SKELETONS }, (_, index) => (
              <LibraryCardSkeleton key={index} view={view} />
            ))}
          </section>
        ) : library.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={t('library.error')}
              description={library.error?.message}
              action={
                <Button variant="secondary" size="sm" onClick={library.retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {t('library.retry')}
                </Button>
              }
            />
          </Card>
        ) : !data.items.length ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={BookOpen}
              title={t(`library.empty.${tab}`)}
              description={t('library.emptyDescription')}
              action={
                <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                  {t('library.explore')}
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <>
            <section
              aria-label={t('library.items')}
              className={`nh-fade-enter mt-6 ${view === 'grid' ? 'nh-grid-12 grid nh-cols-2 gap-3 nh-md-cols-3 nh-xl-cols-4' : 'space-y-3'}`}
            >
              {data.items.map(item => (
                <LibraryCard
                  key={item.story.id}
                  item={item}
                  view={view}
                  busy={busyId === item.story.id}
                  onUnfollow={unfollow}
                />
              ))}
            </section>
            <div className="mt-6">
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </ReaderLayout>
  )
}
