import { useState } from 'react'
import { Flag, RotateCcw, UserPlus } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'

const REASON_MIN = 5
const REASON_MAX = 2000
const DESTRUCTIVE = new Set(['hide-comment', 'unpublish-chapter', 'unpublish-story'])
const targetTypes = ['all', 'story', 'chapter', 'comment']
const fieldClass =
  'w-full rounded-2xl border border-line bg-surface p-3 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm'

const errorKeys = {
  claimed: 'reportsQueue.errors.claimed',
  claim_required: 'reportsQueue.errors.claimRequired',
  report_changed: 'reportsQueue.errors.conflict',
  invalid_action: 'reportsQueue.errors.actionNotAllowed',
  forbidden: 'reportsQueue.errors.forbidden',
  account_changed: 'reportsQueue.errors.forbidden',
}
const errorKey = failure =>
  Object.hasOwn(errorKeys, failure?.code)
    ? errorKeys[failure.code]
    : failure?.status === 409
      ? 'reportsQueue.errors.conflict'
      : 'reportsQueue.errors.saveFailed'

export function ReportsQueuePage() {
  const { t } = useLocale()
  const [status, setStatus] = useState('open')
  const [targetType, setTargetType] = useState('all')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState(null)
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)
  const query =
    '/moderator/reports?status=' +
    status +
    (targetType === 'all' ? '' : '&targetType=' + targetType) +
    '&page=' +
    page
  const resource = useBackendDocument(query, null)
  const data = resource.status === 'ready' ? resource.data : null
  const items = data?.items ?? []
  const counts = data?.counts
  const pageCount = data ? Math.max(1, Math.ceil((data.total ?? 0) / (data.pageSize || 20))) : 1

  const runSimple = async (report, kind) => {
    setNotice(null)
    try {
      await apiRequest('/moderator/reports/' + report.id + '/' + kind, {
        method: 'POST',
        body: { expectedVersion: report.version },
      })
      setNotice({ tone: 'ok', text: t('reportsQueue.notice.' + kind) })
    } catch (failure) {
      setNotice({ tone: 'error', text: t(errorKey(failure)) })
    }
    resource.retry()
  }

  const openResolve = report => {
    setNotice(null)
    setError('')
    setReason('')
    setConfirming(false)
    setAction(report.allowedActions?.[0] ?? '')
    setPending(report)
  }
  const close = () => {
    if (saving) return
    setPending(null)
    setError('')
  }
  const trimmed = reason.trim()
  const reasonValid = trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX
  const submit = async event => {
    event.preventDefault()
    if (!pending || saving || !action || !reasonValid) return
    if (DESTRUCTIVE.has(action) && !confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiRequest('/moderator/reports/' + pending.id + '/resolve', {
        method: 'POST',
        body: { action, reason: trimmed, expectedVersion: pending.version },
      })
      setPending(null)
      setNotice({ tone: 'ok', text: t('reportsQueue.notice.resolved') })
      resource.retry()
    } catch (failure) {
      setConfirming(false)
      setError(t(errorKey(failure)))
      if (failure?.status === 409) resource.retry()
    } finally {
      setSaving(false)
    }
  }

  const tabLabel = key =>
    t('reportsQueue.tabs.' + key) + (counts ? ' (' + (counts[key] ?? 0) + ')' : '')

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t('reportsQueue.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {t('reportsQueue.description')}
            </p>
          </div>
          <Button variant="secondary" onClick={resource.retry}>
            <RotateCcw size={15} />
            {t('reportsQueue.reload')}
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            label={t('reportsQueue.title')}
            value={status}
            onChange={value => {
              setStatus(value)
              setPage(1)
            }}
            items={['open', 'mine', 'resolved'].map(key => ({ value: key, label: tabLabel(key) }))}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted" htmlFor="report-target-type">
              {t('reportsQueue.filterLabel')}
            </label>
            <Select
              id="report-target-type"
              value={targetType}
              onChange={event => {
                setTargetType(event.target.value)
                setPage(1)
              }}
            >
              {targetTypes.map(key => (
                <option key={key} value={key}>
                  {t('reportsQueue.targetTypes.' + key)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={
              'mt-4 text-sm ' + (notice.tone === 'error' ? 'text-rose-strong' : 'text-brand-strong')
            }
          >
            {notice.text}
          </p>
        )}

        <div className="mt-4">
          {resource.status === 'loading' ? (
            <Card aria-busy="true" className="space-y-3 p-5">
              <p role="status" className="text-sm text-muted">
                {t('reportsQueue.loading')}
              </p>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-2xl" />
              ))}
            </Card>
          ) : resource.status === 'error' ? (
            <EmptyState
              tone="rose"
              icon={RotateCcw}
              title={t('reportsQueue.error')}
              action={
                <Button variant="secondary" onClick={resource.retry}>
                  {t('reportsQueue.reload')}
                </Button>
              }
            />
          ) : !items.length ? (
            <EmptyState icon={Flag} title={t('reportsQueue.empty')} />
          ) : (
            <ul className="space-y-3">
              {items.map(report => (
                <ReportRow
                  key={report.id}
                  report={report}
                  onClaim={() => runSimple(report, 'claim')}
                  onRelease={() => runSimple(report, 'release')}
                  onResolve={() => openResolve(report)}
                />
              ))}
            </ul>
          )}
        </div>

        {data && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
      </div>

      <Modal open={Boolean(pending)} title={t('reportsQueue.resolve.title')} onClose={close}>
        {pending && (
          <form onSubmit={submit} noValidate>
            <p className="font-semibold">{targetTitle(pending, t)}</p>
            <p className="mt-1 text-sm text-muted">{t('reportsQueue.reasons.' + pending.reason)}</p>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">{t('reportsQueue.resolve.action')}</legend>
              <div className="mt-2 space-y-2">
                {(pending.allowedActions ?? []).map(value => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="report-action"
                      value={value}
                      checked={action === value}
                      onChange={() => {
                        setAction(value)
                        setConfirming(false)
                      }}
                    />
                    {t('reportsQueue.actions.' + value)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="mt-4 block text-sm font-semibold" htmlFor="report-resolution-reason">
              {t('reportsQueue.resolve.reason')}
            </label>
            <textarea
              id="report-resolution-reason"
              className={fieldClass + ' mt-2'}
              rows={4}
              maxLength={REASON_MAX}
              value={reason}
              aria-describedby="report-resolution-counter"
              onChange={event => {
                setReason(event.target.value)
                setConfirming(false)
              }}
            />
            <p id="report-resolution-counter" className="mt-1 text-caption text-muted">
              {t('reportsQueue.resolve.counter', {
                count: trimmed.length,
                min: REASON_MIN,
                max: REASON_MAX,
              })}
            </p>
            {confirming && (
              <p role="alert" className="mt-3 text-sm text-orange-strong">
                {t('reportsQueue.resolve.confirmDestructive')}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-strong">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={saving} onClick={close}>
                {t('reportsQueue.resolve.cancel')}
              </Button>
              <Button type="submit" disabled={saving || !action || !reasonValid}>
                {t(
                  saving
                    ? 'reportsQueue.resolve.saving'
                    : confirming
                      ? 'reportsQueue.resolve.confirm'
                      : 'reportsQueue.resolve.submit',
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </ModeratorLayout>
  )
}

function targetTitle(report, t) {
  return (
    report.target?.title ||
    report.snapshot?.title ||
    t('reportsQueue.targetTypes.' + report.targetType)
  )
}

function ReportRow({ report, onClaim, onRelease, onResolve }) {
  const { t, formatDate } = useLocale()
  const { snapshot = {}, target = {}, claim, resolution } = report
  const excerpt = snapshot.body || snapshot.excerpt || snapshot.description
  const link =
    target.available && target.storyId
      ? report.targetType === 'story' || !target.chapterId
        ? ROUTES.story(target.storyId)
        : ROUTES.read(target.storyId, target.chapterId)
      : null
  const resolved = Boolean(resolution)
  return (
    <li>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t('reportsQueue.targetTypes.' + report.targetType)}</Badge>
          <Badge tone="orange">{t('reportsQueue.reasons.' + report.reason)}</Badge>
          <Badge tone={target.available ? 'green' : 'neutral'}>
            {target.available ? t('reportsQueue.available') : t('reportsQueue.unavailable')}
          </Badge>
          {target.currentStatus && (
            <span className="text-caption text-muted">
              {t('reportsQueue.currentStatus', { status: target.currentStatus })}
            </span>
          )}
          {report.sameTargetOpen > 0 && (
            <Badge tone="red">
              {t('reportsQueue.sameTarget', { count: report.sameTargetOpen })}
            </Badge>
          )}
        </div>
        <p className="mt-3 break-words font-semibold">{targetTitle(report, t)}</p>
        {target.authorName && (
          <p className="text-caption text-muted">
            {t('reportsQueue.author', { name: target.authorName })}
          </p>
        )}
        {excerpt && (
          <blockquote className="mt-2 line-clamp-4 whitespace-pre-line break-words border-l-2 border-line pl-3 text-sm text-muted">
            {excerpt}
          </blockquote>
        )}
        {report.details && (
          <p className="mt-2 break-words text-sm">
            <span className="font-medium">{t('reportsQueue.details')}: </span>
            {report.details}
          </p>
        )}
        <p className="mt-2 text-caption text-muted">
          {t('reportsQueue.submitted', {
            name: report.reporter?.displayName ?? '—',
            date: formatDate(report.submittedAt),
          })}
        </p>
        {claim && !resolved && (
          <p className="mt-1 text-caption text-muted">
            {claim.mine
              ? t('reportsQueue.claimMine', { date: formatDate(claim.expiresAt) })
              : t('reportsQueue.claimOther', {
                  name: claim.owner,
                  date: formatDate(claim.expiresAt),
                })}
          </p>
        )}
        {resolved && (
          <div className="mt-3 rounded-2xl border border-hairline p-3 text-sm">
            <p className="font-medium">
              {t('reportsQueue.outcomes.' + resolution.outcome)}
              {resolution.contentAction &&
                resolution.contentAction !== 'none' &&
                ' · ' + t('reportsQueue.actions.' + resolution.contentAction)}
            </p>
            <p className="mt-1 break-words">{resolution.reason}</p>
            <p className="mt-1 text-caption text-muted">
              {t('reportsQueue.resolvedBy', {
                name: resolution.moderator ?? '—',
                date: formatDate(resolution.resolvedAt),
              })}
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {link && (
            <ButtonLink to={link} size="sm" variant="secondary">
              {t('reportsQueue.viewTarget')}
            </ButtonLink>
          )}
          {!resolved && !claim && (
            <Button size="sm" onClick={onClaim}>
              <UserPlus size={15} />
              {t('reportsQueue.claim')}
            </Button>
          )}
          {!resolved && claim?.mine && (
            <>
              <Button size="sm" onClick={onResolve}>
                {t('reportsQueue.resolveAction')}
              </Button>
              <Button size="sm" variant="outline" onClick={onRelease}>
                {t('reportsQueue.release')}
              </Button>
            </>
          )}
        </div>
      </Card>
    </li>
  )
}
