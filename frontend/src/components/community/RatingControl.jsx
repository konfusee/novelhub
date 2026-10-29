import { useId, useState } from 'react'
import { Button } from '../ui'
import { Star } from '../icons'
import { clearRating, rateStory } from '../../api/community'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { useLoginRedirect } from './useLoginRedirect'

const STARS = [1, 2, 3, 4, 5]

export function RatingControl({ storyId, value = null, average = null, count = 0, onChange }) {
  const { isAuthenticated } = useAuth()
  const { t, locale, formatNumber } = useLocale()
  const toLogin = useLoginRedirect()
  const legendId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hover, setHover] = useState(0)
  const shown = hover || value || 0

  const apply = async request => {
    setBusy(true)
    setError('')
    try {
      const result = await request()
      onChange?.({
        value: result.value ?? null,
        average: result.average ?? null,
        count: result.count ?? 0,
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const choose = star => {
    if (!isAuthenticated) {
      toLogin()
      return
    }
    if (busy || star === value) return
    apply(() => rateStory(storyId, star))
  }

  const averageText =
    average == null
      ? null
      : Number(average).toLocaleString(locale === 'en' ? 'en' : 'vi-VN', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        {averageText ? (
          <>
            <span className="flex items-center gap-1.5 text-3xl font-semibold text-ink">
              <Star size={24} className="fill-current text-orange-strong" aria-hidden="true" />
              {averageText}
              <span className="text-base font-normal text-muted">/5</span>
            </span>
            <span className="pb-1 text-sm text-muted">
              {t('community.rating.count', { count: formatNumber(count) })}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">{t('community.rating.none')}</span>
        )}
      </div>
      <fieldset aria-describedby={`${legendId}-status`}>
        <legend className="text-sm font-semibold text-ink">{t('community.rating.label')}</legend>
        <div className="mt-2 flex flex-wrap items-center gap-1" onMouseLeave={() => setHover(0)}>
          {STARS.map(star => (
            <button
              key={star}
              type="button"
              aria-label={t('community.rating.star', { value: star })}
              aria-pressed={isAuthenticated ? value === star : undefined}
              disabled={busy}
              onClick={() => choose(star)}
              onMouseEnter={() => setHover(star)}
              onFocus={() => setHover(star)}
              onBlur={() => setHover(0)}
              className="grid size-11 place-items-center rounded-full text-muted transition-colors hover:bg-orange/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <Star
                size={26}
                aria-hidden="true"
                className={star <= shown ? 'fill-current text-orange-strong' : undefined}
              />
            </button>
          ))}
          {isAuthenticated && value != null && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => apply(() => clearRating(storyId))}
            >
              {t('community.rating.clear')}
            </Button>
          )}
        </div>
        <p id={`${legendId}-status`} className="mt-2 text-xs text-muted">
          {busy
            ? t('community.saving')
            : !isAuthenticated
              ? t('community.rating.signIn')
              : value != null
                ? t('community.rating.yours', { value })
                : t('community.rating.prompt')}
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-rose-strong">
          {error}
        </p>
      )}
    </div>
  )
}
