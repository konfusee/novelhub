import { CommentThread } from '../community/CommentThread'
import { RatingControl } from '../community/RatingControl'
import { useLocale } from '../../context/LocaleContext'

/** Story discussion tab: the reader's 1–5 rating plus the story comment thread. */
export function StoryCommunity({ storyId, rating, onRatingChange }) {
  const { t } = useLocale()
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-reader p-4 sm:p-5">
        <h3 className="mb-4 text-lg font-semibold text-ink">{t('community.rating.title')}</h3>
        <RatingControl
          storyId={storyId}
          value={rating?.value ?? null}
          average={rating?.average ?? null}
          count={rating?.count ?? 0}
          onChange={onRatingChange}
        />
      </section>
      <CommentThread targetType="story" targetId={storyId} />
    </div>
  )
}
