import { Crown, Star } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import { StoryCover } from '../story/StoryCover'
export function PodiumCard({ story }) {
  const champion = story.rank === 1
  return (
    <Card
      className={`relative flex flex-col p-4 ${champion ? 'border-orange lg:-mt-4 lg:min-h-[430px]' : 'lg:min-h-[390px]'}`}
    >
      <div className="flex items-center justify-between">
        <Badge tone={champion ? 'orange' : 'neutral'}>
          {champion ? (
            <>
              <Crown size={11} /> Champion #1
            </>
          ) : (
            `Rank #0${story.rank}`
          )}
        </Badge>
        <Badge tone={story.change.includes('↓') ? 'red' : 'green'}>{story.change}</Badge>
      </div>
      <StoryCover story={story} className="mt-4 aspect-[2/3] max-h-56 rounded-2xl" />
      <Badge tone="green" className="mt-3 w-fit">
        {story.genre}
      </Badge>
      <h3 className={`${champion ? 'text-xl' : 'text-lg'} mt-2 font-bold`}>{story.title}</h3>
      <p className="text-xs text-muted">by {story.author}</p>
      {champion && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">
          The wind moved gently through the ancient trees, carrying whispers of forgotten stories.
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span className="flex items-center gap-1 font-semibold text-orange">
          <Star size={13} className="fill-orange" />
          {story.rating}
        </span>
        <span>
          <strong>{story.reads}</strong> reads
        </span>
      </div>
      <Button onClick={() => window.location.assign(`/stories/${story.id || 'demo'}`)} variant={champion ? 'primary' : 'secondary'} className="mt-auto min-h-9 py-2 text-xs">
        {champion ? 'Start Reading' : 'Read Preview'}
      </Button>
    </Card>
  )
}
