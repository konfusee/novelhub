import { useSearchParams } from 'react-router'
import { AlertTriangle, ArrowRight, RefreshCw, Trophy } from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { RankingRow, RankingRowSkeleton } from '../../components/public/RankingRow'
import {
  CATALOG_SORTS,
  pick,
  useCatalogCategories,
  useCatalogStories,
} from '../../components/public/catalog'
import { Button, ButtonLink, Card, EmptyState, Select, Tabs } from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'
import { useLocale } from '../../context/LocaleContext'

const PAGE_SIZE = 20

export function RankingsPage({ embedded = false }) {
  const { t, formatDate } = useLocale()
  const [params, setParams] = useSearchParams()
  const sort = pick(params.get('sort'), CATALOG_SORTS, 'popular')
  const category = params.get('category') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const categories = useCatalogCategories()
  const board = useCatalogStories({ sort, category, page, pageSize: PAGE_SIZE })
  const update = next => {
    const merged = { sort, category, page: 1, ...next }
    const search = new URLSearchParams()
    if (merged.sort !== 'popular') search.set('sort', merged.sort)
    if (merged.category) search.set('category', merged.category)
    if (merged.page > 1) search.set('page', String(merged.page))
    setParams(search)
  }
  const metricFor = story =>
    sort === 'popular'
      ? t('rankings.popularityValue', { count: story.popularity })
      : sort === 'rating'
        ? t('rankings.ratingValue', { count: story.ratingCount })
        : story.publishedAt
          ? formatDate(story.publishedAt)
          : '—'
  const Root = embedded ? 'div' : 'main'
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-8 pb-20 pt-6 lg:pt-10">
        <header>
          <div className="max-w-3xl">
            <p className="nh-eyebrow">{t('rankings.eyebrow')}</p>
            <h1 className="mt-4 text-h1 md:text-4xl">{t('rankings.title')}</h1>
            <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted">
              {t('rankings.intro')}
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-b border-hairline pb-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <Tabs
                label={t('rankings.criteria')}
                singleRow
                value={sort}
                onChange={value => update({ sort: value })}
                items={CATALOG_SORTS.map(value => ({ value, label: t(`rankings.tabs.${value}`) }))}
              />
            </div>
            <Select
              aria-label={t('search.genres')}
              value={category}
              onChange={event => update({ category: event.target.value })}
              className="md:w-64"
            >
              <option value="">{t('search.allCategories')}</option>
              {categories.data.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-3 text-sm text-muted">{t(`rankings.help.${sort}`)}</p>
        </header>
        {board.status === 'loading' ? (
          <Card
            aria-busy="true"
            aria-label={t('rankings.updating')}
            className="divide-y divide-hairline overflow-hidden p-0"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <RankingRowSkeleton key={index} />
            ))}
          </Card>
        ) : board.status === 'error' ? (
          <Card className="p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={t('rankings.loadFailed')}
              description={board.error?.message}
              action={
                <Button variant="secondary" size="sm" onClick={board.retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {t('search.retry')}
                </Button>
              }
            />
          </Card>
        ) : board.status === 'empty' ? (
          <Card className="p-0">
            <EmptyState
              icon={Trophy}
              title={t('rankings.emptyTitle')}
              description={t('rankings.emptyDescription')}
              action={
                <ButtonLink to="/search" size="sm" trailingIcon={ArrowRight}>
                  {t('home.exploreStories')}
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <section aria-label={t(`rankings.tabs.${sort}`)}>
            {board.data.page === 1 && board.data.items.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-h3">{t('rankings.topFive')}</h2>
                <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {board.data.items.slice(0, 5).map((story, index) => (
                    <li key={story.id}>
                      <RankingRow
                        rank={index + 1}
                        story={story}
                        metric={metricFor(story)}
                        featured
                      />
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {((board.data.page === 1 && board.data.items.length > 5) || board.data.page > 1) && (
              <>
                <h2 className="mb-3 text-h3">{t('rankings.remaining')}</h2>
                <Card as="ol" className="divide-y divide-hairline overflow-hidden p-0">
                  {(board.data.page === 1 ? board.data.items.slice(5) : board.data.items).map(
                    (story, index) => (
                      <li key={story.id}>
                        <RankingRow
                          rank={
                            (board.data.page - 1) * board.data.pageSize +
                            (board.data.page === 1 ? index + 6 : index + 1)
                          }
                          story={story}
                          metric={metricFor(story)}
                        />
                      </li>
                    ),
                  )}
                </Card>
              </>
            )}
            <Pagination
              page={board.data.page}
              pageCount={Math.max(1, Math.ceil(board.data.total / board.data.pageSize))}
              onChange={value => update({ page: value })}
            />
          </section>
        )}
      </Root>
    </div>
  )
}
