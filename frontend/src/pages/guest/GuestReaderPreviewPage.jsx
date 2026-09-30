import { useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Lock,
  Menu,
  MessageCircle,
  Moon,
  Sun,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { Card } from '../../components/ui'
import { previewParagraphs } from '../../data/mock/reader'

export function GuestReaderPreviewPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [fontSize, setFontSize] = useState(18)
  const [lineHeight, setLineHeight] = useState(2)
  const [contentWidth, setContentWidth] = useState(760)
  const [bookmarked, setBookmarked] = useState(false)
  return (
    <div className="min-h-screen bg-reader text-ink">
      <div className="fixed inset-x-0 top-0 z-40 h-1 bg-orange" />
      <header className="sticky top-1 z-30 border-b border-line bg-surface/95">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 md:px-8">
          <Link
            to="/stories/demo"
            className="flex items-center gap-2 text-xs font-medium text-muted"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">The Silent Forest</span>
          </Link>
          <button onClick={() => window.alert('Chapter selector opened (mock).')} className="mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-between rounded-xl border border-line bg-page px-3 py-2 text-xs">
            <span className="truncate">Chapter 1: The Whispering Trees</span>
            <span>⌄</span>
          </button>
          <div className="hidden items-center rounded-xl border border-line bg-page p-1 sm:flex">
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 1))}
              className="px-2 py-1 text-xs"
            >
              Aa−
            </button>
            <span className="rounded-lg bg-surface px-2 py-1 text-xs text-brand">{fontSize}</span>
            <button
              onClick={() => setFontSize(Math.min(22, fontSize + 1))}
              className="px-2 py-1 text-xs"
            >
              Aa+
            </button>
          </div>
          <label className="hidden items-center gap-2 rounded-xl border border-line bg-page px-3 py-2 xl:flex">
            <span className="text-[10px] font-semibold text-muted">Width</span>
            <input
              aria-label="Reading column width"
              type="range"
              min="600"
              max="960"
              step="20"
              value={contentWidth}
              onChange={event => setContentWidth(Number(event.target.value))}
              className="w-24 accent-brand"
            />
            <span className="w-8 text-right text-[10px] font-semibold text-brand">
              {contentWidth}
            </span>
          </label>
          <button
            onClick={() => setLineHeight(lineHeight === 2 ? 2.3 : 2)}
            className="hidden size-9 place-items-center rounded-xl border border-line lg:grid"
            aria-label="Line spacing"
          >
            <Menu size={16} />
          </button>
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="grid size-9 place-items-center rounded-xl border border-line"
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to="/login" className="hidden text-xs font-semibold sm:block">
            Sign In
          </Link>
          <Link
            to="/register"
            className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white"
          >
            Join Free
          </Link>
        </div>
      </header>
      <main
        className="mx-auto w-full px-5 pb-32 pt-12 transition-[max-width] sm:px-6"
        style={{ maxWidth: `${contentWidth}px` }}
      >
        <article>
          <header className="mb-9 border-b border-line pb-7 text-center">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              Free Preview
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-muted">
              The Silent Forest · Mira Lane
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Chapter 1: The Whispering Trees
            </h1>
            <p className="mt-3 text-xs text-muted">
              Published Sep 12, 2026 · 2,420 words · 7 min read
            </p>
          </header>
          <div className="space-y-6" style={{ fontSize, lineHeight }}>
            {previewParagraphs.map((paragraph, index) => (
              <p
                className={
                  index === 3
                    ? 'border-y border-line py-6 text-center font-medium italic text-brand'
                    : ''
                }
                key={paragraph}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </article>
        <Card className="mt-14 overflow-hidden p-0">
          <div className="border-b border-line bg-elevated p-6 text-center sm:p-8">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand/15 text-brand">
              <Lock size={20} />
            </span>
            <h2 className="mt-4 text-xl font-bold sm:text-2xl">The story continues in Chapter 2</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
              Join over 3,000,000 readers on NovelHub. Create a free account in 30 seconds to
              continue reading and unlock your personal library.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-brand bg-brand px-5 py-2.5 text-sm font-semibold text-white"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                state={{ from: '/read/demo/chapter-2' }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink"
              >
                Sign In
              </Link>
            </div>
          </div>
          <div className="grid gap-3 p-5 text-xs sm:grid-cols-3">
            <span>✓ Sync reading progress</span>
            <span>✓ Bookmark favorites</span>
            <span>✓ Join discussions</span>
          </div>
        </Card>
      </main>
      <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center justify-between gap-2 rounded-full border border-line bg-elevated px-3 py-2">
        <button
          disabled
          className="grid size-9 place-items-center rounded-full text-muted opacity-40"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={() => setBookmarked(!bookmarked)}
          className={`grid size-9 place-items-center rounded-full ${bookmarked ? 'bg-brand text-white' : ''}`}
          aria-label="Bookmark"
        >
          <Bookmark size={17} />
        </button>
        <div className="text-center">
          <span className="block text-xs font-medium">Chapter 1</span>
          <span className="text-[10px] text-brand">100% complete</span>
        </div>
        <button onClick={() => window.alert('Join NovelHub to comment on this chapter.')} className="grid size-9 place-items-center rounded-full" aria-label="Comments">
          <MessageCircle size={17} />
        </button>
        <Link
          to="/login"
          state={{ from: '/read/demo/chapter-2' }}
          className="flex items-center gap-1 rounded-full border border-line bg-page px-3 py-2 text-xs"
        >
          Chapter 2 <Lock size={12} />
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  )
}
