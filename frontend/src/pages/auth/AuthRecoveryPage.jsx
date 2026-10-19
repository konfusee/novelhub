import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { apiRequest } from '../../api/client'
import { PublicHeader } from '../../components/public/PublicHeader'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
} from '../../components/icons'
import { Button, ButtonLink, Card, IconButton, Input } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

export function AuthRecoveryPage({ mode }) {
  const { t } = useLocale()
  const [params] = useSearchParams()
  const [step, setStep] = useState(mode === 'forgot' ? 'email' : mode)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState('')
  const [token, setToken] = useState(params.get('token') || '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deadlines, setDeadlines] = useState({ resend: 0, expires: 0 })
  const [now, setNow] = useState(0)
  const heading = useRef(null)
  const key = (name, variables) => t('auth.recovery.' + name, variables)
  const remaining = Math.max(0, Math.ceil((deadlines.expires - now) / 1000))
  const cooldown = Math.max(0, Math.ceil((deadlines.resend - now) / 1000))
  const activeStep = step === 'email' ? 0 : step === 'otp' ? 1 : 2

  useEffect(() => {
    heading.current?.focus()
  }, [step])
  useEffect(() => {
    if (step !== 'otp') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [step])

  const reportError = caught => {
    const messages = {
      invalid_otp: 'invalidOtp',
      invalid_token: 'invalidToken',
      otp_cooldown: 'cooldownError',
      too_many_attempts: 'tooMany',
      network_error: 'networkError',
      validation_error: 'validationError',
    }
    setError(key(messages[caught.code] || 'requestError'))
  }
  const sendCode = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
      })
      const sentAt = Date.now()
      setChallenge(result.challenge)
      setOtp('')
      setNow(sentAt)
      setDeadlines({
        resend: sentAt + result.retryAfterSeconds * 1000,
        expires: sentAt + result.expiresInSeconds * 1000,
      })
      setStep('otp')
      setNotice(key('sent'))
    } catch (caught) {
      reportError(caught)
    } finally {
      setBusy(false)
    }
  }
  const submit = async event => {
    event.preventDefault()
    if (step === 'email') return sendCode()
    if (step === 'reset' && password !== confirmation) {
      setError(key('mismatch'))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (step === 'otp') {
        const result = await apiRequest('/auth/verify-reset-otp', {
          method: 'POST',
          body: { challenge, otp },
        })
        setToken(result.token)
        setOtp('')
        setStep('reset')
      } else {
        await apiRequest(step === 'verify' ? '/auth/verify-email' : '/auth/reset-password', {
          method: 'POST',
          body: step === 'verify' ? { token } : { token, password },
        })
        setPassword('')
        setConfirmation('')
        setToken('')
        setStep('done')
      }
    } catch (caught) {
      reportError(caught)
    } finally {
      setBusy(false)
    }
  }
  const missingToken = (step === 'reset' || step === 'verify') && !token
  const Icon =
    step === 'email'
      ? Mail
      : step === 'otp'
        ? ShieldCheck
        : step === 'done'
          ? CheckCircle2
          : KeyRound

  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main className="mx-auto grid min-h-[calc(100svh-4.75rem)] max-w-5xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-16">
        <section className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-strong">
            {key('eyebrow')}
          </p>
          <h2 className="mt-4 text-h1">{key('asideTitle')}</h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
            {key('asideDescription')}
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-surface p-5">
            <ShieldCheck size={24} className="shrink-0 text-brand-strong" />
            <div>
              <p className="text-sm font-semibold">{key('securityTitle')}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {key('securityDescription')}
              </p>
            </div>
          </div>
        </section>
        <Card className="mx-auto w-full min-w-0 max-w-xl p-6 sm:p-8 lg:max-w-none">
          {mode !== 'verify' && step !== 'done' && (
            <ol aria-label={key('stepsLabel')} className="mb-8 flex gap-2">
              {['emailStep', 'otpStep', 'resetStep'].map((label, index) => (
                <li
                  key={label}
                  aria-current={activeStep === index ? 'step' : undefined}
                  className="min-w-0 flex-1"
                >
                  <div
                    className={
                      'mb-2 h-1 rounded-full ' + (index <= activeStep ? 'bg-brand' : 'bg-line')
                    }
                  />
                  <span
                    className={
                      'flex items-center gap-1 text-xs ' +
                      (index === activeStep ? 'font-semibold text-ink' : 'text-muted')
                    }
                  >
                    {index < activeStep ? <Check size={12} /> : <span>{index + 1}.</span>}
                    {key(label)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand-strong">
            <Icon size={24} />
          </div>
          <h1 ref={heading} tabIndex={-1} className="text-h2 outline-none">
            {key(step + 'Title')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{key(step + 'Description')}</p>
          {step === 'otp' && <p className="mt-2 break-all text-sm font-semibold">{email.trim()}</p>}
          {step === 'done' ? (
            <ButtonLink to="/login" className="mt-6 w-full">
              {key('login')}
            </ButtonLink>
          ) : (
            <form className="mt-6 space-y-5" onSubmit={submit}>
              <fieldset disabled={busy} className="space-y-5">
                {step === 'email' && (
                  <div className="space-y-2">
                    <label htmlFor="recovery-email" className="block text-sm font-semibold">
                      {key('emailLabel')}
                    </label>
                    <Input
                      id="recovery-email"
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                      maxLength={254}
                      required
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      placeholder={key('emailPlaceholder')}
                    />
                  </div>
                )}
                {step === 'otp' && (
                  <div className="space-y-3">
                    <label htmlFor="recovery-otp" className="block text-sm font-semibold">
                      {key('otpLabel')}
                    </label>
                    <Input
                      id="recovery-otp"
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otp}
                      onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder={key('otpPlaceholder')}
                      aria-describedby="otp-expiry"
                      className="[&_input]:py-3 [&_input]:text-center [&_input]:text-2xl [&_input]:font-semibold [&_input]:tracking-[0.4em]"
                    />
                    <p id="otp-expiry" className="text-xs text-muted">
                      {remaining
                        ? key('expires', {
                            time:
                              Math.floor(remaining / 60) +
                              ':' +
                              String(remaining % 60).padStart(2, '0'),
                          })
                        : key('expired')}
                    </p>
                  </div>
                )}
                {step === 'reset' && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="recovery-password" className="block text-sm font-semibold">
                        {key('passwordLabel')}
                      </label>
                      <Input
                        id="recovery-password"
                        icon={KeyRound}
                        type={visible ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={10}
                        maxLength={1024}
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        aria-describedby="password-help"
                        trailing={
                          <IconButton
                            type="button"
                            aria-label={key(visible ? 'hidePassword' : 'showPassword')}
                            onClick={() => setVisible(!visible)}
                          >
                            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                          </IconButton>
                        }
                      />
                      <p id="password-help" className="text-xs text-muted">
                        {key('passwordHelp')}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="recovery-confirmation"
                        className="block text-sm font-semibold"
                      >
                        {key('confirmationLabel')}
                      </label>
                      <Input
                        id="recovery-confirmation"
                        type={visible ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={10}
                        maxLength={1024}
                        value={confirmation}
                        onChange={event => setConfirmation(event.target.value)}
                      />
                    </div>
                  </>
                )}
                {missingToken && (
                  <p role="alert" className="text-sm text-rose-strong">
                    {key('invalidToken')}
                  </p>
                )}
                {error && (
                  <p role="alert" className="rounded-2xl bg-rose/10 p-3 text-sm text-rose-strong">
                    {error}
                  </p>
                )}
                {notice && (
                  <p role="status" className="text-sm text-brand-strong">
                    {notice}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    busy || missingToken || (step === 'otp' && (otp.length !== 6 || !remaining))
                  }
                  className="w-full"
                >
                  {key(busy ? 'busy' : step + 'Action')}
                </Button>
              </fieldset>
              {step === 'otp' && (
                <div className="space-y-3 text-center">
                  <p className="text-xs text-muted">{key('checkSpam')}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    disabled={busy || cooldown > 0}
                    onClick={sendCode}
                  >
                    {cooldown ? key('resendAfter', { seconds: cooldown }) : key('resend')}
                  </Button>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-sm font-semibold text-muted hover:text-ink"
                    onClick={() => {
                      setStep('email')
                      setOtp('')
                      setChallenge('')
                      setError('')
                      setNotice('')
                    }}
                  >
                    {key('changeEmail')}
                  </button>
                </div>
              )}
              {missingToken && (
                <Link
                  to="/forgot-password"
                  className="block text-sm font-semibold text-brand-strong"
                >
                  {key('restart')}
                </Link>
              )}
            </form>
          )}
          {step !== 'done' && (
            <Link
              to="/login"
              className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-ink"
            >
              <ArrowLeft size={16} />
              {key('back')}
            </Link>
          )}
        </Card>
      </main>
    </div>
  )
}
