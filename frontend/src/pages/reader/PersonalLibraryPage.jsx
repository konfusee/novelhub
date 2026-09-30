import { useMemo, useState } from 'react'
import { Check, Cloud, Filter, Grid2X2, List, Search, Trophy } from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { LibraryCard } from '../../components/reader/LibraryCard'
import { Badge, Button, Card, Input, Select } from '../../components/ui'
import { libraryItems as initialItems } from '../../data/mock/reader'

const tabs = [
  ['all', 'All'],
  ['reading', 'Currently Reading'],
  ['listening', 'Listening'],
  ['completed', 'Completed'],
  ['offline', 'Saved Offline'],
]

export function PersonalLibraryPage() {
  const [items, setItems] = useState(initialItems)
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState('grid')
  const filtered = useMemo(
    () =>
      items
        .filter(item => {
          const tabMatch = tab === 'all' || (tab === 'offline' ? item.offline : item.status === tab)
          const typeMatch = type === 'all' || item.type === type
          return (
            tabMatch &&
            typeMatch &&
            `${item.title} ${item.author}`.toLowerCase().includes(query.toLowerCase())
          )
        })
        .sort((a, b) =>
          sort === 'title'
            ? a.title.localeCompare(b.title)
            : sort === 'progress'
              ? b.progress - a.progress
              : 0,
        ),
    [items, query, sort, tab, type],
  )
  const countFor = key =>
    key === 'all'
      ? items.length
      : key === 'offline'
        ? items.filter(i => i.offline).length
        : items.filter(i => i.status === key).length
  return (
    <ReaderLayout>
      <main className="page-reader py-6">
        <Card className="flex flex-col justify-between gap-5 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">My Library</h1>
              <Badge tone="green">{items.length} Total Titles</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">
              {items.filter(i => i.type === 'story').length} Stories <span className="mx-2">•</span>{' '}
              {items.filter(i => i.type === 'audio').length} Audiobooks{' '}
              <span className="mx-2">•</span>{' '}
              <span className="font-medium text-orange">6 in progress this week</span>
            </p>
          </div>
          <div className="w-full rounded-2xl border border-line bg-elevated p-4 lg:w-80">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-medium">
                <Cloud size={16} className="text-brand" />
                Offline Storage
              </span>
              <strong>2.4 GB / 10 GB</strong>
            </div>
            <div className="mt-2 h-2 rounded-full bg-line">
              <div className="h-full w-[24%] rounded-full bg-brand" />
            </div>
            <p className="mt-2 text-[11px] text-muted">
              4 titles ready for uninterrupted offline reading
            </p>
          </div>
        </Card>

        <section className="mt-6 border-b border-line pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${tab === value ? 'bg-brand text-white' : 'text-muted hover:bg-elevated'}`}
                >
                  {label} ({countFor(value)})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                icon={Search}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter your library..."
                className="w-full sm:w-60"
              />
              <Select value={type} onChange={e => setType(e.target.value)} aria-label="Filter type">
                <option value="all">All formats</option>
                <option value="story">Text stories</option>
                <option value="audio">Audiobooks</option>
              </Select>
              <Select
                value={sort}
                onChange={e => setSort(e.target.value)}
                aria-label="Sort library"
              >
                <option value="recent">Recently opened</option>
                <option value="title">Title A–Z</option>
                <option value="progress">Most progress</option>
              </Select>
              <div className="flex rounded-2xl border border-line bg-surface p-1">
                <button
                  aria-label="Grid view"
                  onClick={() => setView('grid')}
                  className={`rounded-xl p-2 ${view === 'grid' ? 'bg-brand text-white' : 'text-muted'}`}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  aria-label="List view"
                  onClick={() => setView('list')}
                  className={`rounded-xl p-2 ${view === 'list' ? 'bg-brand text-white' : 'text-muted'}`}
                >
                  <List size={17} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {filtered.length ? (
          <section
            className={`mt-6 ${view === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5' : 'space-y-3'}`}
          >
            {filtered.map(item => (
              <LibraryCard
                key={item.id}
                item={item}
                view={view}
                onRemove={id => setItems(current => current.filter(entry => entry.id !== id))}
              />
            ))}
          </section>
        ) : (
          <Card className="mt-6 py-16 text-center">
            <Filter className="mx-auto text-muted" />
            <h2 className="mt-3 font-semibold">No titles found</h2>
            <p className="mt-1 text-sm text-muted">Try another search or filter.</p>
            <Button
              className="mt-4"
              onClick={() => {
                setTab('all')
                setType('all')
                setQuery('')
              }}
            >
              Clear filters
            </Button>
          </Card>
        )}

        <Card className="mt-7 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-brand/15 text-brand">
              <Trophy />
            </span>
            <div>
              <h2 className="font-semibold sm:text-lg">Weekly Reading Goal</h2>
              <p className="text-sm text-muted">
                You&apos;ve read 4.5 hours of your 5 hour weekly target. Keep going!
              </p>
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="secondary" className="flex-1">
              View Analytics
            </Button>
            <Button className="flex-1 whitespace-nowrap">
              <Check size={16} />
              Continue Reading
            </Button>
          </div>
        </Card>
      </main>
    </ReaderLayout>
  )
}
