import { useMemo, useState } from 'react'
import { ArrowRight, Search } from 'lucide-react'
import { PublicHeader } from '../../components/public/PublicHeader'
import { CategoryCard } from '../../components/public/CategoryCard'
import { StoryShelf } from '../../components/public/StoryShelf'
import { Badge, Button, Card, Input } from '../../components/ui'
import { categories, popularTags } from '../../data/mock/categories'
import { extendedStories, hiddenGems } from '../../data/mock/stories'

const filters = ['All', 'Popular', 'New', 'Trending', 'Completed']

export function CategoriesPage({ embedded = false }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [selectedGenre, setSelectedGenre] = useState('')
  const visibleCategories = useMemo(
    () =>
      categories.filter(category =>
        `${category.name} ${category.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  )
  const fantasy = extendedStories.filter(story => story.genre === 'Fantasy').slice(0, 4)
  const romance = extendedStories
    .filter(story => story.genre === 'Romance' || story.genre === 'Drama')
    .slice(0, 4)
  const scifi = extendedStories.filter(story => story.genre === 'Sci-Fi').slice(0, 4)
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <main className="page-public space-y-10 py-8">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
            Discover your next world
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Browse Categories</h1>
          <p className="mt-2 text-sm text-muted">
            Explore worlds of imagination curated by genre, mood, and reader favorites.
          </p>
        </header>
        <section className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            icon={Search}
            placeholder="Filter by keyword or subgenre..."
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="md:max-w-sm"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map(item => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium ${filter === item ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted hover:border-brand'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold">All Genres</h2>
              {selectedGenre && (
                <p className="mt-1 text-xs text-brand">Selected: {selectedGenre}</p>
              )}
            </div>
            <span className="text-xs text-muted">{visibleCategories.length} core categories</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCategories.map(category => (
              <CategoryCard key={category.name} category={category} onSelect={setSelectedGenre} />
            ))}
          </div>
          {!visibleCategories.length && (
            <Card className="text-center text-sm text-muted">No genres match “{query}”.</Card>
          )}
        </section>
        <Card className="p-5 md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-orange">
                Curated collection
              </p>
              <h2 className="mt-1 text-xl font-bold">Popular This Week</h2>
            </div>
            <button onClick={() => window.location.assign('/search')} className="flex items-center gap-1 text-xs font-semibold text-brand">
              Explore all <ArrowRight size={14} />
            </button>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {popularTags.map((tag, index) => (
              <button
                onClick={() => setQuery(tag.replace('#', ''))}
                className="rounded-xl border border-line bg-page px-3 py-3 text-center hover:border-brand"
                key={tag}
              >
                <strong className="block text-xs">{tag}</strong>
                <span className="mt-1 block text-[9px] text-muted">
                  {420 + index * 175} stories
                </span>
              </button>
            ))}
          </div>
        </Card>
        <StoryShelf title="Fantasy — Epic Worlds & Magic" stories={fantasy} />
        <StoryShelf title="Romance — Heartfelt Journeys" stories={romance} />
        <StoryShelf title="Sci-Fi & Cyberpunk — Future Horizons" stories={scifi} />
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
            Editorial picks
          </p>
          <h2 className="mt-1 text-2xl font-bold">Hidden Gems</h2>
          <p className="mt-1 text-xs text-muted">
            Carefully reviewed stories with extraordinary prose waiting to be discovered.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {hiddenGems.map(item => (
              <Card key={item.title} className="flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <Badge
                    tone={
                      item.genre === 'Adventure'
                        ? 'orange'
                        : item.genre === 'Mystery'
                          ? 'purple'
                          : 'green'
                    }
                  >
                    {item.genre}
                  </Badge>
                  <span className="text-[10px] text-muted">{item.chapters} chapters</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted">{item.description}</p>
                <div className="mt-auto flex items-center justify-between pt-5 text-[10px]">
                  <span>By {item.author}</span>
                  <button onClick={() => window.location.assign('/stories/demo')} className="font-semibold text-brand">Read Preview →</button>
                </div>
              </Card>
            ))}
          </div>
        </section>
        <section className="flex flex-col items-start justify-between gap-5 rounded-3xl border border-line bg-surface p-7 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-2xl font-bold">Join NovelHub Today</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Unlock personalized recommendations, sync reading progress, and build your digital
              library across every device.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Button onClick={() => window.location.assign('/register')}>Create an Account</Button>
            <Button onClick={() => window.location.assign('/')} variant="secondary">Learn More</Button>
          </div>
        </section>
      </main>
      {!embedded && <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] flex-wrap justify-between gap-4 px-5 py-8 text-xs text-muted md:px-8 lg:px-12">
          <strong className="text-ink">
            Novel<span className="text-brand">Hub</span>
          </strong>
          <span>Explore · Popular Categories · Audiobook Topics · Author Leaderboard</span>
          <span>© 2026 NovelHub</span>
        </div>
      </footer>}
    </div>
  )
}
