import { useId, useState } from 'react'
import { Button, ButtonLink, Modal } from '../ui'
import { CheckCircle2, Info } from '../icons'
import { reportContent } from '../../api/community'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { useReturnPath } from './useLoginRedirect'

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'copyright', 'spoiler', 'other']
const DETAILS_MAX = 1000

export function ReportDialog({ open, onClose, targetType, targetId }) {
  const { t } = useLocale()
  return (
    <Modal open={open} onClose={onClose} title={t(`community.report.title.${targetType}`)}>
      {/* Modal unmounts its children when closed, so each opening starts from a clean form. */}
      <ReportForm
        key={`${targetType}:${targetId}`}
        targetType={targetType}
        targetId={targetId}
        onClose={onClose}
      />
    </Modal>
  )
}

function ReportForm({ targetType, targetId, onClose }) {
  const { isAuthenticated } = useAuth()
  const { t } = useLocale()
  const returnPath = useReturnPath()
  const formId = useId()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  if (!isAuthenticated)
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{t('community.report.signIn')}</p>
        <ButtonLink to={ROUTES.login} state={{ from: returnPath }}>
          {t('community.signIn')}
        </ButtonLink>
      </div>
    )

  if (result)
    return (
      <div className="space-y-5">
        <p role="status" className="flex items-start gap-3 text-sm leading-6 text-ink">
          {result === 'sent' ? (
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-strong" />
          ) : (
            <Info size={20} className="mt-0.5 shrink-0 text-orange-strong" />
          )}
          {t(result === 'sent' ? 'community.report.success' : 'community.report.already')}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('community.report.close')}</Button>
        </div>
      </div>
    )

  const submit = async event => {
    event.preventDefault()
    if (busy) return
    if (!reason) {
      setError(t('community.report.chooseReason'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await reportContent({ targetType, targetId, reason, details: details.trim() || undefined })
      setResult('sent')
    } catch (requestError) {
      if (requestError.code === 'already_reported') setResult('already')
      else setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">
          {t('community.report.reasonLegend')}
        </legend>
        <div className="mt-3 grid gap-2">
          {REPORT_REASONS.map(value => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-sm text-ink transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
            >
              <input
                type="radio"
                name={`${formId}-reason`}
                value={value}
                checked={reason === value}
                onChange={() => {
                  setReason(value)
                  setError('')
                }}
                className="size-4 accent-[var(--primary)]"
              />
              {t(`community.report.reasons.${value}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${formId}-details`} className="text-sm font-semibold text-ink">
          {t('community.report.details')}
        </label>
        <textarea
          id={`${formId}-details`}
          aria-describedby={`${formId}-details-count`}
          value={details}
          onChange={event => setDetails(event.target.value)}
          maxLength={DETAILS_MAX}
          rows={3}
          className="mt-2 w-full resize-y rounded-2xl border border-line bg-surface p-3 text-base leading-6 text-ink sm:text-sm"
        />
        <p id={`${formId}-details-count`} className="mt-1 text-right text-xs text-muted">
          {t('community.counter', { count: details.length, max: DETAILS_MAX })}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-strong">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('community.cancel')}
        </Button>
        <Button type="submit" variant="danger" disabled={busy}>
          {busy ? t('community.saving') : t('community.report.submit')}
        </Button>
      </div>
    </form>
  )
}
