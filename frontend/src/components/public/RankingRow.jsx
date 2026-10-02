import { Star } from '../icons'
import { Badge, Button } from '../ui'
export function RankingRow({ item }) {
  const tone = item.change === 'MỚI' ? 'green' : item.change.includes('↓') ? 'red' : 'neutral'
  return (
    <div className="grid grid-cols-[34px_44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[34px_48px_minmax(0,1fr)_100px_50px_auto]">
      <strong className="text-sm text-orange">{String(item.rank).padStart(2, '0')}</strong>
      <div className="grid aspect-[3/4] place-items-center rounded-lg bg-elevated text-lg">📖</div>
      <div className="min-w-0">
        <h3 className="truncate text-xs font-semibold sm:text-sm">{item.title}</h3>
        <p className="truncate text-[10px] text-muted">
          {item.author} · {item.genre}
        </p>
      </div>
      <div className="hidden text-right text-[10px] sm:block">
        <strong className="block">{item.reads}</strong>
        <span className="flex items-center justify-end gap-1 text-orange">
          <Star size={10} className="fill-orange" />
          {item.rating}
        </span>
      </div>
      <Badge tone={tone} className="hidden justify-center sm:inline-flex">
        {item.change}
      </Badge>
      <Button onClick={() => window.location.assign(`/stories/${item.id || 'demo'}`)} variant="secondary" className="min-h-8 px-3 py-1 text-[10px]">
        Xem thử
      </Button>
    </div>
  )
}
