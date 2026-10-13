import { useRef, useState } from 'react';
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
  ShieldCheck,
  UserRound,
} from '../../components/icons';
import { useLocation, useNavigate } from 'react-router';
import { PublicHeader } from '../../components/public/PublicHeader';
import { AuthShowcase } from '../../components/auth/AuthShowcase';
import { Button, Card, IconButton, Input, Modal } from '../../components/ui';
import { LegalContent } from '../system/LegalPage';
import {
  canAccessPath,
  getAccountHome,
  useAuth,
} from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';

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
];

const authorAgreementItems = [
  ['authorGuidelines', 'Hướng dẫn dành cho tác giả'],
  ['publishing', 'Quy định xuất bản'],
  ['rights', 'Tuyên bố bản quyền và quyền sở hữu'],
  ['revenue', 'Thỏa thuận chia sẻ doanh thu'],
];

const AUTHOR_AGREEMENT_TITLE = 'Thỏa thuận xuất bản dành cho tác giả';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_ORDER = ['name', 'email', 'password', 'author', 'terms'];

export function JoinPage({ initialMode }) {
  const { t } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const queryMode = new URLSearchParams(location.search).get('mode');
  const mode = initialMode || queryMode || 'register';
  const isLogin = mode === 'login';
  const [accountType, setAccountType] = useState('reader');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [legalDocument, setLegalDocument] = useState(null);
  const [agreementOpen, setAgreementOpen] = useState(false);
  const formRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    terms: false,
    authorGuidelines: false,
    publishing: false,
    rights: false,
    revenue: false,
  });

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    const errorKey = authorAgreementItems.some(([item]) => item === key) ? 'author' : key;
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };

  const resetFeedback = () => {
    setError('');
    setNotice('');
    setFieldErrors({});
  };

  const switchMode = (nextMode) => {
    resetFeedback();
    navigate(nextMode === 'login' ? '/login' : '/register', {
      state: location.state,
      replace: true,
    });
  };

  const agreementErrors = () => {
    const next = {};
    if (isLogin) return next;
    if (!form.terms) next.terms = 'Bạn cần đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.';
    if (accountType === 'author' && !authorAgreementItems.every(([key]) => form[key])) {
      next.author = 'Hãy xác nhận đủ 4 mục của thỏa thuận tác giả.';
    }
    return next;
  };

  const credentialErrors = () => {
    const next = {};
    if (!isLogin && !form.name.trim()) next.name = 'Vui lòng nhập tên hiển thị.';
    if (!form.email.trim()) next.email = 'Vui lòng nhập địa chỉ email.';
    else if (!EMAIL_PATTERN.test(form.email.trim()))
      next.email = 'Email chưa đúng định dạng, ví dụ ten@email.com.';
    if (!form.password) next.password = 'Vui lòng nhập mật khẩu.';
    else if (form.password.length < 6) next.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    return next;
  };

  const showErrors = (errors) => {
    setFieldErrors(errors);
    const first = FIELD_ORDER.find((key) => errors[key]);
    if (!first) return false;
    requestAnimationFrame(() => {
      formRef.current?.querySelector(`[data-field="${first}"]`)?.focus();
    });
    return true;
  };

  const finishAuth = (user) => {
    const requestedPath = location.state?.from;
    navigate(
      requestedPath && canAccessPath(user, requestedPath) ? requestedPath : getAccountHome(user),
      { replace: true },
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (showErrors({ ...credentialErrors(), ...agreementErrors() })) return;
    setBusy(true);
    try {
      if (isLogin) {
        finishAuth(await login(form.email.trim(), form.password));
      } else {
        const result = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          accountType,
        });
        setNotice(
          result.emailDelivered
            ? 'Tài khoản đã được tạo. Hãy kiểm tra email để xác minh trước khi đăng nhập.'
            : 'Tài khoản đã được tạo nhưng email xác minh chưa gửi được. Hãy dùng chức năng gửi lại.',
        );
        setBusy(false);
      }
    } catch (reason) {
      setError(reason.message);
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    setError('');
    setNotice('');
    setError('Google OAuth cần cấu hình máy chủ trước khi sử dụng.');
  };

  const describedBy = (key) => (fieldErrors[key] ? `join-${key}-error` : undefined);
  const selectedAccount = accountOptions.find((option) => option.value === accountType);

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <PublicHeader />
      {/*
        12-column split. lg: 6/6 so the form keeps ~400px for paired fields; xl+: visual 7 / form 5.
        At lg+ the grid is exactly the viewport below the 76px header island (no page scroll); the
        form plate scrolls internally only when validation messages outgrow it.
      */}
      <main className="w-full flex-1 px-3 pb-8 pt-3 sm:px-4 md:px-6 lg:px-10 lg:pb-3">
        <div className="mx-auto grid max-w-[1360px] grid-cols-12 gap-4 md:gap-6 lg:h-[calc(100dvh-6.25rem)] lg:min-h-[34rem] xl:gap-8">
          <Card
            bezel
            aria-labelledby="join-title"
            className="col-span-12 min-w-0 lg:col-span-6 lg:min-h-0 xl:col-span-5"
            innerClassName="flex flex-col p-5 sm:p-7 lg:overflow-y-auto lg:px-8 lg:py-4"
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
                {!isLogin && (
                  <>
                    <fieldset aria-describedby="join-account-type-hint">
                      <legend className="mb-1.5 text-sm font-semibold">
                        {t('auth.accountType')}
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {accountOptions.map((option) => (
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
                      <Field id="join-name" label={t('auth.displayName')} error={fieldErrors.name}>
                        <Input
                          id="join-name"
                          data-field="name"
                          icon={UserRound}
                          autoComplete="name"
                          value={form.name}
                          onChange={(event) => update('name', event.target.value)}
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
                    onChange={(event) => update('password', event.target.value)}
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
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </IconButton>
                    }
                  />
                </Field>

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
                      onChange={(value) => update('terms', value)}
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
                {notice && (
                  <p
                    role="status"
                    className="flex items-start gap-2.5 rounded-2xl border border-hairline bg-brand-soft px-4 py-2.5 text-sm leading-5 text-ink"
                  >
                    <Info size={17} className="mt-0.5 shrink-0 text-brand-strong" />
                    {notice}
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
              </form>

              {isLogin && (
                <p className="mt-4 text-center text-xs leading-5 text-muted">
                  Tài khoản phát triển được tạo an toàn bằng lệnh seed của backend.
                </p>
              )}
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
        title={AUTHOR_AGREEMENT_TITLE}
        onClose={() => setAgreementOpen(false)}
      >
        <AuthorAgreementChecklist form={form} update={update} error={fieldErrors.author} />
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={() => setAgreementOpen(false)}>
            Xong
          </Button>
        </div>
      </Modal>
      <Modal
        open={Boolean(legalDocument)}
        title={t(legalDocument === 'privacy' ? 'legal.privacyTitle' : 'legal.termsTitle')}
        onClose={() => setLegalDocument(null)}
        className="max-w-3xl sm:p-8"
      >
        {legalDocument && <LegalContent type={legalDocument} compact />}
      </Modal>
    </div>
  );
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
        onChange={(event) => update('email', event.target.value)}
        placeholder="ten@email.com"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy('email')}
        className={error ? 'border-rose!' : undefined}
      />
    </Field>
  );
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
  );
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
  );
}

