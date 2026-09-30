import { useState } from 'react'
import { ArrowRight, Bell, BellOff, Heart } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import { useLocale } from '../../context/LocaleContext'

export function SavedStoryCard({ story }) {
  const { t } = useLocale()
  const [favorite, setFavorite] = useState(story.favorite)
  const [alerts, setAlerts] = useState(story.alerts)
  return (
    <Card className="flex gap-4 p-4">
      <div
        className="relative grid h-40 w-24 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white"
        style={{ backgroundColor: story.color }}
      >
        <span className="opacity-30">NH</span>
        <Badge className="absolute left-2 top-2 bg-surface/90 text-ink">{story.genre}</Badge>
      </div>
      <div className="min-w-0 flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="truncate text-lg font-semibold">{story.title}</h3>
            <p className="mt-1 text-xs text-muted">{story.author}</p>
          </div>
          <button aria-label={t('following.toggleFavorite')} onClick={() => setFavorite(!favorite)}>
            <Heart size={20} className={favorite ? 'fill-rose text-rose' : 'text-muted'} />
          </button>
        </div>
        <p className="mt-4 rounded-xl bg-elevated px-3 py-2 text-xs text-brand">
          ● &nbsp;{story.update}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
          <button
            onClick={() => setAlerts(!alerts)}
            className="flex items-center gap-1.5 text-xs text-muted"
          >
            {alerts ? <Bell size={16} className="text-brand" /> : <BellOff size={16} />}{' '}
            {t(alerts ? 'following.alertsOn' : 'following.muted')}
          </button>
      <Button onClick={() => window.location.assign(`/stories/${story.id || 'demo'}`)} className="min-h-9 px-3 py-1.5 text-xs">
            {t('following.readNext')} <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
