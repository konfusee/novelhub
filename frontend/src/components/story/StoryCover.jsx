import { useState } from 'react'
import { BookOpen } from '../icons'
import fantasyCover from '../../assets/covers/fantasy-cover-silent-forest.webp'
import romanceCover from '../../assets/covers/romance-cover-whispers-of-you.webp'
import scifiCover from '../../assets/covers/scifi-cover-neon-hearts.webp'

const covers = {
  'silent-forest': fantasyCover,
  'the-silent-forest': fantasyCover,
  'whispers-of-you': romanceCover,
  'neon-hearts': scifiCover,
}

const slugify = value =>
  value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export function StoryCover({ story, className = '', eager = false, badge }) {
  const [failed, setFailed] = useState(false)
  const key = story?.id || slugify(story?.title)
  const src = story?.cover || covers[key] || covers[slugify(story?.title)]
  const label = story?.title ? `Ảnh bìa của ${story.title}` : 'Ảnh bìa truyện NovelHub'

  return (
    <div
      className={`relative overflow-hidden bg-elevated ${className}`}
      style={!src || failed ? { backgroundColor: story?.color } : undefined}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={label}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <span
          className="grid h-full place-items-center text-white/80"
          role="img"
          aria-label={label}
        >
          <BookOpen aria-hidden="true" size="34%" strokeWidth={1.25} />
        </span>
      )}
      {badge}
    </div>
  )
}
