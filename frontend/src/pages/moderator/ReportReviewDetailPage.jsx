import { useId, useState } from 'react'
import { useParams } from 'react-router'
import { ArrowLeft, Gavel, RotateCcw, UserPlus } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, ButtonLink, Card, Modal, Skeleton } from '../../components/ui'

const REASON_MIN = 5
const REASON_MAX = 2000
// Hide Comment, Unpublish Chapter and Unpublish Story need a second confirmation (UC-MOD-06 step 3).
const RESTRICTING = new Set(['hide-comment', 'unpublish-chapter', 'unpublish-story'])
const errorKeys = {
  claim_conflict: 'reportReview.errors.claimConflict',
  claim_not_held: 'reportReview.errors.claimNotHeld',
  report_changed: 'reportReview.errors.changed',
  forbidden: 'reportReview.errors.forbidden',
  validation_error: 'reportReview.errors.validation',
  not_found: 'reportReview.notFound',
}
const errorKey = failure =>
  Object.hasOwn(errorKeys, failure?.code) ? errorKeys[failure.code] : 'reportReview.errors.failed'
const fieldClass =
  'w-full rounded-2xl border border-line bg-surface p-3 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm'

/** UC-MOD-05 and UC-MOD-06: review a content report, claim or release it, and resolve it. */
export function ReportReviewDetailPage() {
  const { reportId } = useParams()
  const { t, formatDateTime } = useLocale()
  const resource = useBackendDocument('/moderator/reports/' + reportId, null)
  const data = resource.status === 'ready' ? resource.data : null
  // A live claim from before claim tokens must be resumed (claim mutation) before acting on it.
  const holding = data?.claimState === 'mine' && !data.claimResumeRequired
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const run = async (path, body, onDone) => {
    if (!data || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      onDone(
        await apiRequest('/moderator/reports/' + data.reportId + '/' + path, {
          method: 'POST',
          body,
        }),
      )
      resource.retry()
    } catch (failure) {
      setConfirming(false)
      setError(t(errorKey(failure)))
      if (failure?.status === 409) resource.retry()
    } finally {
      setBusy(false)
    }
  }
  const claim = () =>
    run('claim', { expectedVersion: data.version }, claimed =>
      setNotice(
        t('reportReview.claimed', {
          dateTime: formatDateTime(claimed.claimExpiresAt),
          timeZone: t('reportReview.timeZone'),
        }),
      ),
    )
  const release = () =>
    run('release', { expectedVersion: data.version, claimToken: data.claimToken }, () =>
      setNotice(t('reportReview.released')),
    )
  const trimmed = reason.trim()
  const resolve = () =>
    run(
      'resolution',
      { action, reason: trimmed, expectedVersion: data.version, claimToken: data.claimToken },
      () => {
        setConfirming(false)
        setAction('')
        setReason('')
        setNotice(t('reportReview.resolved'))
      },
    )
  const submit = event => {
    event.preventDefault()
    if (!action || trimmed.length < REASON_MIN || trimmed.length > REASON_MAX || busy) return
    if (RESTRICTING.has(action)) setConfirming(true)
    else resolve()
  }

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <ButtonLink to={ROUTES.moderatorReports} variant="ghost" size="sm">
          <ArrowLeft size={15} />
          {t('reportReview.back')}
        </ButtonLink>
        {notice && (
          <p role="status" className="mt-4 text-sm text-brand-strong">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-strong">
            {error}
          </p>
        )}
        {resource.status === 'loading' ? (
          <div aria-busy="true" className="mt-6 space-y-4">
            <p role="status" className="text-sm text-muted">
              {t('reportReview.loading')}
            </p>
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        ) : !data ? (
          <Card className="mt-6">
            <p role="alert" className="text-sm text-rose-strong">
              {t(resource.status === 'empty' ? 'reportReview.notFound' : 'reportReview.error')}
            </p>
            <Button className="mt-3" variant="secondary" onClick={resource.retry}>
              <RotateCcw size={15} />
              {t('reportReview.reload')}
            </Button>
          </Card>
        ) : (
          <>
            <ReportSummary report={data} />
            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-5">
                {data.resolution && <ResolutionCard resolution={data.resolution} />}
                {holding ? (
                  <>
                    <Comparison report={data} />
                    <EarlierCases report={data} />
                  </>
                ) : (
                  data.status === 'open' && (
                    <Card>
                      <p className="text-sm leading-6 text-muted">
                        {t(
                          data.claimResumeRequired
                            ? 'reportReview.resumeNote'
                            : data.claimState === 'other'
                              ? 'reportReview.claimHeld'
                              : 'reportReview.claimToView',
                        )}
                      </p>
                    </Card>
                  )
                )}
              </div>
              <aside className="space-y-5">
                {data.status === 'open' && (
                  <Card>
                    <div className="grid gap-2">
                      {data.claimState !== 'mine' && data.claimState !== 'other' && (
                        <Button disabled={busy} onClick={claim}>
                          <UserPlus size={15} />
                          {t('reportReview.claim')}
                        </Button>
                      )}
                      {data.claimResumeRequired && (
                        <Button disabled={busy} onClick={claim}>
                          <UserPlus size={15} />
                          {t('reportReview.resume')}
                        </Button>
                      )}
                      {holding && (
                        <Button variant="secondary" disabled={busy} onClick={release}>
                          {t('reportReview.release')}
                        </Button>
                      )}
                    </div>
                  </Card>
                )}
                {holding && (
                  <ResolveForm
                    report={data}
                    action={action}
                    reason={reason}
                    busy={busy}
                    onAction={setAction}
                    onReason={setReason}
                    onSubmit={submit}
                  />
                )}
              </aside>
            </div>
          </>
        )}
      </div>

      <Modal
        open={confirming}
        title={t('reportReview.confirm.title')}
        onClose={() => !busy && setConfirming(false)}
      >
        {confirming && data && (
          <div>
            <p className="text-sm leading-6">
              {t('reportReview.confirm.body', {
                restriction: t('reportReview.restrictions.' + action),
                target: restrictionTarget(data, action, t),
              })}
            </p>
            {action === 'unpublish-story' && (
              <p className="mt-3 text-sm font-medium text-rose-strong">
                {t('reportReview.confirm.storyNote')}
              </p>
            )}
            <p className="mt-3 text-sm text-muted">{t('reportReview.confirm.note')}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                {t('reportReview.confirm.cancel')}
              </Button>
              <Button variant="danger" type="button" disabled={busy} onClick={resolve}>
                {t(busy ? 'reportReview.resolve.saving' : 'reportReview.confirm.confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ModeratorLayout>
  )
}

/**
 * What a restricting action applies to, for its confirmation (UC-MOD-06 step 3): Unpublish Story on
 * a chapter report removes the parent story, so the story is named rather than the chapter.
 */
function restrictionTarget(report, action, t) {
  if (action === 'unpublish-story' && report.targetType === 'chapter' && report.parentStory?.title)
    return report.parentStory.title
  return report.targetTitle || t('reportsQueue.targetTypes.' + report.targetType)
}

function ReportSummary({ report }) {
  const { t, formatDateTime } = useLocale()
  return (
    <header className="mt-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="purple">{t('reportReview.statuses.' + report.status)}</Badge>
        <Badge>{t('reportsQueue.targetTypes.' + report.targetType)}</Badge>
        <Badge tone="orange">{t('reportsQueue.reasons.' + report.reason)}</Badge>
      </div>
      <h1 className="mt-2 break-words text-h2 sm:text-h1">
        {report.targetTitle || t('reportsQueue.targetTypes.' + report.targetType)}
      </h1>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex flex-wrap gap-1.5">
          <dt className="text-muted">{t('reportReview.reporter')}</dt>
          <dd className="font-medium">{report.reporter.displayName}</dd>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <dt className="text-muted">{t('reportReview.reportedAt')}</dt>
          <dd className="font-medium">{formatDateTime(report.reportedAt)}</dd>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:col-span-2">
          <dt className="text-muted">{t('reportReview.claimLabel')}</dt>
          <dd className="font-medium">
            {t('reportsQueue.claimStates.' + report.claimState, {
              dateTime: report.claimExpiresAt ? formatDateTime(report.claimExpiresAt) : '',
            })}
          </dd>
        </div>
      </dl>
      <div className="mt-3 text-sm">
        <p className="text-muted">{t('reportReview.details')}</p>
        <p className="mt-1 whitespace-pre-wrap break-words">
          {report.details || t('reportReview.noDetails')}
        </p>
      </div>
    </header>
  )
}

function targetLink(current) {
  if (!['visible', 'changed'].includes(current.state) || !current.storyId) return null
  return current.chapterId
    ? ROUTES.read(current.storyId, current.chapterId)
    : ROUTES.story(current.storyId)
}

function Comparison({ report }) {
  const { t, formatDateTime } = useLocale()
  const { snapshot, current } = report
  const link = targetLink(current)
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <h2 className="text-h3">{t('reportReview.snapshot')}</h2>
        <p className="mt-1 text-caption text-muted">
          {t('reportReview.capturedAt', { dateTime: formatDateTime(snapshot.capturedAt) })}
        </p>
        {snapshot.title && <p className="mt-3 break-words font-semibold">{snapshot.title}</p>}
        <blockquote className="mt-2 whitespace-pre-line break-words border-l-2 border-line pl-3 text-sm">
          {snapshot.excerpt || t('reportReview.noExcerpt')}
        </blockquote>
        <p className="mt-3 text-caption text-muted">{t('reportReview.snapshotNote')}</p>
      </Card>
      <Card>
        <h2 className="text-h3">{t('reportReview.current')}</h2>
        <Badge
          className="mt-2"
          tone={
            current.state === 'visible' ? 'green' : current.state === 'changed' ? 'orange' : 'red'
          }
        >
          {t('reportReview.currentStates.' + current.state)}
        </Badge>
        {current.title && <p className="mt-3 break-words font-semibold">{current.title}</p>}
        {current.state !== 'deleted' && (
          <blockquote className="mt-2 whitespace-pre-line break-words border-l-2 border-line pl-3 text-sm">
            {current.excerpt || t('reportReview.noExcerpt')}
          </blockquote>
        )}
        {current.ownerName && (
          <p className="mt-3 text-caption text-muted">
            {t('reportReview.owner', { name: current.ownerName })}
          </p>
        )}
        {link && (
          <ButtonLink to={link} size="sm" variant="secondary" className="mt-3">
            {t('reportReview.viewTarget')}
          </ButtonLink>
        )}
      </Card>
    </div>
  )
}

function contentChangedKey(value) {
  return value === true
    ? 'reportReview.contentChanged.yes'
    : value === false
      ? 'reportReview.contentChanged.no'
      : 'reportReview.contentChanged.unknown'
}

function EarlierCases({ report }) {
  const { t, formatDateTime } = useLocale()
  return (
    <Card>
      <h2 className="text-h3">{t('reportReview.earlier')}</h2>
      <p className="mt-1 text-sm text-muted">
        {t('reportReview.openDuplicates', { count: report.openDuplicates })}
      </p>
      {!report.earlierCases.length ? (
        <p className="mt-3 text-sm text-muted">{t('reportReview.earlierEmpty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {report.earlierCases.map(item => (
            <li key={item.reportId} className="border-b border-hairline pb-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="orange">{t('reportsQueue.reasons.' + item.reason)}</Badge>
                <span className="text-muted">{formatDateTime(item.reportedAt)}</span>
                <Badge>{t('reportReview.statuses.' + item.status)}</Badge>
              </div>
              {item.outcome && (
                <p className="mt-1 text-sm">
                  {t('reportReview.outcomes.' + item.outcome)} ·{' '}
                  {t(contentChangedKey(item.contentChanged))} ·{' '}
                  <span className="text-muted">{formatDateTime(item.resolvedAt)}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function ResolutionCard({ resolution }) {
  const { t, formatDateTime } = useLocale()
  return (
    <Card>
      <h2 className="text-h3">{t('reportReview.resolutionTitle')}</h2>
      <p className="mt-3 font-medium">{t('reportReview.outcomes.' + resolution.outcome)}</p>
      <Badge className="mt-2" tone={resolution.contentChanged ? 'orange' : 'neutral'}>
        {t(contentChangedKey(resolution.contentChanged))}
      </Badge>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm">{resolution.reason}</p>
      <p className="mt-2 text-caption text-muted">
        {t('reportReview.resolvedBy', {
          name: resolution.moderator.displayName,
          dateTime: formatDateTime(resolution.resolvedAt),
        })}
      </p>
    </Card>
  )
}

function ResolveForm({ report, action, reason, busy, onAction, onReason, onSubmit }) {
  const { t } = useLocale()
  const fieldId = useId()
  const trimmed = reason.trim()
  const valid = Boolean(action) && trimmed.length >= REASON_MIN && trimmed.length <= REASON_MAX
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <h2 className="text-h3">{t('reportReview.resolve.title')}</h2>
        <fieldset className="mt-3">
          <legend className="text-sm font-semibold">{t('reportReview.resolve.action')}</legend>
          <div className="mt-2 space-y-2">
            {report.allowedActions.map(value => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="report-action"
                  value={value}
                  checked={action === value}
                  disabled={busy}
                  onChange={() => onAction(value)}
                />
                {t('reportReview.actions.' + value)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block text-sm font-semibold" htmlFor={`${fieldId}-reason`}>
          {t('reportReview.resolve.reason')}
        </label>
        <textarea
          id={`${fieldId}-reason`}
          className={fieldClass + ' mt-2'}
          rows={4}
          maxLength={REASON_MAX}
          value={reason}
          disabled={busy}
          aria-describedby={`${fieldId}-counter`}
          onChange={event => onReason(event.target.value)}
        />
        <p id={`${fieldId}-counter`} className="mt-1 text-caption text-muted">
          {t('reportReview.resolve.counter', {
            count: trimmed.length,
            min: REASON_MIN,
            max: REASON_MAX,
          })}
        </p>
        <Button type="submit" className="mt-4 w-full" disabled={busy || !valid}>
          <Gavel size={15} />
          {t(busy ? 'reportReview.resolve.saving' : 'reportReview.resolve.submit')}
        </Button>
      </form>
    </Card>
  )
}