function AccountOption({ option, selected, onSelect, t }) {
  const Icon = option.icon;
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
  );
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
  );
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p
      id={id}
      className="mt-1.5 flex items-start gap-1.5 pl-4 text-xs font-medium text-rose-strong"
    >
      <AlertTriangle size={13} className="mt-px shrink-0" />
      {message}
    </p>
  );
}

function LegalLink({ onOpen, children }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        onOpen();
      }}
      className="rounded-sm font-semibold text-brand-strong underline-offset-4 hover:underline"
    >
      {children}
    </button>
  );
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
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

function AuthorAgreementTrigger({ form, error, describedBy, onOpen }) {
  const done = authorAgreementItems.filter(([key]) => form[key]).length;
  const complete = done === authorAgreementItems.length;
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
  );
}

function AuthorAgreementChecklist({ form, update, error }) {
  return (
    <fieldset>
      <legend className="sr-only">{AUTHOR_AGREEMENT_TITLE}</legend>
      <p className="flex items-center gap-2.5 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-3 text-sm text-ink">
        <ShieldCheck size={17} className="shrink-0 text-brand-strong" />
        Tỷ lệ chia sẻ mô phỏng: 80% tác giả / 20% NovelHub
      </p>
      <div className="mt-4 grid gap-2.5">
        {authorAgreementItems.map(([key, label]) => (
          <AgreementCheck
            key={key}
            label={`Tôi đồng ý với ${label}.`}
            checked={form[key]}
            invalid={Boolean(error) && !form[key]}
            onChange={(value) => update(key, value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

