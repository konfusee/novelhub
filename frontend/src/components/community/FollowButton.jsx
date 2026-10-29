import { useState } from 'react'
import { Button } from '../ui'
import { Bell, BellRing } from '../icons'
import { followStory } from '../../api/community'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { useLoginRedirect } from './useLoginRedirect'

export function FollowButton({ storyId, following = false, followers, onChange }) {
  const { isAuthenticated } = useAuth()
  const { t, formatNumber } = useLocale()
  const toLogin = useLoginRedirect()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = async () => {
    if (!isAuthenticated) {
      toLogin()
      return
    }
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await followStory(storyId, !following)
      onChange?.({ following: result.following, followers: result.followers })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const Icon = following ? BellRing : Bell
  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <Button
        variant={following ? 'secondary' : 'primary'}
        aria-pressed={isAuthenticated ? following : undefined}
        disabled={busy}
        onClick={toggle}
      >
        <Icon size={16} aria-hidden="true" />
        {busy
          ? t('community.saving')
          : t(following ? 'community.follow.following' : 'community.follow.follow')}
      </Button>
      {typeof followers === 'number' && (
        <span className="text-xs text-muted">
          {t('community.follow.followers', { count: formatNumber(followers) })}
        </span>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-strong">
          {error}
        </p>
      )}
    </div>
  )
}
