import { useEffect, useState } from 'react'
import { apiRequest } from '../../api/client'
import { authorAgreements } from '../../content/authorAgreements'
import { ROUTES } from '../../app/routes'
import { LegalContent } from '../system/LegalPage'
import { useLocale } from '../../context/LocaleContext'
import { ArrowRight, Check, Feather, ShieldCheck } from '../../components/icons'
import { AuthShowcase } from '../../components/auth/AuthShowcase'
import { PublicHeader } from '../../components/public/PublicHeader'
import { Button, ButtonLink, Card, Modal } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

export function AuthorApplyPage() {
  const { t } = useLocale()
  const labels = authorAgreements.map(({ title }) => t('legal.author.agree', { title: t(title) }))
  const [legalDocument, setLegalDocument] = useState(null)
  const [applicationState, setApplicationState] = useState('loading')
  const [decisionReason, setDecisionReason] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState('')
  const [checks, setChecks] = useState(() => labels.map(() => false))
  const { applyForAuthor, currentUser } = useAuth()
  const [submission, setSubmission] = useState({ status: 'idle', message: '' })
  const confirmed = checks.filter(Boolean).length
  const ready = confirmed === labels.length
  const alreadyAuthor = currentUser?.roles?.includes('author')

  useEffect(() => {
    const controller = new AbortController()
    apiRequest('/auth/author-application', { signal: controller.signal })
      .then(({ application, access }) => {
        if (controller.signal.aborted) return
        setApplicationState(
          application?.status === 'approved' &&
            access?.canApply === true &&
            access?.activeAuthor === false
            ? 'revoked'
            : application?.status || 'none',
        )
        setDecisionReason(application?.decisionReason || '')
        setSubmission({ status: 'idle', message: '' })
        setCheckedAt(new Date().toLocaleTimeString('vi-VN'))
      })
      .catch(error => {
        if (error.name === 'AbortError' || controller.signal.aborted) return
        if (error.status === 401) setApplicationState('expired')
        else if (refresh > 0)
          setSubmission({ status: 'error', message: t('authorAccess.statusFailed') })
        else setApplicationState('unavailable')
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false)
      })
    return () => controller.abort()
  }, [refresh, t])

  const finish = async event => {
    event.preventDefault()
    if (!ready) return
    setSubmission({ status: 'submitting', message: '' })
    try {
      await applyForAuthor()
      setApplicationState('submitted')
      setSubmission({
        status: 'submitted',
        message:
          'Đơn đăng ký đã được gửi. Quyền Tác giả chỉ được kích hoạt sau khi Admin phê duyệt.',
      })
    } catch (error) {
      setSubmission({ status: 'error', message: error.message })
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <PublicHeader />
      {/*
        Same 12-column split as /login: lg 6/6 so the 2×2 agreement grid keeps readable cells,
        xl+ visual 7 / form 5. At lg+ the grid fills the viewport below the 76px header island.
      */}
      <main className="w-full flex-1 px-3 pb-8 pt-3 sm:px-4 md:px-6 lg:px-10 lg:pb-3">
        <div className="mx-auto grid max-w-[1360px] grid-cols-12 gap-4 md:gap-6 lg:h-[calc(100dvh-6.25rem)] lg:min-h-[34rem] xl:gap-8">
          <Card
            bezel
            aria-labelledby="author-apply-title"
            className="col-span-12 min-w-0 lg:col-span-6 lg:min-h-0 xl:col-span-5"
            innerClassName="flex flex-col p-5 sm:p-7 lg:overflow-y-auto lg:px-8 lg:py-4"
          >
            <div className="mx-auto my-auto w-full max-w-[30rem]">
              <header className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-on-brand lg:[@media(max-height:820px)]:hidden shadow-[0_10px_24px_-14px_var(--primary)]">
                  <Feather size={22} />
                </span>
                <div className="min-w-0">
                  <h1 id="author-apply-title" className="text-h2">
                    Trở thành tác giả NovelHub
                  </h1>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Tài khoản{' '}
                    <span className="font-semibold text-ink [overflow-wrap:anywhere]">
                      {currentUser?.email}
                    </span>{' '}
                    hiện tại vẫn giữ mọi tính năng Độc giả và được bổ sung công cụ xuất bản.
                  </p>
                </div>
              </header>

              {alreadyAuthor ? (
                <div className="mt-6 rounded-3xl border border-hairline bg-brand-soft p-6 text-center sm:p-8">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface text-brand-strong shadow-whisper">
                    <ShieldCheck size={22} />
                  </span>
                  <h2 className="mt-4 text-h3">Quyền Tác giả đã được kích hoạt</h2>
                  <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-6 text-ink/70">
                    Bạn có thể quản lý truyện, chương và bản nháp trong Studio tác giả.
                  </p>
                  <ButtonLink to="/author" trailingIcon={ArrowRight} className="mt-6">
                    Mở Studio tác giả
                  </ButtonLink>
                </div>
              ) : applicationState === 'expired' ? (
                <div className="mt-6" role="status">
                  <p>{t('authorAccess.signInAgain')}</p>
                  <ButtonLink to={ROUTES.login} className="mt-4">
                    {t('auth.logIn')}
                  </ButtonLink>
                </div>
              ) : applicationState === 'submitted' || applicationState === 'approved' ? (
                <div
                  role="status"
                  className="mt-6 rounded-2xl border border-brand/25 bg-brand-soft p-5"
                >
                  <h2 className="text-h3">
                    {t(
                      applicationState === 'approved'
                        ? 'legal.author.applicationApprovedTitle'
                        : 'legal.author.applicationPendingTitle',
                    )}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {t(
                      applicationState === 'approved'
                        ? 'legal.author.applicationApprovedBody'
                        : 'legal.author.applicationPendingBody',
                    )}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-4 mr-2"
                    disabled={checking}
                    aria-busy={checking}
                    onClick={() => {
                      setChecking(true)
                      setSubmission({ status: 'idle', message: '' })
                      setRefresh(value => value + 1)
                    }}
                  >
                    {t(checking ? 'authorAccess.checking' : 'authorAccess.refresh')}
                  </Button>
                  <ButtonLink to={ROUTES.library} variant="secondary" className="mt-4">
                    {t('navigation.library')}
                  </ButtonLink>
                  {refresh > 0 && !checking && submission.status !== 'error' && (
                    <p role="status" className="mt-3 text-sm text-muted">
                      {t('authorAccess.statusChecked', { time: checkedAt })}
                    </p>
                  )}
                  {submission.status === 'error' && (
                    <p role="alert" className="mt-3 text-sm text-rose-strong">
                      {submission.message}
                    </p>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={finish}
                  className="mt-5 border-t border-hairline pt-5 lg:[@media(max-height:820px)]:mt-4 lg:[@media(max-height:820px)]:pt-4"
                >
                  {applicationState === 'revoked' && (
                    <p
                      role="status"
                      className="mb-4 rounded-2xl bg-brand-soft p-3 text-sm text-ink"
                    >
                      {t('authorAccess.reapplyAfterRevocation')}
                    </p>
                  )}
                  {applicationState === 'rejected' && (
                    <p
                      role="status"
                      className="mb-4 rounded-2xl bg-rose/10 p-3 text-sm text-rose-strong"
                    >
                      {t('legal.author.applicationRejected')}
                      {decisionReason && (
                        <span className="mt-2 block whitespace-pre-wrap">{decisionReason}</span>
                      )}
                    </p>
                  )}
                  {applicationState === 'unavailable' && (
                    <div className="mb-4">
                      <p role="alert" className="text-sm text-rose-strong">
                        {t('legal.author.applicationLoadError')}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => {
                          setApplicationState('loading')
                          setRefresh(value => value + 1)
                        }}
                      >
                        {t('authorAccess.refresh')}
                      </Button>
                    </div>
                  )}
                  {applicationState === 'loading' && (
                    <p role="status" className="mb-4 text-sm text-muted">
                      {t('legal.author.applicationLoading')}
                    </p>
                  )}
                  <h2 className="text-h3">Thỏa thuận tác giả</h2>
                  <p className="mt-1 text-sm leading-5 text-muted">
                    Truyện phải được gửi cho Kiểm duyệt viên xét duyệt trước khi xuất bản. Việc phê
                    duyệt không bao giờ diễn ra tự động.
                  </p>

                  <div className="mt-4 rounded-3xl border border-hairline bg-elevated px-4 py-3 lg:[@media(max-height:820px)]:mt-3 lg:[@media(max-height:820px)]:py-2">
                    <p className="text-sm text-muted">{t('authorAccess.revenuePolicy')}</p>
                  </div>

                  <fieldset className="mt-4 lg:[@media(max-height:820px)]:mt-3">
                    <legend className="flex w-full items-center justify-between gap-3 text-sm font-semibold">
                      Xác nhận điều khoản
                      <span
                        className="text-xs font-medium text-muted tabular-nums"
                        aria-live="polite"
                      >
                        {confirmed}/{labels.length} đã xác nhận
                      </span>
                    </legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {labels.map((label, index) => (
                        <div key={authorAgreements[index].type} className="min-w-0">
                          <label
                            className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-sm leading-5 lg:[@media(max-height:820px)]:py-2 transition-[background-color,border-color] duration-200 ${
                              checks[index]
                                ? 'border-brand/50 bg-brand-soft'
                                : 'border-line bg-surface hover:border-brand/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
                              checked={checks[index]}
                              onChange={event =>
                                setChecks(values =>
                                  values.map((value, i) =>
                                    i === index ? event.target.checked : value,
                                  ),
                                )
                              }
                            />
                            <span className="min-w-0 flex-1">{label}</span>
                            {checks[index] && (
                              <Check
                                size={15}
                                aria-hidden="true"
                                className="mt-0.5 shrink-0 text-brand-strong"
                              />
                            )}
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-1 w-full text-brand-strong"
                            onClick={() => setLegalDocument(authorAgreements[index].type)}
                          >
                            {t('legal.author.readModal')}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={
                      !ready ||
                      applicationState === 'loading' ||
                      applicationState === 'unavailable' ||
                      submission.status === 'submitting' ||
                      submission.status === 'submitted'
                    }
                    trailingIcon={ArrowRight}
                    className="mt-4 w-full lg:[@media(max-height:820px)]:mt-3"
                  >
                    {submission.status === 'submitting'
                      ? 'Đang gửi đơn...'
                      : submission.status === 'submitted'
                        ? 'Đã gửi đơn đăng ký'
                        : 'Gửi đơn đăng ký Tác giả'}
                  </Button>
                  <p className="mt-2 min-h-4 text-center text-xs leading-4 text-muted">
                    {submission.message ||
                      (ready
                        ? 'Đã sẵn sàng gửi đơn để Admin xét duyệt.'
                        : `Xác nhận đủ ${labels.length} mục để gửi đơn.`)}
                  </p>
                </form>
              )}
            </div>
          </Card>

          <AuthShowcase
            variant="author"
            authorName={currentUser?.name}
            className="col-span-12 lg:order-first lg:col-span-6 xl:col-span-7"
          />
        </div>
      </main>
      <Modal
        open={Boolean(legalDocument)}
        title={t(
          authorAgreements.find(({ type }) => type === legalDocument)?.title ||
            'legal.author.agreementTitle',
        )}
        onClose={() => setLegalDocument(null)}
        className="max-w-none lg:w-2/3"
      >
        {legalDocument && <LegalContent type={legalDocument} compact />}
        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-line pt-4">
          {legalDocument && (
            <ButtonLink
              to={ROUTES.authorAgreement(legalDocument)}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
            >
              {t('legal.author.openPage')}
            </ButtonLink>
          )}
          <Button type="button" onClick={() => setLegalDocument(null)}>
            {t('legal.author.done')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
