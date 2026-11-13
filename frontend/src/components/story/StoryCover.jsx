import { useState } from 'react'
import { API_BASE } from '../../api/client'
import {
  Archive,
  BookOpen,
  Coffee,
  Compass,
  Ghost,
  Heart,
  NovelHubMark,
  Orbit,
  Search,
  Settings,
  Sparkles,
  Theater,
} from '../icons'
/* Genre motif for generated covers: Folio glyph plus a palette tint (VI and EN genre labels). */
const genreMotifs = [
  [/k[ỳy] [ảa]o|fantasy/i, Sparkles, 'var(--accent-purple)'],
  [/l[ãa]ng m[ạa]n|romance/i, Heart, 'var(--accent-rose)'],
  [/b[íi] [ẩa]n|mystery/i, Search, 'oklch(42% 0.06 250)'],
  [/vi[ễe]n t[ưu][ởo]ng|sci-?fi/i, Orbit, 'oklch(40% 0.09 285)'],
  [/phi[êe]u l[ưu]u|adventure/i, Compass, 'var(--accent-orange)'],
  [/[đd][ờo]i th[ưu][ờo]ng|slice/i, Coffee, 'oklch(55% 0.08 60)'],
  [/l[ịi]ch s[ửu]|histor/i, Archive, 'oklch(45% 0.06 150)'],
  [/ch[íi]nh k[ịi]ch|drama/i, Theater, 'oklch(52% 0.1 10)'],
  [/kinh d[ịi]|horror/i, Ghost, 'oklch(32% 0.03 258)'],
  [/steampunk/i, Settings, 'oklch(48% 0.07 55)'],
]
const motifFor = genre =>
  genreMotifs.find(([pattern]) => pattern.test(genre || '')) || [null, BookOpen, 'var(--primary)']

/*
 * Generated fallback: the story's own color (media data), else its genre tint, shaped into a
 * lit-from-above gradient with a spine shade, a faint ring pattern and the genre glyph.
 */
const fallbackBackground = tint => ({
  backgroundImage: [
    'linear-gradient(90deg, oklch(15% 0.03 258 / 0.28), oklch(15% 0.03 258 / 0) 9%)',
    'repeating-radial-gradient(circle at 78% 22%, oklch(100% 0 0 / 0.07) 0 1px, transparent 1px 9%)',
    'radial-gradient(120% 70% at 85% 105%, oklch(100% 0 0 / 0.16), transparent 60%)',
    `linear-gradient(162deg, color-mix(in oklab, ${tint} 72%, white) 0%, ${tint} 48%, color-mix(in oklab, ${tint} 62%, oklch(15% 0.03 258)) 100%)`,
  ].join(', '),
})

export function StoryCover({ story, className = '', eager = false, badge }) {
  const [failedSrc, setFailedSrc] = useState(null)
  const backendUrl =
    story?.coverUrl && /^\/(?:author|catalog)\//u.test(story.coverUrl)
      ? `${API_BASE}${story.coverUrl}`
      : story?.coverUrl
  const privateMedia = Boolean(story?.coverUrl && /^\/author\//u.test(story.coverUrl))
  const src = backendUrl || story?.coverUrl || story?.cover
  const label = story?.title ? `Ảnh bìa của ${story.title}` : 'Ảnh bìa truyện NovelHub'
  const title = story?.title?.trim() || 'NovelHub'
  const [, GenreIcon, genreTint] = motifFor(story?.genre)

  return (
    <div className={`relative overflow-hidden bg-elevated ${className}`}>
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt={label}
          crossOrigin={privateMedia ? 'use-credentials' : undefined}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="h-full w-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.03]"
        />
      ) : (
        <span
          role="img"
          aria-label={label}
          className="@container absolute inset-0 flex flex-col text-white transition-transform duration-700 ease-spring group-hover:scale-[1.03]"
          style={fallbackBackground(story?.color || genreTint)}
        >
          <span
            aria-hidden="true"
            className="hidden flex-1 flex-col p-[11cqw] pl-[14cqw] @min-[5.5rem]:flex"
          >
            <span className="-mt-[0.12em] line-clamp-4 pt-[0.12em] text-[clamp(0.7rem,13cqw,1.6rem)] font-bold leading-[1.15] tracking-[-0.025em] [text-shadow:0_1px_12px_oklch(15%_0.03_258/0.25)] [text-wrap:balance]">
              {title}
            </span>
            <span className="mt-[6cqw] block h-px w-[18cqw] bg-white/55" />
            {story?.author && (
              <span className="mt-[5cqw] truncate text-[clamp(0.55rem,6.5cqw,0.8rem)] font-medium text-white/80">
                {story.author}
              </span>
            )}
            <span className="mt-auto flex items-end justify-between gap-[4cqw]">
              <GenreIcon className="size-[13cqw] text-white/70" />
              <NovelHubMark className="size-[14cqw] text-white/55" />
            </span>
          </span>
          <span aria-hidden="true" className="grid flex-1 place-items-center @min-[5.5rem]:hidden">
            <span className="grid size-[62cqw] place-items-center rounded-full bg-white/14 ring-1 ring-inset ring-white/30 [box-shadow:inset_0_1px_0_oklch(100%_0_0/0.25)]">
              <GenreIcon className="size-[34cqw] text-white/90" />
            </span>
          </span>
        </span>
      )}
      {badge}
    </div>
  )
}
