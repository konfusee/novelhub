import { useState } from 'react'
import { BookOpenCheck, Info, ShieldCheck, Star } from 'lucide-react'
import { PublicHeader } from '../../components/public/PublicHeader'
import { PodiumCard } from '../../components/public/PodiumCard'
import { RankingRow } from '../../components/public/RankingRow'
import { Badge, Button, Card } from '../../components/ui'
import { podium, rankingCategories, rankingPeriods, rankings } from '../../data/mock/rankings'

export function RankingsPage({ embedded = false }) {
  const [category, setCategory] = useState('Trending')
  const [period, setPeriod] = useState('This Week')
  const [following, setFollowing] = useState(false)
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <main className="page-public space-y-9 py-8">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
                The stories readers love
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                Editorial Rankings
              </h1>
              <p className="mt-2 text-sm text-muted">
                Top-performing original web novels and immersive audiobooks updated in real time.
              </p>
            </div>
            <Badge tone="green">● Live Data · Updated 12 mins ago</Badge>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-b border-line pb-4 xl:flex-row xl:items-center xl:justify-between">
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {rankingCategories.map(item => (
                <button
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium ${category === item ? 'bg-brand text-white' : 'border border-line bg-surface text-muted'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </nav>
            <nav className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
              {rankingPeriods.map(item => (
                <button
                  onClick={() => setPeriod(item)}
                  className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-[10px] ${period === item ? 'bg-orange text-white' : 'text-muted'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>
        </header>
        <section>
          <p className="mb-6 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-muted">
            <Star size={13} className="fill-orange text-orange" />
            Weekly podium leaders
          </p>
          <div className="grid gap-4 lg:grid-cols-3 lg:items-end">
            <div className="lg:order-1">
              <PodiumCard story={podium[1]} />
            </div>
            <div className="lg:order-2">
              <PodiumCard story={podium[0]} />
            </div>
            <div className="lg:order-3">
              <PodiumCard story={podium[2]} />
            </div>
          </div>
        </section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Ranks #04 — #15</h2>
              <span className="text-[10px] text-muted">Showing 12 contenders</span>
            </div>
            <div className="overflow-hidden rounded-3xl border border-line bg-surface">
              {rankings.map(item => (
                <RankingRow item={item} key={item.rank} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>Showing 15 of 250 indexed ranking entries</span>
              <Button onClick={() => window.alert('Loaded the next 15 ranking entries (mock).')} variant="secondary" className="min-h-9 py-2 text-xs">
                Next 15 stories →
              </Button>
            </div>
          </section>
          <aside className="space-y-5">
            <Card className="p-5">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck size={19} className="text-brand" />
                Fair Play Ranking Formula
              </h3>
              <p className="mt-3 text-xs leading-5 text-muted">
                NovelHub ranks books using a verified engagement algorithm combining reading time,
                chapter completion rates, and verified reader reviews.
              </p>
              <ul className="mt-4 space-y-2 border-t border-line pt-4 text-[10px] text-muted">
                <li>• 45% Verified Reading Time</li>
                <li>• 30% Bookmark & Library Retention</li>
                <li>• 25% Genuine Community Ratings</li>
              </ul>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-orange">
                  Spotlight creator
                </p>
                <Badge>Week 38</Badge>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full border border-orange text-sm font-semibold text-brand">
                  ML
                </span>
                <div>
                  <h3 className="font-semibold">Mira Lane</h3>
                  <p className="text-[10px] text-muted">Fantasy & Speculative Fiction</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-muted">
                Author of #1 hit The Silent Forest. Former mythologist exploring human resilience
                and untamed wilderness.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-line py-3 text-center text-xs">
                <span>
                  <strong className="block">48.2K</strong>
                  <small className="text-muted">Followers</small>
                </span>
                <span>
                  <strong className="block">6 Novellas</strong>
                  <small className="text-muted">Published</small>
                </span>
              </div>
              <Button onClick={() => setFollowing(!following)} className="mt-4 w-full">
                {following ? 'Following' : 'Follow Author'}
              </Button>
            </Card>
            <Card className="bg-elevated p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                Staff selection
              </p>
              <h3 className="mt-3 flex items-center gap-2 font-semibold">
                <BookOpenCheck size={18} />
                Looking for fresh voices?
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted">
                Discover under-the-radar novels handpicked every Friday by our community curators.
              </p>
              <button onClick={() => window.location.assign('/search')} className="mt-3 text-xs font-semibold text-brand">
                Explore Curated Collections →
              </button>
            </Card>
            <Card className="flex gap-3 p-4">
              <Info size={18} className="shrink-0 text-muted" />
              <p className="text-[10px] leading-4 text-muted">
                Rankings refresh hourly. Suspicious activity is automatically excluded.
              </p>
            </Card>
          </aside>
        </div>
      </main>
      {!embedded && <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] flex-wrap justify-between gap-4 px-5 py-7 text-xs text-muted md:px-8 lg:px-12">
          <strong className="text-ink">
            Novel<span className="text-brand">Hub</span>
          </strong>
          <span>Rankings FAQ · Author Guidelines · Editorial Terms · Privacy Policy</span>
          <span>© 2026 NovelHub</span>
        </div>
      </footer>}
    </div>
  )
}
