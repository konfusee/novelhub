import { useState } from 'react'
import {
  BookMarked,
  CheckCircle2,
  Download,
  Headphones,
  Heart,
  ListMusic,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  RotateCw,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { Badge, Button, Card, IconButton } from '../../components/ui'
import { audioPlayerData as audio } from '../../data/mock/reader'

export function FullAudioPlayerPage() {
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(34)
  const [speed, setSpeed] = useState(1.25)
  const [timer, setTimer] = useState('30m')
  const [volume, setVolume] = useState(78)
  const [chapter, setChapter] = useState(6)
  const [saved, setSaved] = useState(false)
  return (
    <ReaderLayout>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-orange" />
      <main className="page-reader py-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-5 text-xs text-muted">
              <span>Audio Lounge</span>
              <span>/</span>
              <span>{audio.genre}</span>
              <span>/</span>
              <strong className="text-ink">{audio.title}</strong>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setSaved(!saved)}
                >
                  <BookMarked size={15} />
                  {saved ? 'In Library' : 'Add to Library'}
                </Button>
                <IconButton label="Download" className="size-9">
                  <Download size={15} />
                </IconButton>
                <IconButton label="Share" className="size-9">
                  <Share2 size={15} />
                </IconButton>
              </div>
            </div>
            <section className="mt-7 grid gap-6 md:grid-cols-[280px_1fr]">
              <div
                className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-3xl text-white shadow-lg"
                style={{ backgroundColor: audio.color }}
              >
                <Headphones size={74} className="opacity-50" />
                <Badge className="absolute bottom-4 left-4 bg-black/50 text-white">
                  Studio Master
                </Badge>
                <Badge className="absolute bottom-4 right-4 bg-orange text-white">Lossless</Badge>
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex gap-2">
                  <Badge tone="orange">{audio.genre}</Badge>
                  <Badge>Part 1 of 3</Badge>
                </div>
                <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
                  {audio.title}
                </h1>
                <p className="mt-3 text-xl font-semibold text-brand">{audio.author}</p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Narrated with emotional resonance by{' '}
                  <strong className="text-ink">Liam Vance</strong> &amp;{' '}
                  <strong className="text-ink">Maya Chen</strong>
                </p>
                <Card className="mt-5 bg-elevated p-4">
                  <p className="text-xs text-muted">Currently Playing</p>
                  <div className="mt-1 flex items-end justify-between">
                    <strong>
                      Chapter {chapter}: {audio.queue[chapter - 1][0]}
                    </strong>
                    <span className="text-sm font-semibold text-orange">
                      {audio.queue[chapter - 1][1]}
                    </span>
                  </div>
                </Card>
              </div>
            </section>
            <section className="mt-8">
              <div className="flex justify-between text-xs">
                <strong>14:32</strong>
                <span className="text-muted">● Streaming 320kbps</span>
                <span>−28:15</span>
              </div>
              <input
                aria-label="Audio progress"
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
                className="mt-3 w-full accent-orange"
              />
              <div className="mt-7 flex items-center justify-center gap-3 sm:gap-6">
                <IconButton label="Shuffle" className="border-0 bg-transparent">
                  <Shuffle size={19} />
                </IconButton>
                <IconButton
                  label="Previous chapter"
                  className="border-0 bg-transparent"
                  onClick={() => setChapter(Math.max(1, chapter - 1))}
                >
                  <SkipBack size={21} />
                </IconButton>
                <button
                  aria-label="Back 15 seconds"
                  onClick={() => setProgress(Math.max(0, progress - 5))}
                  className="grid size-11 place-items-center rounded-full border border-line"
                >
                  <RotateCcw size={20} />
                </button>
                <button
                  aria-label={playing ? 'Pause' : 'Play'}
                  onClick={() => setPlaying(!playing)}
                  className="grid size-16 place-items-center rounded-full bg-orange text-[#172033] shadow-lg"
                >
                  {playing ? <Pause size={28} /> : <Play size={28} />}
                </button>
                <button
                  aria-label="Forward 15 seconds"
                  onClick={() => setProgress(Math.min(100, progress + 5))}
                  className="grid size-11 place-items-center rounded-full border border-line"
                >
                  <RotateCw size={20} />
                </button>
                <IconButton
                  label="Next chapter"
                  className="border-0 bg-transparent"
                  onClick={() => setChapter(Math.min(audio.queue.length, chapter + 1))}
                >
                  <SkipForward size={21} />
                </IconButton>
                <IconButton label="Repeat" className="border-0 bg-transparent">
                  <Repeat2 size={19} />
                </IconButton>
              </div>
              <div className="mt-8 space-y-3 border-t border-line pt-6">
                <ControlPills
                  label="Speed"
                  values={[1, 1.25, 1.5, 2]}
                  value={speed}
                  onChange={setSpeed}
                  suffix="x"
                />
                <ControlPills
                  label="Timer"
                  values={['Off', '15m', '30m', '45m', 'End']}
                  value={timer}
                  onChange={setTimer}
                />
                <div className="flex items-center gap-3 rounded-2xl bg-elevated px-4 py-2">
                  <Volume2 size={17} />
                  <input
                    aria-label="Volume"
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={e => setVolume(Number(e.target.value))}
                    className="w-full accent-brand"
                  />
                  <span className="text-xs font-semibold">{volume}%</span>
                </div>
              </div>
            </section>
          </Card>
          <aside className="space-y-5">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Audio Queue</h2>
                  <p className="text-xs text-muted">18 tracks · 8 hrs 42 mins total</p>
                </div>
                <ListMusic className="text-brand" />
              </div>
              <div className="mt-5 max-h-[540px] space-y-1 overflow-y-auto pr-1">
                {audio.queue.map(([title, time], index) => {
                  const number = index + 1,
                    active = number === chapter,
                    done = number < chapter
                  return (
                    <button
                      key={title}
                      onClick={() => setChapter(number)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-l-4 p-3 text-left ${active ? 'border-orange bg-purple/10' : 'border-transparent hover:bg-elevated'}`}
                    >
                      {done ? (
                        <CheckCircle2 size={18} className="shrink-0 text-brand" />
                      ) : active ? (
                        <Volume2 size={18} className="shrink-0 text-orange" />
                      ) : (
                        <span className="grid size-[18px] place-items-center rounded-full border border-line text-[9px]">
                          {number}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <strong className={`block truncate text-sm ${active ? 'text-orange' : ''}`}>
                          {number}. {title}
                        </strong>
                        <span className="text-[11px] text-muted">
                          {done ? 'Completed' : active ? 'Now Playing' : 'Queued'}
                        </span>
                      </div>
                      <span className="text-xs text-muted">{time}</span>
                    </button>
                  )
                })}
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Narration &amp; Production</h2>
              <div className="mt-4 space-y-4">
                {audio.cast.map(([name, role]) => (
                  <div className="flex items-center gap-3" key={name}>
                    <span className="grid size-11 place-items-center rounded-full bg-purple/15 font-semibold text-purple">
                      {name
                        .split(' ')
                        .map(n => n[0])
                        .join('')}
                    </span>
                    <div>
                      <strong className="text-sm">{name}</strong>
                      <p className="text-xs text-muted">{role}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 rounded-2xl bg-elevated p-4 text-sm italic leading-6">
                “Recorded at SoundForge Studios with custom analog ambient score accompaniment.”
              </p>
            </Card>
            <Card className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">Love this audiobook?</p>
                <strong className="text-sm">Save it for later</strong>
              </div>
              <button aria-label="Favorite">
                <Heart className="text-rose" />
              </button>
            </Card>
          </aside>
        </div>
      </main>
    </ReaderLayout>
  )
}

function ControlPills({ label, values, value, onChange, suffix = '' }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-2xl bg-elevated px-3 py-2">
      <span className="mr-2 text-xs text-muted">{label}:</span>
      {values.map(item => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`rounded-full px-3 py-1 text-xs ${value === item ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
        >
          {item}
          {typeof item === 'number' ? suffix : ''}
        </button>
      ))}
    </div>
  )
}
