import { useSearchParams } from 'react-router'
import { AlertTriangle, BookOpen, RefreshCw } from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { CategoryCard, CategoryCardSkeleton } from '../../components/public/CategoryCard'
import { CatalogResults } from '../../components/public/CatalogResults'
import { SearchFilters } from '../../components/public/SearchFilters'
import {
  CATALOG_PAGE_SIZE,
  CATALOG_SORTS,
  CATALOG_STATUSES,
  pick,
  useCatalogCategories,
  useCatalogStories,
} from '../../components/public/catalog'
import { Button, Card, EmptyState } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

const tones = ['purple', 'rose', 'green', 'orange', 'blue', 'neutral']

export function CategoriesPage({ embedded = false }) {
  const { t } = useLocale()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const status = pick(params.get('status'), CATALOG_STATUSES)
  const sort = pick(params.get('sort'), CATALOG_SORTS, 'popular')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const categories = useCatalogCategories()
  const stories = useCatalogStories({
    category,
    status,
    sort,
    page,
    pageSize: CATALOG_PAGE_SIZE,
  })
  const update = next => {
    const merged = { category, status, sort, page: 1, ...next }
    const search = new URLSearchParams()
    if (merged.category) search.set('category', merged.category)
    if (merged.status) search.set('status', merged.status)
    if (merged.sort !== 'popular') search.set('sort', merged.sort)
    if (merged.page > 1) search.set('page', String(merged.page))
    setParams(search)
  }
  const selected = categories.data.find(item => item.id === category)
  const Root = embedded ? 'div' : 'main'
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-12 pb-20 pt-6 lg:pt-10">
        <header className="max-w-3xl">
          <p className="nh-eyebrow">{t('search.categoriesEyebrow')}</p>
          <h1 className="mt-4 text-h1 md:text-4xl">{t('search.categoriesTitle')}</h1>
          <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted">
            {t('search.categoriesDescription')}
          </p>
        </header>
        <section aria-labelledby="category-list-title">
          <h2 id="category-list-title" className="mb-5 text-h3 md:text-h2">
            {t('search.allCategoriesTitle')}
          </h2>
          {categories.status === 'loading' ? (
            <div
              aria-busy="true"
              aria-label={t('search.loading')}
              className="nh-grid-12 grid gap-4 nh-sm-cols-2 nh-lg-cols-3"
            >
              {[0, 1, 2].map(index => (
                <CategoryCardSkeleton key={index} />
              ))}
            </div>
          ) : categories.status === 'error' ? (
            <Card className="p-0">
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title={t('search.categoriesFailed')}
                description={categories.error?.message}
                action={
                  <Button variant="secondary" size="sm" onClick={categories.retry}>
                    <RefreshCw size={14} aria-hidden="true" />
                    {t('search.retry')}
                  </Button>
                }
              />
            </Card>
          ) : categories.status === 'empty' ? (
            <Card className="p-0">
              <EmptyState
                icon={BookOpen}
                title={t('search.noCategories')}
                description={t('search.noCategoriesDescription')}
              />
            </Card>
          ) : (
            <ul className="nh-grid-12 grid gap-4 nh-sm-cols-2 nh-lg-cols-3">
              {categories.data.map((item, index) => (
                <li key={item.id}>
                  <CategoryCard
                    category={{ ...item, tone: tones[index % tones.length] }}
                    selected={item.id === category}
                    onSelect={id => update({ category: id === category ? '' : id })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          aria-labelledby="category-stories-title"
          className="nh-grid-12 grid gap-8 nh-layout-lg-3-9"
        >
          <aside className="self-start rounded-3xl border border-hairline bg-surface p-5 lg:sticky lg:top-24">
            <SearchFilters
              idPrefix="categories"
              categories={categories.data}
              categoriesStatus={categories.status}
              category={category}
              status={status}
              sort={sort}
              onChange={update}
              onReset={() => setParams(new URLSearchParams())}
            />
          </aside>
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="category-stories-title" className="text-h3">
                {selected ? selected.name : t('search.allStoriesTitle')}
              </h2>
              {stories.status === 'ready' && (
                <span className="text-sm text-muted" aria-live="polite">
                  {t('search.storyCount', { count: stories.data.total })}
                </span>
              )}
            </div>
            <CatalogResults resource={stories} onPageChange={value => update({ page: value })} />
          </div>
        </section>
      </Root>
    </div>
  )
}
