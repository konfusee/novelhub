import { useState } from 'react'
import { Badge, Button, Card, Input, Modal, SectionHeader } from '../ui'
import { LockKeyhole } from '../icons'
import { apiRequest } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

export function SecurityPanel() {
  const { currentUser, updateSecurity } = useAuth()
  const { t } = useLocale()
  const [action, setAction] = useState(null)
  const [challenge, setChallenge] = useState('')
  const [codeMinutes, setCodeMinutes] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const enabled = Boolean(currentUser?.twoFactorEnabled)
  const title =
    action === 'password'
      ? t(currentUser?.hasPassword ? 'account.changePassword' : 'security.setPassword')
      : t(action === 'disable' ? 'security.disable' : 'account.configure')
  const reset = () => {
    setAction(null)
    setChallenge('')
    setCurrentPassword('')
    setPassword('')
    setConfirmation('')
    setOtp('')
    setError('')
  }
  const open = value => {
    reset()
    setNotice('')
    setAction(value)
  }
  const submit = async event => {
    event.preventDefault()
    setError('')
    if (action === 'password' && password.length < 10) {
      setError(t('auth.passwordMin'))
      return
    }
    if (action === 'password' && password !== confirmation) {
      setError(t('auth.confirmationMismatch'))
      return
    }
    setBusy(true)
    try {
      if (!challenge) {
        const result = await apiRequest('/auth/security/challenge', {
          method: 'POST',
          body: { action, ...(currentUser?.hasPassword ? { currentPassword } : {}) },
        })
        setChallenge(result.challenge)
        setCodeMinutes(Math.ceil(result.expiresInSeconds / 60))
        setCurrentPassword('')
      } else {
        await updateSecurity(action === 'password' ? 'password' : 'two-factor', {
          challenge,
          otp,
          ...(action === 'password'
            ? { password, passwordConfirmation: confirmation }
            : { enabled: action === 'enable' }),
        })
        setNotice(
          t(
            action === 'password'
              ? 'security.passwordSaved'
              : action === 'enable'
                ? 'security.enabledNotice'
                : 'security.disabledNotice',
          ),
        )
        reset()
      }
    } catch (reason) {
      const keys = {
        invalid_current_password: 'security.wrongPassword',
        invalid_otp: 'security.invalidOtp',
        email_unavailable: 'security.emailUnavailable',
        too_many_attempts: 'security.rateLimited',
        unauthorized: 'security.signInAgain',
        security_state_changed: 'security.stateChanged',
      }
      setError(t(keys[reason.code] || 'security.failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <SectionHeader
        title={
          <span className="flex items-center gap-3">
            <LockKeyhole size={20} aria-hidden="true" />
            {t('account.security')}
          </span>
        }
      />
      <div className="mt-4 divide-y divide-hairline">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong className="text-sm">{t('account.password')}</strong>
            <p className="mt-1 text-sm text-muted">
              {t(currentUser?.hasPassword ? 'account.passwordDescription' : 'security.noPassword')}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => open('password')}>
            {t(currentUser?.hasPassword ? 'account.changePassword' : 'security.setPassword')}
          </Button>
        </div>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm">{t('account.twoFactor')}</strong>
              <Badge>{t(enabled ? 'security.enabled' : 'security.disabled')}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{t('security.emailFactor')}</p>
          </div>
          <Button
            variant={enabled ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => open(enabled ? 'disable' : 'enable')}
          >
            {t(enabled ? 'security.disable' : 'account.configure')}
          </Button>
        </div>
      </div>
      {notice && (
        <p role="status" className="mt-4 rounded-2xl bg-brand-soft p-4 text-sm text-brand-strong">
          {notice}
        </p>
      )}
      <Modal
        open={Boolean(action)}
        title={title}
        onClose={() => {
          if (!busy) reset()
        }}
      >
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm leading-6 text-muted">
            {t(challenge ? 'security.codeSent' : 'security.verifyHint', {
              email: currentUser?.email,
              minutes: codeMinutes,
            })}
          </p>
          {!challenge && currentUser?.hasPassword && (
            <label className="block text-sm font-semibold">
              {t('security.currentPassword')}
              <Input
                className="mt-2"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                maxLength={1024}
              />
            </label>
          )}
          {action === 'password' && (
            <>
              <label className="block text-sm font-semibold">
                {t('security.newPassword')}
                <Input
                  className="mt-2"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={10}
                  maxLength={1024}
                />
              </label>
              <label className="block text-sm font-semibold">
                {t('auth.confirmPassword')}
                <Input
                  className="mt-2"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={e => setConfirmation(e.target.value)}
                  required
                  minLength={10}
                  maxLength={1024}
                />
              </label>
            </>
          )}
          {challenge && (
            <label className="block text-sm font-semibold">
              {t('security.otp')}
              <Input
                className="mt-2"
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                required
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-rose-strong">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {t(busy ? 'auth.pleaseWait' : challenge ? 'security.confirm' : 'security.sendCode')}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  )
}
