import { useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Button, ButtonLink } from '../ui'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

export function ChapterUnlock({ storyId, chapterId, onUnlocked }) {
  const { t, formatNumber } = useLocale()
  const location = useLocation()

  const basePath =
    `/reader/stories/${encodeURIComponent(storyId)}` +
    `/chapters/${encodeURIComponent(chapterId)}`

  const resource = useBackendDocument(`${basePath}/unlock-quote`, null)
  const quote = resource.data

  const [requestKey] = useState(() => crypto.randomUUID())
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const inFlight = useRef(false)

  async function handlePurchase() {
    if (inFlight.current || !quote || !quote.canAfford || quote.canRead) return

    inFlight.current = true
    setPurchasing(true)
    setPurchaseError('')

    try {
      const result = await apiRequest(`${basePath}/unlock`, {
        method: 'POST',
        body: {
          expectedPriceCoins: quote.priceCoins,
          expectedRevisionId: quote.revisionId,
          requestKey,
        },
      })

      if (result.state !== 'owned' && result.state !== 'free') {
        throw new Error('Unexpected unlock response')
      }

      onUnlocked()
    } catch (error) {
      setPurchaseError(t('unlock.purchaseError'))

      // Giá hoặc số dư có thể đã thay đổi sau khi lấy báo giá.
      if (error.status === 409) resource.retry()
    } finally {
      inFlight.current = false
      setPurchasing(false)
    }
  }

  if (resource.status === 'loading') {
    return <p role="status">{t('unlock.loading')}</p>
  }

  if (resource.error?.status === 401) {
    return (
      <ButtonLink
        to={ROUTES.login}
        state={{ from: location.pathname + location.search }}
      >
        {t('reader.login')}
      </ButtonLink>
    )
  }

  if (resource.status !== 'ready' || !quote) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p role="alert">{t('unlock.loadError')}</p>
        <Button variant="secondary" onClick={resource.retry}>
          {t('reader.retry')}
        </Button>
      </div>
    )
  }

  // Chương có thể vừa được mua ở tab khác hoặc đã hết thời gian khóa.
  if (quote.canRead) {
    return <Button onClick={onUnlocked}>{t('unlock.readNow')}</Button>
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p>{t('unlock.price', { count: formatNumber(quote.priceCoins) })}</p>
      <p>{t('unlock.balance', { count: formatNumber(quote.balance) })}</p>

      {quote.canAfford ? (
        <Button disabled={purchasing} onClick={handlePurchase}>
          {purchasing
            ? t('unlock.purchasing')
            : t('unlock.buy', { count: formatNumber(quote.priceCoins) })}
        </Button>
      ) : (
        <>
          <p>{t('unlock.insufficient')}</p>
          <ButtonLink to={ROUTES.wallet}>{t('unlock.wallet')}</ButtonLink>
        </>
      )}

      {purchaseError && <p role="alert">{purchaseError}</p>}
    </div>
  )
}