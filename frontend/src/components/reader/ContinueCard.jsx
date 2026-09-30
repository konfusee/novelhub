import { useState } from 'react'
import { BookOpen, Bookmark, Pause, Play } from 'lucide-react'
import { Button, Card } from '../ui'
import { useLocale } from '../../context/LocaleContext'

export function ContinueCard({ item, audio = false }) {
  const { t } = useLocale()
  const [saved, setSaved] = useState(false)
  const [playing, setPlaying] = useState(false)
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex gap-4">
        <div
          className="grid h-32 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl text-white"
          style={{ backgroundColor: item.color }}
        >
          <span className="text-3xl">{audio ? '♪' : 'N'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
                {t(audio ? 'readerHome.continueListening' : 'readerHome.continueReading')}
              </p>
              <h3 className="mt-1 truncate font-semibold">{item.title}</h3>
              <p className="text-xs text-muted">{item.author}</p>
            </div>
            <button aria-label="Save story" onClick={() => setSaved(!saved)} className="text-muted">
              <Bookmark size={19} className={saved ? 'fill-brand text-brand' : ''} />
            </button>
          </div>
          <p className="mt-3 truncate text-xs text-muted">{item.chapter}</p>
          <div className="mt-2 h-1.5 rounded-full bg-elevated">
            <div className="h-full rounded-full bg-brand" style={{ width: `${item.progress}%` }} />
          </div>
          <div className="mt-1 text-right text-[10px] font-semibold text-muted">
            {item.progress}%
          </div>
        </div>
      </div>
      <Button
        onClick={() => audio && setPlaying(!playing)}
        className="mt-4 w-full min-h-10 py-2 text-xs"
      >
        {audio ? playing ? <Pause size={15} /> : <Play size={15} /> : <BookOpen size={15} />}{' '}
        {t(audio && playing ? 'readerHome.pause' : audio ? 'readerHome.continueListening' : 'readerHome.continueReading')}
      </Button>
    </Card>
  )
}
