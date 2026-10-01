import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Headphones,
  Library,
  LockKeyhole,
  Mail,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PublicHeader } from '../../components/public/PublicHeader'
import { SiteFooter } from '../../components/shared/SiteFooter'
import { Button, Card } from '../../components/ui'
import { LegalContent } from '../system/LegalPage'
import {
  canAccessPath,
  getAccountHome,
  MOCK_PASSWORD,
  mockAccounts,
  useAuth,
} from '../../context/AuthContext'
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

const benefits = [
  { icon: BookOpen, textKey: 'auth.benefitLibrary' },
  { icon: Headphones, textKey: 'auth.benefitListening' },
  { icon: ShieldCheck, textKey: 'auth.benefitPublishing' },
]

export function JoinPage({ initialMode }) {
  const { t } = useLocale()
  const location = useLocation()
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const queryMode = new URLSearchParams(location.search).get('mode')
  const mode = initialMode || queryMode || 'register'
  const isLogin = mode === 'login'
  const [accountType, setAccountType] = useState('reader')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [legalDocument, setLegalDocument] = useState(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    terms: false,
    authorGuidelines: false,
    publishing: false,
    rights: false,
    revenue: false,
  })

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const authorReady =
    accountType === 'reader' ||
    [form.authorGuidelines, form.publishing, form.rights, form.revenue].every(Boolean)

  const switchMode = nextMode => {
    setError('')
    navigate(nextMode === 'login' ? '/login' : '/register', {
      state: location.state,
      replace: true,
    })
  }

  const useDemoAccount = user => {
    setError('')
    setForm(current => ({ ...current, email: user.email, password: MOCK_PASSWORD }))
  }

  const submit = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await new Promise(resolve => setTimeout(resolve, 250))
      const user = isLogin
        ? login(form.email, form.password)
        : register({ name: form.name, email: form.email, accountType })
      const requestedPath = location.state?.from
      navigate(
        requestedPath && canAccessPath(user, requestedPath) ? requestedPath : getAccountHome(user),
        {
          replace: true,
        },
      )
    } catch (reason) {
      setError(reason.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main className="mx-auto grid w-full max-w-[1360px] items-start gap-6 px-5 py-8 md:px-8 lg:min-h-[calc(100vh-72px)] lg:grid-cols-2 lg:items-center lg:gap-8 lg:px-12 lg:py-10">
        <AuthIntroduction isLogin={isLogin} />

        <Card className="w-full p-5 sm:p-7 lg:p-8">
          <div className="grid grid-cols-2 rounded-2xl border border-line bg-elevated p-1">
            <ModeButton active={isLogin} onClick={() => switchMode('login')}>
              {t('auth.signIn')}
            </ModeButton>
            <ModeButton active={!isLogin} onClick={() => switchMode('register')}>
              {t('auth.createAccount')}
            </ModeButton>
          </div>

          <div className="mt-7">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">
              {t(isLogin ? 'auth.welcomeBack' : 'auth.join')}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t(isLogin ? 'auth.continueStory' : 'auth.createIdentity')}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t(isLogin ? 'auth.returnDescription' : 'auth.chooseStart')}
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {!isLogin && (
              <>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold">{t('auth.accountType')}</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
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
                </fieldset>
                <Field label={t('auth.displayName')} icon={UserRound}>
                  <input
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={event => update('name', event.target.value)}
                    placeholder={t('auth.displayNamePlaceholder')}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                  />
                </Field>
              </>
            )}

            <Field label={t('auth.email')} icon={Mail}>
              <input
                required
                autoComplete="email"
                type="email"
                value={form.email}
                onChange={event => update('email', event.target.value)}
                placeholder="you@example.com"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </Field>

            <Field
              label={t('auth.password')}
              icon={LockKeyhole}
              action={
                isLogin ? (
                  <button type="button" onClick={() => setError('Password reset instructions are available in the full backend flow.')} className="font-medium text-brand hover:underline">
                    {t('auth.forgotPassword')}
                  </button>
                ) : null
              }
            >
              <input
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={event => update('password', event.target.value)}
                placeholder={t(isLogin ? 'auth.enterPassword' : 'auth.passwordMin')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-elevated hover:text-ink"
                aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </Field>

            {!isLogin && (
              <AgreementCheck
                label={
                  <span>
                    {t('auth.termsAcceptBefore')}{' '}
                    <button type="button" onClick={event => { event.preventDefault(); setLegalDocument('terms') }} className="font-semibold text-brand hover:underline">
                      {t('legal.termsTitle')}
                    </button>{' '}
                    {t('auth.termsAnd')}{' '}
                    <button type="button" onClick={event => { event.preventDefault(); setLegalDocument('privacy') }} className="font-semibold text-brand hover:underline">
                      {t('legal.privacyTitle')}
                    </button>.
                  </span>
                }
                checked={form.terms}
                onChange={value => update('terms', value)}
              />
            )}

            {!isLogin && accountType === 'author' && (
              <AuthorAgreement form={form} update={update} />
            )}

            {error && (
              <p
                role="alert"
                className="rounded-2xl border border-rose/30 bg-rose/10 p-3 text-xs text-rose"
              >
                {error}
              </p>
            )}

            <Button
              disabled={busy || (!isLogin && (!form.terms || !authorReady))}
              className="w-full"
            >
              {busy ? (
                t('auth.pleaseWait')
              ) : isLogin ? (
                <>
                  {t('auth.signIn')} <ArrowRight size={16} />
                </>
              ) : (
                <>
                  {t('auth.createAccount')} <CheckCircle2 size={16} />
                </>
              )}
            </Button>
          </form>

          {isLogin && <DemoAccounts onSelect={useDemoAccount} />}

          <p className="mt-6 text-center text-xs text-muted">
            {t(isLogin ? 'auth.newToNovelHub' : 'auth.alreadyAccount')}{' '}
            <button
              type="button"
              onClick={() => switchMode(isLogin ? 'register' : 'login')}
              className="font-semibold text-brand hover:underline"
            >
              {t(isLogin ? 'auth.createAccount' : 'auth.signIn')}
            </button>
          </p>
        </Card>
      </main>
      <SiteFooter />
      {legalDocument && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/55 p-4" onClick={() => setLegalDocument(null)}>
          <div role="dialog" aria-modal="true" className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-surface p-6 shadow-2xl sm:p-8" onClick={event => event.stopPropagation()}>
            <div className="mb-5 flex justify-end">
              <button type="button" onClick={() => setLegalDocument(null)} className="grid size-10 place-items-center rounded-full border border-line text-muted hover:text-ink" aria-label={t('auth.closeLegal')}>
                <X size={18} />
              </button>
            </div>
            <LegalContent type={legalDocument} />
          </div>
        </div>
      )}
    </div>
  )
}

