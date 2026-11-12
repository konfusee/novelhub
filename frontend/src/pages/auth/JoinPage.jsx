import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Info,
  Library,
  LockKeyhole,
  Mail,
  PenLine,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from '../../components/icons'
import { Link, useLocation, useNavigate } from 'react-router'
import { apiRequest } from '../../api/client'
import { PublicHeader } from '../../components/public/PublicHeader'
import { AuthShowcase } from '../../components/auth/AuthShowcase'
import { Button, Card, IconButton, Input, Modal } from '../../components/ui'
import { authorAgreements } from '../../content/authorAgreements'
import { ROUTES } from '../../app/routes'
import { LegalContent } from '../system/LegalPage'
import { canAccessPath, getAccountHome, useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

const accountOptions = [
  {
    value: 'reader',
    titleKey: 'auth.reader',
    descriptionKey: 'auth.readerDescription',
    icon: Library,
  },
  {
    value: 'author',
    titleKey: 'auth.author',
    descriptionKey: 'auth.authorDescription',
    icon: PenLine,
  },
]

const authorAgreementItems = authorAgreements.map(({ type, title }) => [type, title])

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const FIELD_ORDER = ['name', 'email', 'password', 'confirmation', 'captcha', 'author', 'terms']

export function JoinPage({ initialMode }) {
  const { t } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const { login, loginWithGoogle, register, verifyTwoFactor } = useAuth()
  const queryMode = new URLSearchParams(location.search).get('mode')
  const mode = initialMode || queryMode || 'register'
  const isLogin = mode === 'login'
  const [accountType, setAccountType] = useState('reader')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [resendingVerification, setResendingVerification] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loginChallenge, setLoginChallenge] = useState(
    () => new URLSearchParams(location.search).get('googleChallenge') || '',
  )
  const [loginOtp, setLoginOtp] = useState('')
  const [captchaVersion, setCaptchaVersion] = useState(0)
  const [captcha, setCaptcha] = useState({ token: '', image: '', answer: '', status: 'loading' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const googleError = new URLSearchParams(location.search).get('googleError')
  const googleErrorKeys = {
    cancelled: 'auth.googleCancelled',
    failed: 'auth.googleFailed',
    account_unavailable: 'auth.googleAccountUnavailable',
  }
  const [error, setError] = useState(() =>
    googleError ? t(googleErrorKeys[googleError] || 'auth.googleFailed') : '',
  )
  const [notice, setNotice] = useState('')
  const registered = new URLSearchParams(location.search).get('registered')
  const registrationNotice =
    isLogin && registered
      ? t(
          registered === 'google'
            ? 'auth.googleRegistered'
            : registered === 'email'
              ? 'auth.emailRegistered'
              : 'auth.emailRegisteredDeliveryFailed',
        )
      : ''
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [legalDocument, setLegalDocument] = useState(null)
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [agreementDocument, setAgreementDocument] = useState(authorAgreements[0].type)
  const formRef = useRef(null)
  const agreementReaderRef = useRef(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmation: '',
    terms: false,
    authorGuidelines: false,
    publishing: false,
    rights: false,
    revenue: false,
  })

  useEffect(() => {
    if (isLogin) return
    const controller = new AbortController()
    apiRequest('/auth/captcha', { signal: controller.signal })
      .then(result => setCaptcha({ ...result, answer: '', status: 'ready' }))
      .catch(reason => {
        if (reason.name !== 'AbortError')
          setCaptcha({ token: '', image: '', answer: '', status: 'error' })
      })
    return () => controller.abort()
  }, [isLogin, captchaVersion])
  const strengthRules = [
    form.password.length >= 10,
    /[a-z]/.test(form.password) && /[A-Z]/.test(form.password),
    /[0-9]/.test(form.password),
    /[^a-zA-Z0-9]/.test(form.password),
  ]
  const strength = strengthRules.filter(Boolean).length
  const reloadCaptcha = () => {
    setCaptcha({ token: '', image: '', answer: '', status: 'loading' })
    setCaptchaVersion(value => value + 1)
  }

  const update = (key, value) => {
    setForm(current => ({ ...current, [key]: value }))
    const errorKey = authorAgreementItems.some(([item]) => item === key) ? 'author' : key
    setFieldErrors(current => {
      if (!current[errorKey]) return current
      const next = { ...current }
      delete next[errorKey]
      return next
    })
  }

  const resetFeedback = () => {
    setError('')
    setNotice('')
    setFieldErrors({})
  }

  const switchMode = nextMode => {
    resetFeedback()
    setLoginChallenge('')
    setLoginOtp('')
    navigate(nextMode === 'login' ? '/login' : '/register', {
      state: location.state,
      replace: true,
    })
  }

  const agreementErrors = () => {
    const next = {}
    if (isLogin) return next
    if (!form.terms) next.terms = 'Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.'
    if (accountType === 'author' && !authorAgreementItems.every(([key]) => form[key])) {
      next.author = 'Hãy xác nhận đủ 4 mục của thỏa thuận tác giả.'
    }
    return next
  }

  const credentialErrors = () => {
    const next = {}
    if (!isLogin && !form.name.trim()) next.name = 'Vui lòng nhập tên hiển thị.'
    if (!form.email.trim()) next.email = 'Vui lòng nhập địa chỉ email.'
    else if (!EMAIL_PATTERN.test(form.email.trim()))
      next.email = 'Email chưa đúng định dạng, ví dụ ten@email.com.'
    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.'
    else if (!isLogin && form.password.length < 10) next.password = t('auth.passwordMin')
    if (!isLogin && form.password !== form.confirmation)
      next.confirmation = t('auth.confirmationMismatch')
    if (!isLogin && (!form.confirmation || form.confirmation.length < 10))
      next.confirmation = t('auth.confirmationRequired')
    if (!isLogin && (captcha.status !== 'ready' || captcha.answer.trim().length !== 6))
      next.captcha = t('auth.captchaRequired')
    return next
  }

  const showErrors = errors => {
    setFieldErrors(errors)
    const first = FIELD_ORDER.find(key => errors[key])
    if (!first) return false
    requestAnimationFrame(() => {
      formRef.current?.querySelector(`[data-field="${first}"]`)?.focus()
    })
    return true
  }

  const finishAuth = user => {
    const requestedPath = location.state?.from
    navigate(
      requestedPath && canAccessPath(user, requestedPath) ? requestedPath : getAccountHome(user),
      { replace: true },
    )
  }

  const submit = async event => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!loginChallenge && showErrors({ ...credentialErrors(), ...agreementErrors() })) return
    if (loginChallenge && !/^[0-9]{6}$/.test(loginOtp)) {
      setError(t('security.invalidOtp'))
      return
    }
    setBusy(true)
    try {
      if (isLogin) {
        if (loginChallenge) {
          const user = await verifyTwoFactor(loginChallenge, loginOtp)
          const returnTo = sessionStorage.getItem('novelhub.google.returnTo')
          sessionStorage.removeItem('novelhub.google.returnTo')
          if (
            returnTo?.startsWith('/') &&
            !returnTo.startsWith('//') &&
            canAccessPath(user, returnTo)
          )
            navigate(returnTo, { replace: true })
          else finishAuth(user)
        } else {
          const result = await login(form.email.trim(), form.password, rememberMe)
          if (result.requiresTwoFactor) {
            setLoginChallenge(result.challenge)
            setBusy(false)
          } else finishAuth(result)
        }
      } else {
        const result = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          passwordConfirmation: form.confirmation,
          captchaToken: captcha.token,
          captchaAnswer: captcha.answer,
          accountType,
        })
        navigate(`/login?registered=${result.emailDelivered ? 'email' : 'email-pending'}`, {
          replace: true,
          state: {
            ...location.state,
            from: result.authorApplicationRequired ? ROUTES.authorApply : location.state?.from,
          },
        })
        setBusy(false)
      }
    } catch (reason) {
      const messageKey = {
        invalid_otp: 'security.invalidOtp',
        invalid_captcha: 'auth.captchaInvalid',
        invalid_credentials: 'auth.invalidCredentials',
        email_in_use: 'auth.emailInUse',
        password_mismatch: 'auth.passwordsDiffer',
        validation_error: 'auth.invalidDetails',
        too_many_attempts: 'auth.tooManyAttempts',
        email_not_verified: 'auth.emailNotVerified',
        account_unavailable: 'auth.accountUnavailable',
      }[reason.code]
      setError(t(messageKey ?? 'auth.requestFailed'))
      setVerificationEmail(reason.code === 'email_not_verified' ? form.email.trim() : '')
      if (!isLogin) reloadCaptcha()
      setBusy(false)
    }
  }

  const resendVerification = async () => {
    setResendingVerification(true)
    try {
      await apiRequest('/auth/resend-verification', {
        method: 'POST',
        body: { email: verificationEmail },
      })
      setNotice(t('auth.verificationResent'))
      setError('')
      setVerificationEmail('')
    } catch {
      setError(t('auth.resendVerificationFailed'))
    } finally {
      setResendingVerification(false)
    }
  }

  const continueWithGoogle = async () => {
    setError('')
    setNotice('')
    if (showErrors(agreementErrors())) return
    setBusy(true)
    try {
      await loginWithGoogle({
        mode: isLogin ? 'login' : 'register',
        returnTo: !isLogin && accountType === 'author' ? ROUTES.authorApply : location.state?.from,
      })
    } catch (reason) {
      setError(
        t(reason.code === 'google_unavailable' ? 'auth.googleUnavailable' : 'auth.googleFailed'),
      )
      setBusy(false)
    }
  }

  const describedBy = key => (fieldErrors[key] ? `join-${key}-error` : undefined)
  const selectedAccount = accountOptions.find(option => option.value === accountType)

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <PublicHeader />
      {/*
        12-column split. lg: 6/6 so the form keeps ~400px for paired fields; xl+: visual 7 / form 5.
        Both columns grow with the form; the document owns scrolling, including validation feedback.
      */}
      <main className="w-full flex-1 px-3 pb-8 pt-3 sm:px-4 md:px-6 lg:px-10 lg:pb-3">
        <div className="mx-auto grid max-w-[1360px] grid-cols-12 gap-4 md:gap-6 lg:min-h-[calc(100dvh-6.25rem)] xl:gap-8">
          <Card
            bezel
            aria-labelledby="join-title"
            className="col-span-12 min-w-0 lg:col-span-6 lg:min-h-0 xl:col-span-5"
            innerClassName="flex flex-col p-5 sm:p-7 lg:px-8 lg:py-4"
          >
            <div className="mx-auto my-auto w-full max-w-[30rem]">
              <div
                role="group"
                aria-label={t('auth.join')}
                className="grid grid-cols-2 gap-1 rounded-full border border-hairline bg-elevated p-1"
              >
                <ModeButton active={isLogin} onClick={() => switchMode('login')}>
                  {t('auth.signIn')}
                </ModeButton>
                <ModeButton active={!isLogin} onClick={() => switchMode('register')}>
                  {t('auth.createAccount')}
                </ModeButton>
              </div>

              <div className="mt-5 lg:mt-4 [@media(min-height:860px)]:mt-7">
                <h1 id="join-title" className="text-h2 [@media(min-height:860px)]:text-h1">
                  {t(isLogin ? 'auth.continueStory' : 'auth.createIdentity')}
                </h1>
                {/* Short laptop screens: the register intro stays for screen readers so the form fits. */}
                <p
                  className={`mt-1 text-sm leading-5 text-muted ${
                    isLogin ? '' : 'lg:[@media(max-height:820px)]:sr-only'
                  }`}
                >
                  {t(isLogin ? 'auth.returnDescription' : 'auth.chooseStart')}
                </p>
              </div>

              <form
                ref={formRef}
                noValidate
                onSubmit={submit}
                className="mt-4 space-y-3 lg:space-y-2.5"
              >
                {loginChallenge ? (
                  <>
                    <p role="status" className="text-sm text-muted">
                      {t('security.loginCodeSent')}
                    </p>
                    <label className="block text-sm font-semibold">
                      {t('security.otp')}
                      <Input
                        className="mt-2"
                        autoFocus
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={loginOtp}
                        onChange={e => setLoginOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        required
                      />
                    </label>
                    {error && (
                      <p role="alert" className="text-sm text-rose-strong">
                        {error}
                      </p>
                    )}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {t(busy ? 'auth.pleaseWait' : 'security.confirm')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setLoginChallenge('')
                        setLoginOtp('')
                        setError('')
                        navigate('/login', { replace: true })
                      }}
                    >
                      {t('security.restartLogin')}
                    </Button>
                  </>
                ) : (
                  <>
                    {!isLogin && (
                      <>
                        <fieldset aria-describedby="join-account-type-hint">
                          <legend className="mb-1.5 text-sm font-semibold">
                            {t('auth.accountType')}
                          </legend>
                          <div className="grid grid-cols-2 gap-2">
                            {accountOptions.map(option => (
                              <AccountOption
                                key={option.value}
                                option={option}
                                t={t}
                                selected={accountType === option.value}
                                onSelect={() => setAccountType(option.value)}
                              />
                            ))}
                          </div>
                          <p
                            id="join-account-type-hint"
                            aria-live="polite"
                            className="mt-1.5 pl-4 text-xs leading-4 text-muted"
                          >
                            {t(selectedAccount.descriptionKey)}
                          </p>
                        </fieldset>
                        <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-3">
                          <Field
                            id="join-name"
                            label={t('auth.displayName')}
                            error={fieldErrors.name}
                          >
                            <Input
                              id="join-name"
                              data-field="name"
                              icon={UserRound}
                              autoComplete="name"
                              value={form.name}
                              onChange={event => update('name', event.target.value)}
                              placeholder={t('auth.displayNamePlaceholder')}
                              aria-invalid={Boolean(fieldErrors.name)}
                              aria-describedby={describedBy('name')}
                              className={fieldErrors.name ? 'border-rose!' : undefined}
                            />
                          </Field>
                          <EmailField
                            form={form}
                            update={update}
                            error={fieldErrors.email}
                            describedBy={describedBy}
                            t={t}
                          />
                        </div>
                      </>
                    )}

                    {isLogin && (
                      <EmailField
                        form={form}
                        update={update}
                        error={fieldErrors.email}
                        describedBy={describedBy}
                        t={t}
                      />
                    )}

                    <Field
                      id="join-password"
                      label={t('auth.password')}
                      error={fieldErrors.password}
                      action={
                        isLogin ? (
                          <button
                            type="button"
                            onClick={() => navigate('/forgot-password')}
                            className="rounded-full text-xs font-semibold text-brand-strong underline-offset-4 hover:underline"
                          >
                            {t('auth.forgotPassword')}
                          </button>
                        ) : (
                          <span id="join-password-hint" className="text-xs text-muted">
                            {t('auth.passwordMin')}
                          </span>
                        )
                      }
                    >
                      <Input
                        id="join-password"
                        data-field="password"
                        icon={LockKeyhole}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={event => update('password', event.target.value)}
                        placeholder={t('auth.enterPassword')}
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={
                          [describedBy('password'), isLogin ? undefined : 'join-password-hint']
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                        className={fieldErrors.password ? 'border-rose!' : undefined}
                        trailing={
                          <IconButton
                            type="button"
                            label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                            aria-pressed={showPassword}
                            shape="circle"
                            size="sm"
                            className="border-transparent bg-transparent text-muted"
                            onClick={() => setShowPassword(current => !current)}
                          >
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </IconButton>
                        }
                      />
                    </Field>

                    {!isLogin && (
                      <>
                        {form.password && (
                          <div className="space-y-2" aria-live="polite">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4].map(level => (
                                <span
                                  key={level}
                                  className={
                                    'h-1 flex-1 rounded-full ' +
                                    (level <= strength
                                      ? strength < 2
                                        ? 'bg-rose'
                                        : strength < 4
                                          ? 'bg-orange'
                                          : 'bg-brand'
                                      : 'bg-line')
                                  }
                                />
                              ))}
                            </div>
                            <p className="text-xs text-muted">
                              {t('auth.strengthLabel', { strength: t('auth.strength' + strength) })}
                            </p>
                            <ul className="grid grid-cols-2 gap-1 text-xs text-muted">
                              {strengthRules.map((valid, index) => (
                                <li key={index} className={valid ? 'text-brand-strong' : ''}>
                                  {valid ? '✓ ' : '○ '}
                                  {t('auth.passwordRule' + index)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Field
                          id="join-confirmation"
                          label={t('auth.confirmPassword')}
                          error={fieldErrors.confirmation}
                        >
                          <Input
                            id="join-confirmation"
                            data-field="confirmation"
                            icon={LockKeyhole}
                            type={showConfirmation ? 'text' : 'password'}
                            autoComplete="new-password"
                            maxLength={1024}
                            value={form.confirmation}
                            onChange={event => update('confirmation', event.target.value)}
                            aria-invalid={Boolean(fieldErrors.confirmation)}
                            aria-describedby={describedBy('confirmation')}
                            placeholder={t('auth.enterConfirmation')}
                            trailing={
                              <IconButton
                                type="button"
                                label={t(
                                  showConfirmation
                                    ? 'auth.hideConfirmation'
                                    : 'auth.showConfirmation',
                                )}
                                tone="neutral"
                                shape="circle"
                                className="border-transparent! bg-transparent! text-muted"
                                onClick={() => setShowConfirmation(value => !value)}
                              >
                                {showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}
                              </IconButton>
                            }
                          />
                        </Field>
                        <div className="rounded-2xl border border-line bg-surface p-3">
                          <label htmlFor="join-captcha" className="text-sm font-semibold">
                            {t('auth.captchaLabel')}
                          </label>
                          <div className="my-2 flex flex-wrap items-center gap-3">
                            {captcha.image ? (
                              <img
                                src={captcha.image}
                                alt={t('auth.captchaImage')}
                                width={220}
                                height={70}
                                className="max-w-full rounded-xl"
                              />
                            ) : (
                              <p role="status" className="text-xs text-muted">
                                {t(
                                  captcha.status === 'error'
                                    ? 'auth.captchaUnavailable'
                                    : 'auth.captchaLoading',
                                )}
                              </p>
                            )}
                            <IconButton
                              type="button"
                              label={t('auth.captchaReload')}
                              onClick={reloadCaptcha}
                              disabled={captcha.status === 'loading'}
                            >
                              <RefreshCw size={18} />
                            </IconButton>
                          </div>
                          <Input
                            id="join-captcha"
                            data-field="captcha"
                            autoComplete="off"
                            maxLength={6}
                            value={captcha.answer}
                            onChange={event =>
                              setCaptcha(current => ({
                                ...current,
                                answer: event.target.value.toUpperCase(),
                              }))
                            }
                            placeholder={t('auth.captchaPlaceholder')}
                            aria-invalid={Boolean(fieldErrors.captcha)}
                            aria-describedby="join-captcha-error"
                          />
                          <FieldError id="join-captcha-error" message={fieldErrors.captcha} />
                        </div>
                      </>
                    )}
                    {isLogin && (
                      <AgreementCheck
                        label={t('auth.rememberMe')}
                        checked={rememberMe}
                        onChange={setRememberMe}
                      />
                    )}

                    {!isLogin && accountType === 'author' && (
                      <AuthorAgreementTrigger
                        form={form}
                        error={fieldErrors.author}
                        describedBy={describedBy('author')}
                        onOpen={() => setAgreementOpen(true)}
                      />
                    )}

                    {!isLogin && (
                      <div>
                        <AgreementCheck
                          field="terms"
                          checked={form.terms}
                          invalid={Boolean(fieldErrors.terms)}
                          describedBy={describedBy('terms')}
                          onChange={value => update('terms', value)}
                          label={
                            <span>
                              {t('auth.termsAcceptBefore')}{' '}
                              <LegalLink onOpen={() => setLegalDocument('terms')}>
                                {t('legal.termsTitle')}
                              </LegalLink>{' '}
                              {t('auth.termsAnd')}{' '}
                              <LegalLink onOpen={() => setLegalDocument('privacy')}>
                                {t('legal.privacyTitle')}
                              </LegalLink>
                              .
                            </span>
                          }
                        />
                        <FieldError id="join-terms-error" message={fieldErrors.terms} />
                      </div>
                    )}

                    {error && (
                      <p
                        role="alert"
                        className="flex items-start gap-2.5 rounded-2xl border border-rose/30 bg-rose/10 px-4 py-2.5 text-sm leading-5 text-rose-strong"
                      >
                        <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                        {error}
                      </p>
                    )}
                    {isLogin && verificationEmail === form.email.trim() && verificationEmail && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resendVerification}
                        disabled={resendingVerification}
                      >
                        {t('auth.resendVerification')}
                      </Button>
                    )}
                    {(notice || registrationNotice) && (
                      <p
                        role="status"
                        className="flex items-start gap-2.5 rounded-2xl border border-hairline bg-brand-soft px-4 py-2.5 text-sm leading-5 text-ink"
                      >
                        <Info size={17} className="mt-0.5 shrink-0 text-brand-strong" />
                        {notice || registrationNotice}
                      </p>
                    )}

                    <div className="grid gap-2.5 pt-1 xl:grid-cols-2">
                      <Button
                        type="submit"
                        size="lg"
                        disabled={busy}
                        aria-busy={busy}
                        trailingIcon={busy ? undefined : ArrowRight}
                        className="w-full"
                      >
                        {busy
                          ? t('auth.pleaseWait')
                          : t(isLogin ? 'auth.signIn' : 'auth.createAccount')}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        disabled={busy}
                        onClick={continueWithGoogle}
                        className="w-full px-4 text-sm"
                      >
                        <GoogleMark />
                        {t(isLogin ? 'auth.signInWithGoogle' : 'auth.signUpWithGoogle')}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </Card>

          <AuthShowcase
            variant={isLogin ? 'login' : 'register'}
            className="col-span-12 lg:order-first lg:col-span-6 xl:col-span-7"
          />
        </div>
      </main>
      <Modal
        open={agreementOpen}
        title={t('legal.author.agreementTitle')}
        onClose={() => setAgreementOpen(false)}
        className="max-w-none lg:w-2/3"
      >
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section
            ref={agreementReaderRef}
            aria-label={t('legal.author.readPane')}
            className="max-h-[45dvh] min-w-0 overflow-y-auto rounded-2xl border border-line bg-surface p-5 lg:max-h-[65dvh]"
          >
            <h3 className="text-h3">
              {t(authorAgreements.find(({ type }) => type === agreementDocument).title)}
            </h3>
            <LegalContent key={agreementDocument} type={agreementDocument} compact />
          </section>
          <div className="min-w-0 lg:max-h-[65dvh] lg:overflow-y-auto">
            <AuthorAgreementChecklist
              form={form}
              update={update}
              error={fieldErrors.author}
              selected={agreementDocument}
              onRead={document => {
                setAgreementDocument(document)
                requestAnimationFrame(() => {
                  if (!agreementReaderRef.current) return
                  agreementReaderRef.current.scrollTop = 0
                  if (window.matchMedia('(max-width: 1023px)').matches)
                    agreementReaderRef.current.scrollIntoView({
                      block: 'nearest',
                      behavior: 'smooth',
                    })
                })
              }}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => setAgreementOpen(false)}>
            {t('legal.author.done')}
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(legalDocument)}
        title={t(legalDocument === 'privacy' ? 'legal.privacyTitle' : 'legal.termsTitle')}
        onClose={() => setLegalDocument(null)}
        className="max-w-none lg:w-2/3"
      >
        {legalDocument && <LegalContent type={legalDocument} compact />}
      </Modal>
    </div>
  )
}

function EmailField({ form, update, error, describedBy, t }) {
  return (
    <Field id="join-email" label={t('auth.email')} error={error}>
      <Input
        id="join-email"
        data-field="email"
        icon={Mail}
        autoComplete="email"
        inputMode="email"
        type="email"
        value={form.email}
        onChange={event => update('email', event.target.value)}
        placeholder="ten@email.com"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy('email')}
        className={error ? 'border-rose!' : undefined}
      />
    </Field>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px] shrink-0">
      <path
        fill="var(--color-google-blue)"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"
      />
      <path
        fill="var(--color-google-green)"
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="var(--color-google-yellow)"
        d="M6.5 14a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 9L6.5 14Z"
      />
      <path
        fill="var(--color-google-red)"
        d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7.6l3.4 2.6A5.9 5.9 0 0 1 12 6.1Z"
      />
    </svg>
  )
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-full px-3 py-2 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 ${
        active
          ? 'bg-surface text-brand-strong shadow-whisper ring-1 ring-hairline'
          : 'text-ink/70 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function AccountOption({ option, selected, onSelect, t }) {
  const Icon = option.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-11 min-w-0 items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-left text-sm font-semibold transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98] sm:gap-2.5 sm:pr-4 ${
        selected
          ? 'border-brand bg-brand-soft text-brand-strong'
          : 'border-line bg-surface text-ink/80 hover:border-brand/50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-200 ${
          selected ? 'bg-brand text-on-brand' : 'bg-elevated text-ink/70'
        }`}
      >
        {selected ? <Check size={15} /> : <Icon size={16} />}
      </span>
      <span className="min-w-0 truncate">{t(option.titleKey)}</span>
    </button>
  )
}

function Field({ id, label, action, error, children }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {action}
      </div>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 pl-4 text-xs font-medium text-rose-strong"
    >
      <AlertTriangle size={13} className="mt-px shrink-0" />
      {message}
    </p>
  )
}

function LegalLink({ onOpen, children }) {
  return (
    <button
      type="button"
      onClick={event => {
        event.preventDefault()
        onOpen()
      }}
      className="rounded-sm font-semibold text-brand-strong underline-offset-4 hover:underline"
    >
      {children}
    </button>
  )
}

function AgreementCheck({ field, label, checked, onChange, invalid, describedBy }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-ink/80">
      <input
        type="checkbox"
        data-field={field}
        checked={checked}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={event => onChange(event.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
      />
      {label}
    </label>
  )
}

function AuthorAgreementTrigger({ form, error, describedBy, onOpen }) {
  const done = authorAgreementItems.filter(([key]) => form[key]).length
  const complete = done === authorAgreementItems.length
  return (
    <div>
      <button
        type="button"
        data-field="author"
        aria-haspopup="dialog"
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy}
        onClick={onOpen}
        className={`group flex min-h-11 w-full min-w-0 items-center gap-3 rounded-full border py-1 pl-1.5 pr-3 text-left transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] ${
          error
            ? 'border-rose/60 bg-rose/5'
            : complete
              ? 'border-brand/40 bg-brand-soft'
              : 'border-line bg-surface hover:border-brand/50'
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid size-8 shrink-0 place-items-center rounded-full ${
            complete ? 'bg-brand text-on-brand' : 'bg-brand/12 text-brand-strong'
          }`}
        >
          {complete ? <Check size={15} /> : <ShieldCheck size={16} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">Thỏa thuận tác giả</span>
        <span
          className={`shrink-0 text-xs font-semibold ${complete ? 'text-brand-strong' : 'text-muted'}`}
        >
          {done}/{authorAgreementItems.length}
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
      <FieldError id="join-author-error" message={error} />
    </div>
  )
}

function AuthorAgreementChecklist({ form, update, error, selected, onRead }) {
  const { t } = useLocale()
  return (
    <fieldset>
      <legend className="sr-only">{t('legal.author.agreementTitle')}</legend>
      <p className="flex items-center gap-2.5 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-ink">
        <ShieldCheck size={17} className="shrink-0 text-brand-strong" />
        {t('legal.author.demoShare')}
      </p>
      <p className="mt-4 text-sm leading-6 text-muted">{t('legal.author.readHint')}</p>
      <div className="mt-4 grid gap-3">
        {authorAgreementItems.map(([key, title]) => (
          <div key={key} className="rounded-2xl border border-line bg-surface p-4">
            <button
              type="button"
              onClick={() => onRead(key)}
              aria-pressed={selected === key}
              className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-brand-strong"
            >
              <span>{t(title)}</span>
              <ChevronRight size={17} className="shrink-0" />
            </button>
            <Link
              to={ROUTES.authorAgreement(key)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-brand-strong underline underline-offset-4"
            >
              {t('legal.author.openPage')}
              <ArrowRight size={14} />
            </Link>
            <div className="mt-2 border-t border-line pt-3">
              <AgreementCheck
                label={t('legal.author.agree', { title: t(title) })}
                checked={form[key]}
                invalid={Boolean(error) && !form[key]}
                onChange={value => update(key, value)}
              />
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  )
}
