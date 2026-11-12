import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Filter, Search, X } from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
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
import { Badge, Button, Card, Drawer, Input } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

export function SearchResultsPage({ embedded = false }) {
  const { t } = useLocale()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const q = (params.get('q') ?? '').trim()
  const category = params.get('category') ?? ''
  const tag = (params.get('tag') ?? '').trim().replace(/^#/, '').replace(/\s+/g, '')
  const status = pick(params.get('status'), CATALOG_STATUSES)
  const sort = pick(params.get('sort'), CATALOG_SORTS, 'newest')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const categories = useCatalogCategories()
  const stories = useCatalogStories({
    q,
    category,
    tag,
    status,
    sort,
    page,
    pageSize: CATALOG_PAGE_SIZE,
  })
  const update = next => {
    const merged = { q, category, tag, status, sort, page: 1, ...next }
    const search = new URLSearchParams()
    if (merged.q) search.set('q', merged.q)
    if (merged.category) search.set('category', merged.category)
    if (merged.tag) search.set('tag', merged.tag)
    if (merged.status) search.set('status', merged.status)
    if (merged.sort !== 'newest') search.set('sort', merged.sort)
    if (merged.page > 1) search.set('page', String(merged.page))
    setParams(search)
  }
  const reset = () => update({ category: '', tag: '', status: '', sort: 'newest' })
  const appliedCount = (category ? 1 : 0) + (tag ? 1 : 0) + (status ? 1 : 0)
  const filterProps = {
    categories: categories.data,
    categoriesStatus: categories.status,
    category,
    status,
    sort,
    onChange: update,
    onReset: reset,
  }
  const Root = embedded ? 'div' : 'main'
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <section className="mt-4 bg-transparent">
        <div className="mx-auto grid max-w-[1360px] gap-6 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-12">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-xs text-muted">
              <Link to="/" className="inline-flex min-h-8 items-center hover:text-brand-strong">
                {t('navigation.home')}
              </Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{t('common.search')}</span>
            </nav>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-h1 md:text-4xl">{t('search.results')}</h1>
              {stories.status !== 'loading' && stories.status !== 'error' && (
                <span className="text-sm text-muted" aria-live="polite">
                  {t('search.showingFor', {
                    count: stories.data.total,
                    query: q || (tag ? `#${tag}` : t('search.allStories')),
                  })}
                </span>
              )}
            </div>
            {tag && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone="green" className="pr-1.5">
                  {t('search.tagFilter', { tag })}
                  <button
                    type="button"
                    aria-label={t('search.clearTag', { tag })}
                    onClick={() => update({ tag: '' })}
                    className="-my-1.5 -mr-1 grid size-8 place-items-center rounded-full transition-colors hover:bg-brand/20 pointer-coarse:-my-2.5 pointer-coarse:-mr-2 pointer-coarse:size-11"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </Badge>
              </div>
            )}
          </div>
          <form
            key={q}
            role="search"
            className="flex gap-2"
            onSubmit={event => {
              event.preventDefault()
              update({ q: String(new FormData(event.currentTarget).get('q') ?? '').trim() })
            }}
          >
            <Input
              icon={Search}
              type="search"
              name="q"
              defaultValue={q}
              aria-label={t('search.queryLabel')}
              placeholder={t('search.queryLabel')}
              className="w-full sm:w-72"
            />
            <Button type="submit" className="shrink-0">
              {t('common.search')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFiltersOpen(true)}
              aria-expanded={filtersOpen}
              className="shrink-0 gap-1.5 px-3 lg:hidden"
            >
              <Filter size={16} aria-hidden="true" />
              <span className="max-[359px]:sr-only">{t('search.filters')}</span>
              {appliedCount > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold tabular-nums text-on-brand">
                  {appliedCount}
                </span>
              )}
            </Button>
          </form>
        </div>
      </section>
      <Root className="nh-grid-12 page-public grid gap-y-6 pb-20 pt-8 nh-layout-lg-3-9">
        <aside className="hidden self-start lg:block">
          <Card className="p-5">
            <SearchFilters idPrefix="search" {...filterProps} />
          </Card>
        </aside>
        <section className="min-w-0" aria-label={t('search.results')}>
          <CatalogResults
            resource={stories}
            onPageChange={value => update({ page: value })}
            emptyAction={
              (appliedCount > 0 || q) && (
                <Button variant="secondary" size="sm" onClick={() => setParams({})}>
                  {t('search.resetFilters')}
                </Button>
              )
            }
          />
        </section>
      </Root>
      <Drawer
        open={filtersOpen}
        title={t('search.searchFilters')}
        onClose={() => setFiltersOpen(false)}
      >
        <SearchFilters idPrefix="search-drawer" showHeading={false} {...filterProps} />
      </Drawer>
    </div>
  )
}
