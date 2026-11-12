import { useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Gavel, RotateCcw } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'

// Outcomes of each case type (UC-MOD-07 step 2); an outcome must match the selected case type.
const CASE_OUTCOMES = {
  publication: ['approved', 'rejected', 'cancelled'],
  report: [
    'dismissed',
    'comment-hidden',
    'chapter-unpublished',
    'story-unpublished',
    'author-warned',
  ],
}
const CANCELLATION_REASONS = ['author-role-removed', 'account-deleted']
const columns = [
  'reviewHistory.time',
  'reviewHistory.moderator',
  'reviewHistory.case',
  'reviewHistory.target',
  'reviewHistory.result',
  'reviewHistory.reason',
  'reviewHistory.action',
]
const outcomeTone = outcome =>
  ({ approved: 'green', rejected: 'red', cancelled: 'neutral', dismissed: 'neutral' })[outcome] ??
  'purple'

function initialFilters(params) {
  const caseType = CASE_OUTCOMES[params.get('caseType')] ? params.get('caseType') : ''
  return {
    scope: params.get('scope') === 'mine' ? 'mine' : 'all',
    caseType,
    outcome: params.get('outcome') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
  }
}

export function ModerationHistoryPage() {
  const { t } = useLocale()
  const fieldId = useId()
  const [params] = useSearchParams()
  const [filters, setFilters] = useState(() => initialFilters(params))
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const update = changes => {
    setFilters(current => ({ ...current, ...changes }))
    setPage(1)
  }
  const query = new URLSearchParams({ scope: filters.scope })
  for (const key of ['caseType', 'outcome', 'from', 'to'])
    if (filters[key]) query.set(key, filters[key])
  query.set('page', String(page))
  const resource = useBackendDocument(`/moderator/history?${query}`, null)
  const data = resource.status === 'ready' ? resource.data : null
  const outcomes = filters.caseType
    ? CASE_OUTCOMES[filters.caseType]
    : [...CASE_OUTCOMES.publication, ...CASE_OUTCOMES.report]

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="min-w-0">
          <h1 className="text-h2 sm:text-h1">{t('reviewHistory.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {t('reviewHistory.description')}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <Tabs
            label={t('reviewHistory.scope')}
            value={filters.scope}
            onChange={scope => update({ scope })}
            items={[
              { value: 'all', label: t('reviewHistory.scopeAll') },
              { value: 'mine', label: t('reviewHistory.scopeMine') },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field id={`${fieldId}-case`} label={t('reviewHistory.caseType')}>
              <Select
                id={`${fieldId}-case`}
                value={filters.caseType}
                onChange={event => {
                  const caseType = event.target.value
                  update({
                    caseType,
                    ...(caseType && !CASE_OUTCOMES[caseType].includes(filters.outcome)
                      ? { outcome: '' }
                      : {}),
                  })
                }}
              >
                <option value="">{t('reviewHistory.caseAll')}</option>
                {Object.keys(CASE_OUTCOMES).map(caseType => (
                  <option key={caseType} value={caseType}>
                    {t(`moderationFormat.caseTypes.${caseType}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${fieldId}-outcome`} label={t('reviewHistory.outcome')}>
              <Select
                id={`${fieldId}-outcome`}
                value={filters.outcome}
                onChange={event => update({ outcome: event.target.value })}
              >
                <option value="">{t('reviewHistory.outcomeAll')}</option>
                {outcomes.map(outcome => (
                  <option key={outcome} value={outcome}>
                    {t(`moderationFormat.outcomes.${outcome}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${fieldId}-from`} label={t('reviewHistory.from')}>
              <Input
                id={`${fieldId}-from`}
                type="date"
                value={filters.from}
                onChange={event => update({ from: event.target.value })}
              />
            </Field>
            <Field id={`${fieldId}-to`} label={t('reviewHistory.to')}>
              <Input
                id={`${fieldId}-to`}
                type="date"
                value={filters.to}
                onChange={event => update({ to: event.target.value })}
              />
            </Field>
          </div>
          {(filters.from || filters.to) && (
            <div>
              <Button variant="ghost" size="sm" onClick={() => update({ from: '', to: '' })}>
                {t('reviewHistory.clearDates')}
              </Button>
            </div>
          )}
        </div>

        <Card className="mt-4 p-0">
          {resource.status === 'loading' ? (
            <div aria-busy="true" className="space-y-3 p-5">
              <p role="status" className="text-sm text-muted">
                {t('reviewHistory.loading')}
              </p>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-2xl" />
              ))}
            </div>
          ) : !data ? (
            <EmptyState
              tone="rose"
              icon={RotateCcw}
              title={t(
                resource.error?.status === 422 ? 'reviewHistory.invalid' : 'reviewHistory.error',
              )}
              action={
                <Button variant="secondary" onClick={resource.retry}>
                  {t('reviewHistory.reload')}
                </Button>
              }
            />
          ) : !data.items.length ? (
            <EmptyState icon={Gavel} title={t('reviewHistory.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {columns.map(key => (
                      <th key={key} scope="col" className="px-4 py-3 font-semibold">
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(item => (
                    <HistoryRow key={item.historyId} item={item} onOpen={setSelected} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && (
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
            onChange={setPage}
          />
        )}
      </div>

      <Modal
        open={Boolean(selected)}
        title={t('reviewHistory.detail.title')}
        onClose={() => setSelected(null)}
      >
        {selected && <HistoryDetail historyId={selected} />}
      </Modal>
    </ModeratorLayout>
  )
}

function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}

function feedbackText(t, item) {
  if (!item.feedbackOrReason) return ''
  return item.outcome === 'cancelled' && CANCELLATION_REASONS.includes(item.feedbackOrReason)
    ? t(`reviewHistory.cancellation.${item.feedbackOrReason}`)
    : item.feedbackOrReason
}

function HistoryRow({ item, onOpen }) {
  const { t, formatDateTime } = useLocale()
  return (
    <tr className="border-b border-hairline align-top last:border-b-0">
      <td className="whitespace-nowrap px-4 py-3">{formatDateTime(item.occurredAt)}</td>
      <td className="px-4 py-3">{item.moderator.displayName}</td>
      <td className="px-4 py-3">{t(`moderationFormat.caseTypes.${item.caseType}`)}</td>
      <td className="px-4 py-3">
        <span className="block text-caption text-muted">
          {item.targetType ? t(`moderationFormat.targetTypes.${item.targetType}`) : ''}
        </span>
        <span className="break-words font-medium">{item.targetTitle}</span>
      </td>
      <td className="px-4 py-3">
        <Badge tone={outcomeTone(item.outcome)}>
          {t(`moderationFormat.outcomes.${item.outcome}`)}
        </Badge>
      </td>
      <td className="max-w-md px-4 py-3">
        <p className="whitespace-pre-wrap break-words">{feedbackText(t, item)}</p>
      </td>
      <td className="px-4 py-3">
        <Button size="sm" variant="secondary" onClick={() => onOpen(item.historyId)}>
          {t('reviewHistory.view')}
        </Button>
      </td>
    </tr>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm">{children}</dd>
    </div>
  )
}

/** Details of one entry (UC-MOD-07 step 6): reviewed revision and evidence, or report snapshot. */
function HistoryDetail({ historyId }) {
  const { t, formatDateTime } = useLocale()
  const resource = useBackendDocument(`/moderator/history/${historyId}`, null)
  if (resource.status === 'loading')
    return (
      <div aria-busy="true" className="space-y-3">
        <p role="status" className="text-sm text-muted">
          {t('reviewHistory.detail.loading')}
        </p>
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  if (resource.status !== 'ready')
    return (
      <p role="alert" className="text-sm text-rose-strong">
        {t(resource.status === 'empty' ? 'reviewHistory.detail.notFound' : 'reviewHistory.error')}
      </p>
    )
  const entry = resource.data
  const { publication, report } = entry
  const link = publication?.submissionId
    ? [ROUTES.moderatorSubmission(publication.submissionId), 'reviewHistory.detail.openSubmission']
    : report?.reportId
      ? [ROUTES.moderatorReport(report.reportId), 'reviewHistory.detail.openReport']
      : null
  return (
    <>
      <dl className="divide-y divide-hairline">
        <DetailRow label={t('reviewHistory.time')}>{formatDateTime(entry.occurredAt)}</DetailRow>
        <DetailRow label={t('reviewHistory.moderator')}>{entry.moderator.displayName}</DetailRow>
        <DetailRow label={t('reviewHistory.case')}>
          {t(`moderationFormat.caseTypes.${entry.caseType}`)}
        </DetailRow>
        <DetailRow label={t('reviewHistory.target')}>
          {entry.targetType && `${t(`moderationFormat.targetTypes.${entry.targetType}`)} · `}
          {entry.targetTitle}
        </DetailRow>
        <DetailRow label={t('reviewHistory.result')}>
          <Badge tone={outcomeTone(entry.outcome)}>
            {t(`moderationFormat.outcomes.${entry.outcome}`)}
          </Badge>
        </DetailRow>
        <DetailRow label={t('reviewHistory.reason')}>
          {feedbackText(t, entry) || t('reviewHistory.detail.none')}
        </DetailRow>
        {publication && (
          <>
            <DetailRow label={t('reviewHistory.detail.revision')}>
              {publication.revisionNumber != null &&
                t('reviewHistory.detail.revisionNumber', { number: publication.revisionNumber })}
            </DetailRow>
            <DetailRow label={t('reviewHistory.detail.revisionStatus')}>
              {publication.revisionStatus
                ? t(`reviewHistory.revisionStatuses.${publication.revisionStatus}`)
                : t('reviewHistory.detail.none')}
            </DetailRow>
            <DetailRow label={t('reviewHistory.detail.evidence')}>
              {publication.evidenceStatus
                ? t(`moderationFormat.evidence.${publication.evidenceStatus}`)
                : t('reviewHistory.detail.none')}
              {publication.failedStage && (
                <span className="block text-caption text-rose-strong">
                  {t('reviewHistory.detail.failedStage', {
                    stage: t(`moderationFormat.stages.${publication.failedStage}`),
                  })}
                </span>
              )}
            </DetailRow>
          </>
        )}
        {report && (
          <>
            <DetailRow label={t('reviewHistory.detail.reportReason')}>
              {report.reason && t(`moderationFormat.reasons.${report.reason}`)}
            </DetailRow>
            <DetailRow label={t('reviewHistory.detail.reportDetails')}>
              {report.details || t('reviewHistory.detail.noDetails')}
            </DetailRow>
            <DetailRow label={t('reviewHistory.detail.snapshot')}>
              <SnapshotText snapshot={report.snapshot} />
            </DetailRow>
            <DetailRow label={t('reviewHistory.detail.action')}>
              {report.action ? t(`moderationFormat.actions.${report.action}`) : ''}
            </DetailRow>
            <DetailRow label={t('reviewHistory.detail.contentChanged')}>
              {t(
                report.contentChanged == null
                  ? 'reviewHistory.detail.changedUnknown'
                  : report.contentChanged
                    ? 'reviewHistory.detail.changedYes'
                    : 'reviewHistory.detail.changedNo',
              )}
            </DetailRow>
          </>
        )}
      </dl>
      {link && (
        <ButtonLink to={link[0]} variant="secondary" size="sm" className="mt-4">
          {t(link[1])}
        </ButtonLink>
      )}
    </>
  )
}

function SnapshotText({ snapshot }) {
  const { t } = useLocale()
  if (!snapshot) return t('reviewHistory.detail.none')
  return (
    <span className="block space-y-1">
      {snapshot.title && <span className="block font-medium">{snapshot.title}</span>}
      {(snapshot.excerpt || snapshot.description || snapshot.body) && (
        <span className="block whitespace-pre-wrap text-muted">
          {snapshot.excerpt || snapshot.description || snapshot.body}
        </span>
      )}
    </span>
  )
}
