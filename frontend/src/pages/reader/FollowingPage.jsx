/* eslint-disable no-unused-vars -- index is reserved for stable suggested-author presentation ordering */
import { useMemo, useState } from 'react'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderHeart,
  Search,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { SavedStoryCard } from '../../components/reader/SavedStoryCard'
import { Button, Card, Input, Select } from '../../components/ui'
import { followingData } from '../../data/mock/reader'

const tabs = [
  ['saved', 'Saved Stories', 18],
  ['authors', 'Followed Authors', 12],
  ['favorites', 'Favorites', 9],
  ['collections', 'Collections', 4],
]

export function FollowingPage() {
  const [tab, setTab] = useState('saved')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('latest')
  const [page, setPage] = useState(1)
  const [following, setFollowing] = useState([])
  const stories = useMemo(
    () =>
      followingData.savedStories
        .filter(
          story =>
            (tab !== 'favorites' || story.favorite) &&
            `${story.title} ${story.author}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : 0)),
    [query, sort, tab],
  )
  const toggleFollow = name =>
    setFollowing(current =>
      current.includes(name) ? current.filter(item => item !== name) : [...current, name],
    )
  return (
    <ReaderLayout>
      <main className="page-reader py-7">
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="text-xs text-muted">
              Library <span className="mx-2">›</span>{' '}
              <span className="text-brand">My List &amp; Following</span>
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              My List &amp; Following
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Organize your favorite stories, followed authors, and personal reading collections.
            </p>
            <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
              {tabs.map(([value, label, count]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`shrink-0 border-b-2 px-4 py-3 text-xs font-semibold sm:text-sm ${tab === value ? 'border-brand text-brand' : 'border-transparent text-muted'}`}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <section className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">Featured Collections</h2>
                <button
                  onClick={() => setTab('collections')}
                  className="text-xs font-semibold text-brand"
                >
                  View all 4 collections →
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {followingData.collections.map(item => (
                  <Card key={item.title} className="flex min-h-48 overflow-hidden p-5">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[.18em] text-brand">
                        {item.label}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-5 text-muted">{item.description}</p>
                      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                        <BookOpen size={15} /> {item.count} stories <span>•</span> {item.updated}
                      </p>
                    </div>
                    <div
                      className="ml-3 grid h-24 w-20 shrink-0 place-items-center self-center rounded-2xl text-xl font-bold text-white -rotate-3"
                      style={{ backgroundColor: item.color }}
                    >
                      NH
                    </div>
                  </Card>
                ))}
              </div>
            </section>
            <section className="mt-7">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <Select
                    aria-label="Sort stories"
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                  >
                    <option value="latest">Latest Updated</option>
                    <option value="title">Title A–Z</option>
                  </Select>
                  <span className="hidden text-xs text-muted md:block">
                    Showing {stories.length} of 18 saved stories
                  </span>
                </div>
                <Input
                  icon={Search}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search saved stories..."
                  className="w-full sm:w-60"
                />
              </div>
              {tab === 'authors' ? (
                <Card className="mt-4 py-14 text-center">
                  <UsersRound className="mx-auto text-brand" />
                  <h2 className="mt-3 text-lg font-semibold">Your followed authors</h2>
                  <p className="mt-1 text-sm text-muted">
                    Explore author updates from the suggestions panel.
                  </p>
                </Card>
              ) : tab === 'collections' ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {followingData.collections.map(item => (
                    <Card key={item.title}>
                      <FolderHeart className="text-brand" />
                      <h3 className="mt-3 font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    </Card>
                  ))}
                </div>
              ) : stories.length ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {stories.map(story => (
                    <SavedStoryCard key={story.id} story={story} />
                  ))}
                </div>
              ) : (
                <Card className="mt-4 py-12 text-center">
                  <Sparkles className="mx-auto text-muted" />
                  <p className="mt-3 text-sm text-muted">No matching stories found.</p>
                </Card>
              )}
              <div className="mt-7 flex justify-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                  className="grid size-9 place-items-center rounded-full border border-line disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                {[1, 2, 3].map(number => (
                  <button
                    key={number}
                    onClick={() => setPage(number)}
                    className={`size-9 rounded-full border text-xs ${page === number ? 'border-brand bg-brand text-white' : 'border-line'}`}
                  >
                    {number}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(3, page + 1))}
                  className="grid size-9 place-items-center rounded-full border border-line"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Suggested Authors</h2>
                <button onClick={() => window.location.assign('/search')} className="text-xs text-brand">Explore</button>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted">
                Writers matching your preferred fantasy and romance reading history.
              </p>
              <div className="mt-5 divide-y divide-line">
                {followingData.authors.map((author, index) => (
                  <div key={author.name} className="flex items-center gap-3 py-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-xs font-bold text-brand">
                      {author.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{author.name}</h3>
                      <p className="truncate text-[11px] text-muted">{author.meta}</p>
                    </div>
                    <button
                      onClick={() => toggleFollow(author.name)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${following.includes(author.name) ? 'border-brand bg-brand text-white' : 'border-brand text-brand'}`}
                    >
                      {following.includes(author.name) ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Weekly Reading Goal</h2>
                <strong className="text-sm text-brand">4 / 5 days</strong>
              </div>
              <div className="mt-4 h-2 rounded-full bg-elevated">
                <div className="h-full w-4/5 rounded-full bg-brand" />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">
                You&apos;ve spent 4 hours reading saved stories this week. One more session to
                complete your badge!
              </p>
              <Button onClick={() => window.location.assign('/reader/history')} variant="secondary" className="mt-4 w-full">
                <Target size={16} />
                View progress
              </Button>
            </Card>
            <Card className="bg-elevated">
              <p className="text-lg italic leading-7">“Good stories make a kinder tomorrow.”</p>
              <p className="mt-4 text-xs text-muted">— NovelHub Editorial</p>
            </Card>
          </aside>
        </div>
      </main>
    </ReaderLayout>
  )
}
