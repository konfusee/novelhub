import { useMemo, useState } from 'react'
import { Filter, Flame, Search, X } from 'lucide-react'
import { PublicHeader } from '../../components/public/PublicHeader'
import { SearchFilters } from '../../components/public/SearchFilters'
import { SearchResultItem } from '../../components/public/SearchResultItem'
import { Card, Input, Select } from '../../components/ui'
import { searchResults, trendingSearches } from '../../data/mock/search'

const resultTabs = ['All Results', 'Stories', 'Audiobooks', 'Authors']
export function SearchResultsPage({ embedded = false }) {
  const [query, setQuery] = useState('moon')
  const [sort, setSort] = useState('Relevance')
  const [tab, setTab] = useState('All Results')
  const [checked, setChecked] = useState([
    'Stories',
    'Audiobooks',
    'Authors',
    'Fantasy',
    'Romance',
    'Text Story',
    'Audiobook Edition',
  ])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [applied, setApplied] = useState(checked.length)
  const results = useMemo(
    () =>
      searchResults.filter(result =>
        `${result.title} ${result.author} ${result.genres.join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  )
  const visibleResults = useMemo(() => {
    if (tab === 'Stories') return results.filter(result => result.format === 'Story')
    if (tab === 'Audiobooks') return results.filter(result => result.format === 'Audio')
    return results
  }, [results, tab])
  const toggle = item =>
    setChecked(current =>
      current.includes(item) ? current.filter(value => value !== item) : [...current, item],
    )
  const reset = () => {
    setChecked([])
    setApplied(0)
  }
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-[1360px] gap-5 px-5 py-7 md:px-8 lg:grid-cols-[1fr_auto] lg:items-end lg:px-12">
          <div>
            <p className="text-xs text-muted">Home / Search</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Search Results</h1>
              <span className="text-sm text-muted">
                Showing 148 results for{' '}
                <strong className="text-brand">“{query || 'all stories'}”</strong>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="w-full sm:w-72"
            />
            <Select
              value={sort}
              onChange={event => setSort(event.target.value)}
              aria-label="Sort results"
            >
              <option>Relevance</option>
              <option>Most Popular</option>
              <option>Newest</option>
              <option>Top Rated</option>
            </Select>
            <button
              onClick={() => setFiltersOpen(true)}
              className="relative flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm lg:hidden"
            >
              <Filter size={16} /> Filters
              {applied > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-[10px] text-white">
                  {applied}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>
      <main className="page-public grid gap-6 py-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_250px]">
        <aside className="hidden self-start rounded-3xl border border-line bg-surface p-5 lg:block">
          <SearchFilters
            checked={checked}
            onToggle={toggle}
            onApply={() => setApplied(checked.length)}
            onReset={reset}
          />
        </aside>
        <section className="min-w-0">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-1 sm:grid-cols-4">
            {resultTabs.map(item => (
              <button
                onClick={() => setTab(item)}
                className={`rounded-xl px-3 py-2.5 text-xs font-medium ${tab === item ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
                key={item}
              >
                {item}
                {item === 'All Results' ? ' (148)' : ''}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {tab === 'Authors'
              ? [...new Map(visibleResults.map(result => [result.author, result])).values()].map(result => (
                  <Card key={result.author} className="flex items-center justify-between gap-4 p-5">
                    <div><strong>{result.author}</strong><p className="mt-1 text-xs text-muted">Author of {result.title}</p></div>
                    <button onClick={() => setQuery(result.author)} className="rounded-xl border border-line px-3 py-2 text-xs font-semibold text-brand">View stories</button>
                  </Card>
                ))
              : visibleResults.map(result => <SearchResultItem result={result} key={result.id} />)}
          </div>
          {!visibleResults.length && (
            <Card className="py-16 text-center">
              <Search className="mx-auto text-muted" />
              <h2 className="mt-4 font-semibold">No results found</h2>
              <p className="mt-1 text-sm text-muted">Try another title, author, or genre.</p>
            </Card>
          )}
          <Card className="mt-5 flex flex-col items-center justify-between gap-4 p-4 sm:flex-row">
            <p className="text-xs text-muted">
              Showing <strong className="text-ink">{visibleResults.length ? 1 : 0}</strong> to{' '}
              <strong className="text-ink">{visibleResults.length}</strong> of{' '}
              <strong className="text-ink">148</strong> results
            </p>
            <div className="flex gap-1">
              {[1, 2, 3, 15].map(item => (
                <button
                  onClick={() => setPage(item)}
                  className={`grid size-9 place-items-center rounded-xl border text-xs ${page === item ? 'border-brand bg-brand text-white' : 'border-line'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>
        </section>
        <aside className="hidden space-y-5 xl:block">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Flame size={16} className="text-orange" />
              Trending Searches
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {trendingSearches.map(item => (
                <button
                  onClick={() => setQuery(item.slice(1))}
                  className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-brand hover:text-brand"
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-orange">
              Story of the month
            </span>
            <div className="mt-4 flex gap-3">
              <div className="grid aspect-[3/4] w-16 place-items-center rounded-lg bg-[#173b3f] text-2xl">
                🌲
              </div>
              <div>
                <h3 className="text-sm font-semibold">The Silent Forest</h3>
                <p className="text-xs text-muted">by Mira Lane</p>
                <p className="mt-2 text-xs font-semibold text-orange">★ 4.8</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              The wind moved gently through the ancient trees, carrying whispers of forgotten
              stories.
            </p>
            <button onClick={() => window.location.assign('/stories/demo')} className="mt-4 w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white">
              Read Feature Now
            </button>
          </Card>
          <Card className="bg-elevated p-5 text-center">
            <p className="italic">“Good stories make a kinder tomorrow.”</p>
            <p className="mt-3 text-xs text-muted">— NovelHub</p>
          </Card>
        </aside>
      </main>
      {filtersOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/45 lg:hidden"
          onClick={() => setFiltersOpen(false)}
        >
          <aside
            className="absolute inset-y-0 left-0 w-[min(88vw,340px)] overflow-y-auto bg-elevated p-5"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <strong>Search Filters</strong>
              <button aria-label="Close filters" onClick={() => setFiltersOpen(false)}>
                <X />
              </button>
            </div>
            <SearchFilters
              checked={checked}
              onToggle={toggle}
              onApply={() => {
                setApplied(checked.length)
                setFiltersOpen(false)
              }}
              onReset={reset}
            />
          </aside>
        </div>
      )}
      {!embedded && <footer className="mt-8 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] flex-wrap justify-between gap-3 px-5 py-7 text-xs text-muted md:px-8 lg:px-12">
          <strong className="text-ink">
            Novel<span className="text-brand">Hub</span>
          </strong>
          <span>Guidelines · Privacy Policy · Terms of Service · Help & Support</span>
          <span>© 2026 NovelHub</span>
        </div>
      </footer>}
    </div>
  )
}
