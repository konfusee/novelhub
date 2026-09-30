import { useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Download,
  Headphones,
  MoreVertical,
  Play,
  Trash2,
} from 'lucide-react'
import { Badge, Button, Card } from '../ui'

export function LibraryCard({ item, view = 'grid', onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const audio = item.type === 'audio'
  const menu = (
    <div className="absolute right-3 top-12 z-20 w-48 rounded-2xl border border-line bg-surface p-1.5 text-xs shadow-xl">
      <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-elevated">
        <Download size={15} />
        Download offline
      </button>
      <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-elevated">
        <CheckCircle2 size={15} />
        Mark as finished
      </button>
      <button
        onClick={() => onRemove(item.id)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-rose hover:bg-rose/10"
      >
        <Trash2 size={15} />
        Remove from library
      </button>
    </div>
  )
  if (view === 'list')
    return (
      <Card className="relative flex items-center gap-4 p-3">
        <div
          className="grid h-24 w-20 shrink-0 place-items-center rounded-xl text-2xl font-bold text-white"
          style={{ backgroundColor: item.color }}
        >
          NH
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{item.title}</h3>
            <Badge tone={audio ? 'orange' : 'green'}>{audio ? 'Audiobook' : 'Text story'}</Badge>
          </div>
          <p className="text-xs text-muted">{item.author}</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full bg-elevated">
              <div
                className={`h-full rounded-full ${audio ? 'bg-orange' : 'bg-brand'}`}
                style={{ width: `${item.progress}%` }}
              />
            </div>
            <span className="text-xs font-semibold">{item.progress}%</span>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {item.detail} · {item.activity}
          </p>
        </div>
        <Button className="hidden min-h-9 px-3 py-2 text-xs sm:flex">
          {audio ? <Play size={14} /> : <BookOpen size={14} />} Continue
        </Button>
        <button
          aria-label="Options"
          className="p-2 text-muted"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MoreVertical size={19} />
        </button>
        {menuOpen && menu}
      </Card>
    )
  return (
    <Card className="group relative flex flex-col p-3">
      <div
        className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl text-white"
        style={{ backgroundColor: item.color }}
      >
        <span className="text-4xl font-bold opacity-20">NH</span>
        <Badge tone={audio ? 'orange' : 'green'} className="absolute left-2 top-2 bg-surface/90">
          {audio ? <Headphones size={12} /> : <BookOpen size={12} />}{' '}
          {audio ? 'Audiobook' : 'Text story'}
        </Badge>
        {item.offline && (
          <span
            title="Available offline"
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-surface text-brand"
          >
            <Download size={14} />
          </span>
        )}
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold">{item.title}</h3>
      <p className="text-xs text-muted">{item.author}</p>
      <div className="mt-3">
        <div className="flex justify-between gap-2 text-[11px]">
          <span className="truncate text-muted">{item.detail}</span>
          <strong className={audio ? 'text-orange' : 'text-brand'}>{item.progress}%</strong>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-elevated">
          <div
            className={`h-full rounded-full ${audio ? 'bg-orange' : 'bg-brand'}`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px] text-muted">
        <span>{item.activity}</span>
        <button aria-label="Options" onClick={() => setMenuOpen(!menuOpen)}>
          <MoreVertical size={18} />
        </button>
      </div>
      {menuOpen && menu}
    </Card>
  )
}
