import { useEffect, useId, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card, Modal, Select, SkeletonText } from '../ui'

export function AuthorApplications() {
  const { t } = useLocale()
  const fieldId = useId()
  const [status, setStatus] = useState('submitted')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [feed, setFeed] = useState({ state: 'loading', items: [], total: 0 })
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState('approve')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const pageSize = 10

  useEffect(() => {
    const controller = new AbortController()
    apiRequest(`/admin/author-applications?${new URLSearchParams({ status, page, pageSize })}`, {
      signal: controller.signal,
    })
      .then(result => {
        if (!controller.signal.aborted) setFeed({ state: 'ready', ...result })
      })
      .catch(failure => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted) {
          setFeed({ state: 'error', items: [], total: 0 })
        }
      })
    return () => controller.abort()
  }, [status, page, refresh])

  const reload = () => {
    setFeed({ state: 'loading', items: [], total: 0 })
    setRefresh(value => value + 1)
  }
  const inspect = async application => {
    setSelected(application)
    setReason('')
    setDecision('approve')
    setError('')
    setNotice('')
  }
  const confirm = async event => {
    event.preventDefault()
    if (saving || !reason.trim() || selected?.status !== 'submitted') return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/admin/author-applications/${selected.id}/decision`, {
        method: 'POST',
        body: { decision, reason: reason.trim(), expectedVersion: selected.version },
      })
      setSelected(null)
      setNotice(t('authorAccess.decisionSaved'))
      reload()
    } catch (failure) {
      setError(
        t(
          failure.code === 'application_changed' || failure.code === 'account_changed'
            ? 'authorAccess.changed'
            : failure.code === 'staff_role_conflict' || failure.code === 'applicant_ineligible'
              ? 'authorAccess.ineligible'
              : 'authorAccess.saveFailed',
        ),
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card className="mt-6" aria-labelledby={`${fieldId}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id={`${fieldId}-title`} className="text-h3">
            {t('authorAccess.title')}
          </h2>
          <p className="mt-1 text-caption text-muted">{t('authorAccess.description')}</p>
        </div>
        <Button variant="secondary" onClick={reload}>
          {t('authorAccess.refresh')}
        </Button>
      </div>
      <div className="mt-4 max-w-xs">
        <label htmlFor={`${fieldId}-filter`} className="mb-2 block text-sm font-medium">
          {t('authorAccess.filter')}
        </label>
        <Select
          id={`${fieldId}-filter`}
          value={status}
          onChange={event => {
            setStatus(event.target.value)
            setPage(1)
            setFeed({ state: 'loading', items: [], total: 0 })
          }}
        >
          {['submitted', 'approved', 'rejected', 'all'].map(value => (
            <option key={value} value={value}>
              {t(`authorAccess.${value}`)}
            </option>
          ))}
        </Select>
      </div>
      {notice && (
        <p role="status" className="mt-4 text-sm text-brand-strong">
          {notice}
        </p>
      )}
      {feed.state === 'loading' ? (
        <div role="status" className="mt-5">
          <span className="sr-only">{t('authorAccess.loading')}</span>
          <SkeletonText lines={3} />
        </div>
      ) : feed.state === 'error' ? (
        <p role="alert" className="mt-5 text-sm text-rose-strong">
          {t('authorAccess.loadFailed')}
        </p>
      ) : feed.items.length === 0 ? (
        <p className="mt-5 text-sm text-muted">{t('authorAccess.empty')}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                {['applicant', 'submittedAt', 'status', 'action'].map(key => (
                  <th key={key} className="px-3 py-3 font-semibold">
                    {t(`authorAccess.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {feed.items.map(application => (
                <tr key={application.id} className="border-b border-hairline">
                  <td className="px-3 py-3">
                    <p className="font-medium">
                      {application.applicant?.name || t('authorAccess.missingAccount')}
                    </p>
                    <p className="text-caption text-muted">{application.applicant?.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    {new Date(application.submittedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-3 py-3">{t(`authorAccess.${application.status}`)}</td>
                  <td className="px-3 py-3">
                    <Button size="sm" variant="secondary" onClick={() => inspect(application)}>
                      {t('authorAccess.review')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {feed.state === 'ready' && feed.total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-muted">
            {t('authorAccess.page', { page, total: Math.ceil(feed.total / pageSize) })}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page === 1}
              onClick={() => {
                setPage(page - 1)
                setFeed({ state: 'loading', items: [], total: 0 })
              }}
            >
              {t('authorAccess.previous')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page * pageSize >= feed.total}
              onClick={() => {
                setPage(page + 1)
                setFeed({ state: 'loading', items: [], total: 0 })
              }}
            >
              {t('authorAccess.next')}
            </Button>
          </div>
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        title={t('authorAccess.reviewTitle')}
        onClose={() => {
          if (!saving) setSelected(null)
        }}
      >
        {selected && (
          <form onSubmit={confirm}>
            <p className="font-semibold">{selected.applicant?.name}</p>
            <p className="mt-1 text-sm text-muted">{selected.applicant?.email}</p>
            <p className="mt-3 text-sm">{t(`authorAccess.${selected.status}`)}</p>
            {selected.status === 'submitted' ? (
              <>
                <label
                  htmlFor={`${fieldId}-decision`}
                  className="mb-2 mt-5 block text-sm font-medium"
                >
                  {t('authorAccess.decision')}
                </label>
                <Select
                  id={`${fieldId}-decision`}
                  disabled={saving}
                  value={decision}
                  onChange={event => setDecision(event.target.value)}
                >
                  {['approve', 'reject'].map(value => (
                    <option key={value} value={value}>
                      {t(`authorAccess.${value}`)}
                    </option>
                  ))}
                </Select>
                <label
                  htmlFor={`${fieldId}-reason`}
                  className="mb-2 mt-4 block text-sm font-medium"
                >
                  {t('authorAccess.reason')}
                </label>
                <textarea
                  id={`${fieldId}-reason`}
                  value={reason}
                  required
                  maxLength={1000}
                  disabled={saving}
                  onChange={event => setReason(event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink"
                />
                <p className="mt-2 text-caption text-muted">{t('authorAccess.confirmHint')}</p>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-rose-strong">
                    {error}
                  </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => setSelected(null)}
                  >
                    {t('authorAccess.cancel')}
                  </Button>
                  <Button type="submit" disabled={saving || !reason.trim()}>
                    {t(saving ? 'authorAccess.saving' : 'authorAccess.confirm')}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-4 whitespace-pre-wrap text-sm">{selected.decisionReason}</p>
            )}
          </form>
        )}
      </Modal>
    </Card>
  )
}
