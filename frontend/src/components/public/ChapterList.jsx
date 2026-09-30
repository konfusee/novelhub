import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../ui'
import { useAuth } from '../../context/AuthContext'

export function ChapterList({ chapters, storyId = 'demo' }) {
  const { isAuthenticated } = useAuth()
  return (
    <div className="space-y-3">
      {chapters.map(chapter => (
        <article
          className={`flex items-center justify-between gap-3 rounded-2xl border border-line p-4 ${chapter.free ? 'bg-surface' : 'bg-elevated text-muted'}`}
          key={chapter.number}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-brand">
                Chapter {chapter.number}
              </span>
              <Badge tone={chapter.free ? 'green' : 'neutral'}>
                {chapter.free ? (
                  'Free Preview'
                ) : (
                  <>
                    <Lock size={10} />
                    Locked
                  </>
                )}
              </Badge>
            </div>
            <h3 className="mt-1 text-sm font-semibold">{chapter.title}</h3>
            <p className="mt-1 text-xs text-muted">{chapter.meta}</p>
          </div>
          <Link
            to={
              isAuthenticated
                ? `/read/${storyId}/chapter-${chapter.number}`
                : chapter.free
                  ? `/stories/${storyId}/preview/chapter-${chapter.number}`
                  : '/login'
            }
            state={
              !isAuthenticated && !chapter.free
                ? { from: `/read/${storyId}/chapter-${chapter.number}` }
                : undefined
            }
            className={`inline-flex min-h-9 shrink-0 items-center justify-center rounded-2xl border px-4 py-2 text-xs font-semibold ${
              chapter.free || isAuthenticated
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-ink'
            }`}
          >
            {isAuthenticated ? 'Read' : chapter.free ? 'Preview' : 'Sign in'}
          </Link>
        </article>
      ))}
    </div>
  )
}
