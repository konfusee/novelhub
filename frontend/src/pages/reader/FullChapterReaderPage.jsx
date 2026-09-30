import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronDown,
  Flag,
  Heart,
  MessageCircle,
  Settings2,
  Share2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ReaderImmersiveLayout } from '../../layouts'
import { ReaderSettings } from '../../components/reader/ReaderSettings'
import { Button, Card, Drawer, IconButton } from '../../components/ui'
import { fullChapter } from '../../data/mock/reader'

export function FullChapterReaderPage() {
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(1.8)
  const [width, setWidth] = useState(740)
  const [tone, setTone] = useState('parchment')
  const [ambient, setAmbient] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [liked, setLiked] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const toneClass =
    tone === 'midnight'
      ? 'bg-[#081321] text-[#f7f9fc]'
      : tone === 'cream'
        ? 'bg-[#fffdf9] text-[#172033]'
        : 'bg-reader text-ink'
  const settingsProps = {
    fontSize,
    setFontSize,
    lineHeight,
    setLineHeight,
    width,
    setWidth,
    tone,
    setTone,
    ambient,
    setAmbient,
  }
  return (
    <ReaderImmersiveLayout>
      <div className={`min-h-screen transition-colors ${toneClass}`}>
        <div className="fixed inset-x-0 top-0 z-50 h-1 bg-line">
          <div className="h-full w-[68%] bg-brand" />
        </div>
        <header className="sticky top-1 z-40 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-2 px-3 sm:px-6">
            <Link
              to="/reader/library"
              className="flex items-center gap-1 text-xs text-muted hover:text-brand"
            >
              <ArrowLeft size={17} />
              <span className="hidden sm:inline">Back to Library</span>
            </Link>
            <span className="hidden h-5 w-px bg-line sm:block" />
            <strong className="hidden truncate text-sm text-brand md:block">
              {fullChapter.story}
            </strong>
            <span className="hidden text-muted md:block">/</span>
            <button onClick={() => window.alert('Chapter selector opened (mock).')} className="flex min-w-0 items-center gap-1 rounded-full bg-elevated px-3 py-1.5 text-xs">
              <span className="truncate">
                Chapter {fullChapter.number}: {fullChapter.title}
              </span>
              <ChevronDown size={14} />
            </button>
            <div className="ml-auto hidden text-right sm:block">
              <p className="text-[9px] text-muted">
                Chapter {fullChapter.number} of {fullChapter.total}
              </p>
              <p className="text-[10px] font-semibold text-brand">68% overall</p>
            </div>
            <IconButton
              label="Reader settings"
              className="sm:hidden"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <Settings2 size={17} />
            </IconButton>
            <IconButton
              label="Bookmark"
              className="size-9 rounded-full"
              onClick={() => setBookmarked(!bookmarked)}
            >
              <Bookmark size={16} className={bookmarked ? 'fill-brand text-brand' : ''} />
            </IconButton>
            <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-bold text-white">
              H
            </span>
          </div>
        </header>
        <div className="sticky top-[61px] z-30 mx-auto hidden w-fit py-2 sm:block">
          <ReaderSettings {...settingsProps} />
        </div>
        {settingsOpen && (
          <div className="border-b border-line bg-elevated p-3 sm:hidden">
            <ReaderSettings {...settingsProps} />
          </div>
        )}
        <main
          className="mx-auto px-5 pb-16 pt-8 transition-[max-width] sm:px-6"
          style={{ maxWidth: `${width}px` }}
        >
          <header className="border-b border-line pb-7 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted">
              {fullChapter.arc} · Published {fullChapter.date}
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Chapter {fullChapter.number}: {fullChapter.title}
            </h1>
            <p className="mt-3 text-xs text-muted">
              By <span className="font-semibold text-brand">{fullChapter.author}</span> ·{' '}
              {fullChapter.readTime}
            </p>
          </header>
          <figure className="mt-10 overflow-hidden rounded-3xl border border-line bg-elevated">
            <div className="relative grid aspect-[16/9] place-items-center overflow-hidden bg-[#31584c] text-white">
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(120deg, transparent 0 36px, #9ad4bd 38px 40px)',
                }}
              />
              <BookOpen size={64} className="relative opacity-60" />
            </div>
            <figcaption className="p-3 text-center text-[10px] text-muted">
              The sun filtering through the silvered elder canopy at dawn.
            </figcaption>
          </figure>
          <article
            className="mt-10 space-y-7 transition-all"
            style={{ fontSize: `${fontSize}px`, lineHeight }}
          >
            {fullChapter.paragraphs.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 24)}
                className={
                  index === 0
                    ? 'first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:font-semibold first-letter:leading-[.8] first-letter:text-brand'
                    : ''
                }
              >
                {paragraph}
              </p>
            ))}
          </article>
          <div className="my-12 text-center">
            <span className="text-brand">— ❧ —</span>
            <p className="mt-3 text-[10px] text-muted">
              End of Chapter 14 · To be continued in Chapter 15
            </p>
          </div>
          <Card className="p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold">Enjoyed this chapter?</h2>
                <p className="mt-1 text-xs text-muted">
                  Support Mira Lane with reader power stones or join the discussion.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setLiked(!liked)}
                >
                  <Heart size={15} className={liked ? 'fill-rose text-rose' : ''} />
                  Like Story (1.4K)
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setCommentsOpen(true)}
                >
                  <MessageCircle size={15} />
                  Comment (24)
                </Button>
                <IconButton label="Share" className="size-9">
                  <Share2 size={15} />
                </IconButton>
                <IconButton label="Report" className="size-9">
                  <Flag size={15} />
                </IconButton>
              </div>
            </div>
          </Card>
          <nav className="mt-8 flex flex-col items-stretch justify-between gap-4 border-t border-line pt-7 sm:flex-row sm:items-center">
            <Button onClick={() => window.alert('Previous chapter opened (mock).')} variant="secondary">
              <ArrowLeft size={16} />
              Previous Chapter
            </Button>
            <div className="text-center">
              <p className="text-[10px] text-muted">Current Progress</p>
              <div className="mx-auto mt-2 h-1.5 w-28 rounded-full bg-line">
                <div className="h-full w-full rounded-full bg-brand" />
              </div>
              <p className="mt-1 text-[10px] text-brand">100% of chapter</p>
            </div>
            <Button onClick={() => window.alert('Next chapter opened (mock).')}>
              Next: The Amber Gate <ArrowRight size={16} />
            </Button>
          </nav>
        </main>
        <Drawer
          open={commentsOpen}
          title="Chapter discussion"
          onClose={() => setCommentsOpen(false)}
        >
          <div className="space-y-4">
            <Card className="p-4">
              <strong className="text-sm">Lina M.</strong>
              <p className="mt-2 text-sm leading-6 text-muted">
                The atmosphere in this chapter is beautiful. That final resonance gave me chills.
              </p>
            </Card>
            <Card className="p-4">
              <strong className="text-sm">Kai Reader</strong>
              <p className="mt-2 text-sm leading-6 text-muted">
                I think the Elder Pact is connected to the first chapter.
              </p>
            </Card>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none focus:border-brand"
              placeholder="Join the discussion..."
            />
            <Button onClick={() => window.alert('Comment posted locally (mock).')} className="w-full">Post comment</Button>
          </div>
        </Drawer>
        {commentsOpen && (
          <button
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setCommentsOpen(false)}
            aria-label="Close comments"
          >
            <X className="sr-only" />
          </button>
        )}
      </div>
    </ReaderImmersiveLayout>
  )
}
