import { useState } from 'react'
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Headphones,
  Pause,
  Play,
  Sparkles,
  Star,
} from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { ContinueCard } from '../../components/reader/ContinueCard'
import { Badge, Button, Card, SectionHeader } from '../../components/ui'
import { readerHome } from '../../data/mock/reader'

function StoryTile({ story }) {
  const [saved, setSaved] = useState(false)
  return (
    <Card className="group p-3">
      <button
        onClick={() => setSaved(!saved)}
        className="relative grid aspect-[4/5] w-full place-items-center overflow-hidden rounded-2xl text-white"
        style={{ backgroundColor: story.color }}
      >
        <span className="text-4xl font-bold opacity-25">NH</span>
        <Badge className="absolute bottom-2 left-2 bg-white/90 text-[#172033]">{story.genre}</Badge>
        {saved && (
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-brand">
            <Check size={14} />
          </span>
        )}
      </button>
      <h3 className="mt-3 truncate text-sm font-semibold">{story.title}</h3>
      <p className="truncate text-[11px] text-muted">{story.author}</p>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted">
        <Star size={12} className="fill-orange text-orange" /> {story.rating}
      </p>
    </Card>
  )
}

function StreakCard() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">Reading streak</p>
          <h3 className="mt-1 flex items-center gap-2 text-2xl font-bold">
            <Flame className="fill-orange/20 text-orange" /> 18 days
          </h3>
        </div>
        <CalendarDays className="text-brand" />
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div className="text-center" key={`${day}-${index}`}>
            <span className="text-[10px] text-muted">{day}</span>
            <span
              className={`mx-auto mt-2 grid size-7 place-items-center rounded-full text-[10px] ${index < 5 ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}
            >
              {index < 5 ? <Check size={12} /> : index + 23}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl bg-orange/10 px-3 py-2 text-xs text-orange">
        Best streak: 24 days. Keep reading!
      </p>
    </Card>
  )
}

function NowPlaying() {
  const [playing, setPlaying] = useState(true)
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Now playing</h3>
        <Headphones size={18} className="text-brand" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-purple/20 text-purple">
          <Headphones />
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold">Midnight Whispers</h4>
          <p className="text-xs text-muted">Evan Cross</p>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-elevated">
        <div className="h-full w-[42%] rounded-full bg-orange" />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted">1:24:18</span>
        <button
          onClick={() => setPlaying(!playing)}
          className="grid size-10 place-items-center rounded-full bg-brand text-white"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="text-[10px] text-muted">3:09:47</span>
      </div>
    </Card>
  )
}

export function ReaderHomePage() {
  return (
    <ReaderLayout>
      <main className="page-reader py-6">
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="min-w-0 space-y-7">
            <section className="overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">
                    Your reading sanctuary
                  </p>
                  <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                    Welcome back, Elena
                  </h1>
                  <p className="mt-2 text-sm text-muted">Your next favorite chapter is waiting.</p>
                  <Button className="mt-5">
                    Open Reader <ArrowRight size={16} />
                  </Button>
                </div>
                <div className="w-full max-w-sm rounded-2xl bg-elevated p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted">Today&apos;s goal</p>
                      <strong className="mt-1 block text-lg">35 of 45 minutes</strong>
                    </div>
                    <span className="grid size-12 place-items-center rounded-full border-4 border-brand text-xs font-bold text-brand">
                      78%
                    </span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-line">
                    <div className="h-full w-[78%] rounded-full bg-brand" />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <Flame size={14} className="text-orange" /> 12 more minutes to keep your streak
                  </p>
                </div>
              </div>
            </section>

            <section>
              <SectionHeader
                title="Pick up where you left off"
                description="Your stories, ready when you are"
              />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ContinueCard item={readerHome.continueReading} />
                <ContinueCard item={readerHome.continueListening} audio />
              </div>
            </section>

            <section>
              <SectionHeader
                title="Recommended for you"
                description="Curated from your reading taste"
                action={
                  <button className="flex items-center gap-1 text-xs font-semibold text-brand">
                    See all <ChevronRight size={15} />
                  </button>
                }
              />
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {readerHome.recommendations.map(story => (
                  <StoryTile key={story.title} story={story} />
                ))}
              </div>
            </section>

            <section>
              <SectionHeader
                title="Because you read Fantasy"
                action={<button className="text-xs font-semibold text-brand">Refresh picks</button>}
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {readerHome.fantasyPicks.map(item => (
                  <Card key={item.title} className="flex items-center gap-3 p-3">
                    <div
                      className="grid size-14 shrink-0 place-items-center rounded-xl text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      <Sparkles size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-muted">{item.detail}</p>
                    </div>
                    <ChevronRight size={17} className="ml-auto shrink-0 text-muted" />
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <SectionHeader
                title="Recently updated"
                description="New chapters from stories you follow"
              />
              <Card className="mt-4 divide-y divide-line p-0">
                {readerHome.updates.map(item => (
                  <div className="flex items-center gap-3 p-4" key={item.title}>
                    <div
                      className="grid size-12 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      NH
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                      <p className="truncate text-xs text-muted">{item.chapter}</p>
                    </div>
                    <span className="hidden text-[11px] text-muted sm:block">{item.time}</span>
                    <Button className="min-h-9 px-3 py-1.5 text-xs">Read</Button>
                  </div>
                ))}
              </Card>
            </section>
          </div>

          <aside className="grid content-start gap-5 sm:grid-cols-2 2xl:grid-cols-1">
            <StreakCard />
            <NowPlaying />
            <Card>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Upcoming releases</h3>
                <BellRing size={18} className="text-rose" />
              </div>
              <div className="mt-4 space-y-4">
                {readerHome.releases.map(item => (
                  <div className="flex gap-3" key={item.title}>
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-elevated text-[9px] font-bold text-brand">
                      {item.date}
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold">{item.title}</h4>
                      <p className="text-[11px] text-muted">{item.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="bg-elevated sm:col-span-2 2xl:col-span-1">
              <Clock3 className="text-brand" />
              <p className="mt-4 text-lg font-medium italic leading-7">
                “A reader lives a thousand lives before they rest.”
              </p>
              <p className="mt-3 text-xs text-muted">Your daily inspiration</p>
            </Card>
          </aside>
        </div>
      </main>
    </ReaderLayout>
  )
}