function AuthIntroduction({ isLogin }) {
  const { t } = useLocale()
  return (
    <section className="overflow-hidden rounded-3xl border border-line bg-elevated p-6 sm:p-8 lg:p-10">
      <Link to="/" className="inline-flex items-center gap-3 text-xl font-bold">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand text-white">
          <BookOpen size={22} />
        </span>
        <span>
          Novel<span className="text-brand">Hub</span>
        </span>
      </Link>
      <div className="mt-10 max-w-lg">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
          <Sparkles size={14} /> {t('auth.storiesTogether')}
        </span>
        <h2 className="mt-5 text-3xl font-bold leading-tight tracking-[-.03em] sm:text-4xl">
          {t(isLogin ? 'auth.introLoginTitle' : 'auth.introRegisterTitle')}
        </h2>
        <p className="mt-4 text-sm leading-6 text-muted">
          {t('auth.introDescription')}
        </p>
      </div>
      <div className="mt-8 space-y-3 border-t border-line pt-6">
        {benefits.map(({ icon: Icon, textKey }) => (
          <div key={textKey} className="flex items-center gap-3 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-brand">
              <Icon size={17} />
            </span>
            <span className="leading-5 text-muted">{t(textKey)}</span>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs font-medium text-muted">
        {t('auth.freeToJoin')}
      </p>
    </section>
  )
}

function ModeButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? 'bg-surface text-brand' : 'text-muted hover:text-ink'
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
      className={`relative flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
        selected ? 'border-brand bg-brand/10' : 'border-line bg-surface hover:border-brand/50'
      }`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${selected ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}
      >
        <Icon size={18} />
      </span>
      <span>
        <strong className="block text-sm">{t(option.titleKey)}</strong>
        <span className="mt-1 block text-xs leading-5 text-muted">{t(option.descriptionKey)}</span>
      </span>
      {selected && (
        <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-brand text-white">
          <Check size={12} />
        </span>
      )}
    </button>
  )
}

function Field({ label, icon: Icon, action, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold">
        {label}
        {action}
      </span>
      <span className="flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
        <Icon size={17} className="shrink-0 text-muted" />
        {children}
      </span>
    </label>
  )
}

function AgreementCheck({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted">
      <input
        required
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
      {label}
    </label>
  )
}

function AuthorAgreement({ form, update }) {
  const items = [
    ['authorGuidelines', 'Hướng dẫn dành cho tác giả'],
    ['publishing', 'Quy định xuất bản'],
    ['rights', 'Tuyên bố bản quyền và quyền sở hữu'],
    ['revenue', 'Thỏa thuận chia sẻ doanh thu'],
  ]
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck size={19} className="mt-0.5 shrink-0 text-brand" />
        <div>
          <strong className="text-sm">Thỏa thuận xuất bản dành cho tác giả</strong>
          <p className="mt-1 text-xs leading-5 text-muted">
            Tỷ lệ chia sẻ mô phỏng: 80% tác giả / 20% NovelHub
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {items.map(([key, label]) => (
          <AgreementCheck
            key={key}
            label={`Tôi đồng ý với ${label}.`}
            checked={form[key]}
            onChange={value => update(key, value)}
          />
        ))}
      </div>
    </div>
  )
}

function DemoAccounts({ onSelect }) {
  const roleLabels = { guest: 'Khách', reader: 'Độc giả', author: 'Tác giả', moderator: 'Kiểm duyệt viên', admin: 'Quản trị viên' }
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">Tài khoản dùng thử</p>
        <span className="text-[10px] text-muted">Mật khẩu: {MOCK_PASSWORD}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {Object.entries(mockAccounts).map(([role, user]) => (
          <button
            type="button"
            key={user.email}
            onClick={() => onSelect(user)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-left hover:border-brand"
          >
            <strong className="block text-[11px]">{roleLabels[role] || role}</strong>
            <span className="block truncate text-[10px] text-muted">{user.email}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
