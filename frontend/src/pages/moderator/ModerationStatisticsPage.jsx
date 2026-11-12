import { useId, useState } from 'react'
import { BarChart3, RotateCcw } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Button, Card, EmptyState, Input, Select, Skeleton } from '../../components/ui'
import { formatBucket, formatDuration, formatRate, vietnamToday } from './moderationFormat'

const PERIODS = ['last7', 'last30', 'last90', 'custom']
const BUCKETS = ['day', 'week', 'month']
const GROUPS = ['outcome', 'moderator', 'targetType', 'riskLevel']
const DECISION_OUTCOMES = ['approved', 'rejected']
const TARGET_TYPES = ['story', 'chapter', 'comment']
const REASONS = ['spam', 'harassment', 'inappropriate', 'copyright', 'spoiler', 'other']
const RESOLUTIONS = [
  'dismissed',
  'comment-hidden',
  'chapter-unpublished',
  'story-unpublished',
  'author-warned',
]
const RISK_LEVELS = ['low', 'medium', 'high']
const FILTER_KEYS = ['groupBy', 'outcome', 'targetType', 'reason', 'resolution', 'riskLevel']

const initialFilters = {
  period: 'last30',
  from: '',
  to: '',
  bucket: 'day',
  groupBy: '',
  outcome: '',
  moderator: 'all',
  moderatorId: '',
  moderatorName: '',
  targetType: '',
  reason: '',
  resolution: '',
  riskLevel: '',
}

/** StatisticsQuery of the SDS: custom dates only with period=custom, moderatorId only with one. */
function statisticsQuery(filters) {
  const query = new URLSearchParams({ period: filters.period, bucket: filters.bucket })
  if (filters.period === 'custom') {
    query.set('from', filters.from)
    query.set('to', filters.to)
  }
  for (const key of FILTER_KEYS) if (filters[key]) query.set(key, filters[key])
  query.set('moderator', filters.moderator)
  if (filters.moderator === 'one') query.set('moderatorId', filters.moderatorId)
  return query.toString()
}

export function ModerationStatisticsPage() {
  const { t } = useLocale()
  const fieldId = useId()
  const [filters, setFilters] = useState(initialFilters)
  const update = changes => setFilters(current => ({ ...current, ...changes }))
  const select = (key, label, values, labelOf, allLabel = t('moderationStatistics.all')) => (
    <Field id={`${fieldId}-${key}`} label={label}>
      <Select
        id={`${fieldId}-${key}`}
        value={filters[key]}
        onChange={event => update({ [key]: event.target.value })}
      >
        {allLabel !== null && <option value="">{allLabel}</option>}
        {values.map(value => (
          <option key={value} value={value}>
            {labelOf(value)}
          </option>
        ))}
      </Select>
    </Field>
  )
  const datesMissing = filters.period === 'custom' && !(filters.from && filters.to)

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="min-w-0">
          <h1 className="text-h2 sm:text-h1">{t('moderationStatistics.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {t('moderationStatistics.description')}
          </p>
        </div>

        <Card as="section" aria-label={t('moderationStatistics.filters')} className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {select(
              'period',
              t('moderationStatistics.period'),
              PERIODS,
              value => t(`moderationStatistics.periods.${value}`),
              null,
            )}
            {filters.period === 'custom' && (
              <>
                <Field id={`${fieldId}-from`} label={t('moderationStatistics.from')}>
                  <Input
                    id={`${fieldId}-from`}
                    type="date"
                    max={vietnamToday()}
                    value={filters.from}
                    onChange={event => update({ from: event.target.value })}
                  />
                </Field>
                <Field id={`${fieldId}-to`} label={t('moderationStatistics.to')}>
                  <Input
                    id={`${fieldId}-to`}
                    type="date"
                    max={vietnamToday()}
                    value={filters.to}
                    onChange={event => update({ to: event.target.value })}
                  />
                </Field>
              </>
            )}
            {select(
              'bucket',
              t('moderationStatistics.bucket'),
              BUCKETS,
              value => t(`moderationStatistics.buckets.${value}`),
              null,
            )}
            {select(
              'groupBy',
              t('moderationStatistics.groupBy'),
              GROUPS,
              value => t(`moderationStatistics.groups.${value}`),
              t('moderationStatistics.groupNone'),
            )}
            {select('outcome', t('moderationStatistics.outcome'), DECISION_OUTCOMES, value =>
              t(`moderationFormat.outcomes.${value}`),
            )}
            <Field id={`${fieldId}-moderator`} label={t('moderationStatistics.moderator')}>
              <Select
                id={`${fieldId}-moderator`}
                value={filters.moderator}
                onChange={event =>
                  update({ moderator: event.target.value, moderatorId: '', moderatorName: '' })
                }
              >
                <option value="all">{t('moderationStatistics.moderators.all')}</option>
                <option value="mine">{t('moderationStatistics.moderators.mine')}</option>
                {filters.moderator === 'one' && (
                  <option value="one">{filters.moderatorName}</option>
                )}
              </Select>
            </Field>
            {select('riskLevel', t('moderationStatistics.riskLevel'), RISK_LEVELS, value =>
              t(`moderationFormat.riskLevels.${value}`),
            )}
            {select('targetType', t('moderationStatistics.targetType'), TARGET_TYPES, value =>
              t(`moderationFormat.targetTypes.${value}`),
            )}
            {select('reason', t('moderationStatistics.reason'), REASONS, value =>
              t(`moderationFormat.reasons.${value}`),
            )}
            {select('resolution', t('moderationStatistics.resolution'), RESOLUTIONS, value =>
              t(`moderationFormat.outcomes.${value}`),
            )}
          </div>
        </Card>

        {datesMissing ? (
          <p role="status" className="mt-6 text-sm text-muted">
            {t('moderationStatistics.needDates')}
          </p>
        ) : (
          <StatisticsResults
            path={`/moderator/statistics?${statisticsQuery(filters)}`}
            filters={filters}
            onPickModerator={moderator =>
              update({
                moderator: 'one',
                moderatorId: moderator.id,
                moderatorName: moderator.displayName,
              })
            }
          />
        )}
      </div>
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

function StatisticsResults({ path, filters, onPickModerator }) {
  const { t, formatDateTime } = useLocale()
  const resource = useBackendDocument(path, null)
  if (resource.status === 'loading')
    return (
      <div aria-busy="true" className="mt-6 space-y-3">
        <p role="status" className="text-sm text-muted">
          {t('moderationStatistics.loading')}
        </p>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-32 w-full rounded-3xl" />
        ))}
      </div>
    )
  if (resource.status !== 'ready')
    // EX1 and EX2: nothing is computed or no partial figures are shown.
    return (
      <Card className="mt-6 p-0">
        <EmptyState
          tone="rose"
          icon={RotateCcw}
          title={t(
            resource.error?.status === 422
              ? 'moderationStatistics.invalid'
              : 'moderationStatistics.error',
          )}
          action={
            <Button variant="secondary" onClick={resource.retry}>
              {t('moderationStatistics.reload')}
            </Button>
          }
        />
      </Card>
    )
  const data = resource.data
  const { bucket } = data.period
  const moderatorNames = new Map(
    data.moderatorDecisions.map(row => [row.moderator.id, row.moderator.displayName]),
  )
  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted">
        {t('moderationStatistics.range', {
          from: formatDateTime(data.period.from),
          to: formatDateTime(data.period.to),
        })}
      </p>
      <QueueAgeSection queueAge={data.queueAge} definition={data.definitions.queueAge} />
      <DecisionsSection
        rows={data.decisionBuckets}
        bucket={bucket}
        groupBy={filters.groupBy}
        outcome={filters.outcome}
        moderatorNames={moderatorNames}
        definition={data.definitions.decisionBuckets}
      />
      <ModeratorSection
        rows={data.moderatorDecisions}
        definition={data.definitions.moderatorDecisions}
        onPickModerator={onPickModerator}
      />
      <Section
        title={t('moderationStatistics.reports.title')}
        definition={data.definitions.reportBuckets}
      >
        <PivotTable
          caption={t('moderationStatistics.reports.byTarget')}
          starts={data.period.buckets}
          bucket={bucket}
          rows={data.reportBuckets}
          field="targetType"
          count="received"
          columns={(filters.targetType ? [filters.targetType] : TARGET_TYPES).map(value => [
            value,
            t(`moderationFormat.targetTypes.${value}`),
          ])}
        />
        <PivotTable
          caption={t('moderationStatistics.reports.byReason')}
          starts={data.period.buckets}
          bucket={bucket}
          rows={data.reportBuckets}
          field="reason"
          count="received"
          columns={(filters.reason ? [filters.reason] : REASONS).map(value => [
            value,
            t(`moderationFormat.reasons.${value}`),
          ])}
        />
      </Section>
      <Section
        title={t('moderationStatistics.resolutions.title')}
        definition={data.definitions.resolutionBuckets}
      >
        <PivotTable
          starts={data.period.buckets}
          bucket={bucket}
          rows={data.resolutionBuckets}
          field="outcome"
          count="resolved"
          columns={(filters.resolution ? [filters.resolution] : RESOLUTIONS).map(value => [
            value,
            t(`moderationFormat.outcomes.${value}`),
          ])}
        />
      </Section>
      <AgreementSection agreement={data.aiAgreement} definition={data.definitions.aiAgreement} />
    </div>
  )
}

function Section({ title, definition, children }) {
  const { t } = useLocale()
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-h3">
        <BarChart3 size={18} />
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
      <p className="mt-4 text-caption text-muted">
        <span className="font-semibold">{t('moderationStatistics.definition')}: </span>
        <span>{definition}</span>
      </p>
    </Card>
  )
}

function Figures({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-hairline p-4">
          <dt className="text-xs font-semibold uppercase leading-4 tracking-[.06em] text-muted">
            {label}
          </dt>
          <dd className="mt-2 text-xl font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function QueueAgeSection({ queueAge, definition }) {
  const { t, formatNumber } = useLocale()
  return (
    <Section title={t('moderationStatistics.queueAge.title')} definition={definition}>
      <Figures
        items={[
          [t('moderationStatistics.queueAge.count'), formatNumber(queueAge.count)],
          [t('moderationStatistics.queueAge.oldest'), formatDuration(t, queueAge.oldest)],
          [t('moderationStatistics.queueAge.median'), formatDuration(t, queueAge.median)],
          [t('moderationStatistics.queueAge.p90'), formatDuration(t, queueAge.p90)],
        ]}
      />
    </Section>
  )
}

function Table({ caption, headers, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        {caption && <caption className="mb-2 text-left text-sm font-semibold">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {headers.map(header => (
              <th key={header} scope="col" className="px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function DecisionsSection({ rows, bucket, groupBy, outcome, moderatorNames, definition }) {
  const { t, formatNumber } = useLocale()
  const groupLabel = group => {
    if (groupBy === 'moderator') return moderatorNames.get(group) ?? group
    if (groupBy === 'outcome') return t(`moderationFormat.outcomes.${group}`)
    if (groupBy === 'targetType') return t(`moderationFormat.targetTypes.${group}`)
    return t(`moderationFormat.riskLevels.${group ?? 'none'}`)
  }
  const grouped = Boolean(groupBy)
  const totals = rows.reduce(
    (sum, row) => ({
      approved: sum.approved + row.approved,
      rejected: sum.rejected + row.rejected,
    }),
    { approved: 0, rejected: 0 },
  )
  return (
    <Section title={t('moderationStatistics.decisions.title')} definition={definition}>
      <p className="text-sm">
        {outcome
          ? t('moderationStatistics.decisions.filteredTotal', {
              outcome: t(`moderationFormat.outcomes.${outcome}`),
              count: formatNumber(totals[outcome]),
            })
          : t('moderationStatistics.decisions.totals', {
              approved: formatNumber(totals.approved),
              rejected: formatNumber(totals.rejected),
            })}
      </p>
      {!rows.length ? (
        <p className="text-sm text-muted">{t('moderationStatistics.empty')}</p>
      ) : (
        <Table
          headers={[
            t('moderationStatistics.time'),
            ...(grouped ? [t('moderationStatistics.decisions.group')] : []),
            t('moderationStatistics.decisions.approved'),
            t('moderationStatistics.decisions.rejected'),
            t('moderationStatistics.decisions.approvedRate'),
            t('moderationStatistics.decisions.rejectedRate'),
          ]}
        >
          {rows.map(row => (
            <tr key={`${row.start}|${row.group}`} className="border-b border-hairline">
              <td className="whitespace-nowrap px-3 py-2">{formatBucket(t, row.start, bucket)}</td>
              {grouped && <td className="px-3 py-2">{groupLabel(row.group)}</td>}
              <td className="px-3 py-2 tabular-nums">{formatNumber(row.approved)}</td>
              <td className="px-3 py-2 tabular-nums">{formatNumber(row.rejected)}</td>
              <td className="px-3 py-2 tabular-nums">
                {formatRate(t, formatNumber, row.approvedRate)}
              </td>
              <td className="px-3 py-2 tabular-nums">
                {formatRate(t, formatNumber, row.rejectedRate)}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  )
}

function ModeratorSection({ rows, definition, onPickModerator }) {
  const { t, formatNumber } = useLocale()
  return (
    <Section title={t('moderationStatistics.moderatorDecisions.title')} definition={definition}>
      {!rows.length ? (
        <p className="text-sm text-muted">{t('moderationStatistics.empty')}</p>
      ) : (
        <Table
          headers={[
            t('moderationStatistics.moderator'),
            t('moderationStatistics.moderatorDecisions.decisions'),
            t('moderationStatistics.moderatorDecisions.median'),
            '',
          ]}
        >
          {rows.map(row => (
            <tr key={row.moderator.id} className="border-b border-hairline">
              <td className="px-3 py-2">{row.moderator.displayName}</td>
              <td className="px-3 py-2 tabular-nums">{formatNumber(row.decisions)}</td>
              <td className="px-3 py-2">{formatDuration(t, row.medianClaimToDecision)}</td>
              <td className="px-3 py-2 text-right">
                <Button size="sm" variant="ghost" onClick={() => onPickModerator(row.moderator)}>
                  {t('moderationStatistics.onlyModerator')}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Section>
  )
}

/** Rows are every bucket of the period, so buckets without activity show zero (AF2). */
function PivotTable({ caption, starts, bucket, rows, field, count, columns }) {
  const { t, formatNumber } = useLocale()
  const cells = new Map()
  for (const row of rows) {
    const key = `${new Date(row.start).toISOString()}|${row[field]}`
    cells.set(key, (cells.get(key) ?? 0) + row[count])
  }
  const cell = (start, column) => cells.get(`${new Date(start).toISOString()}|${column}`) ?? 0
  return (
    <Table
      caption={caption}
      headers={[
        t('moderationStatistics.time'),
        ...columns.map(([, label]) => label),
        t('moderationStatistics.total'),
      ]}
    >
      {starts.map(start => (
        <tr key={start} className="border-b border-hairline">
          <td className="whitespace-nowrap px-3 py-2">{formatBucket(t, start, bucket)}</td>
          {columns.map(([value]) => (
            <td key={value} className="px-3 py-2 tabular-nums">
              {formatNumber(cell(start, value))}
            </td>
          ))}
          <td className="px-3 py-2 font-semibold tabular-nums">
            {formatNumber(columns.reduce((sum, [value]) => sum + cell(start, value), 0))}
          </td>
        </tr>
      ))}
    </Table>
  )
}

function AgreementSection({ agreement, definition }) {
  const { t, formatNumber } = useLocale()
  return (
    <Section title={t('moderationStatistics.ai.title')} definition={definition}>
      <Figures
        items={[
          [t('moderationStatistics.ai.overall'), formatRate(t, formatNumber, agreement.overall)],
          ...RISK_LEVELS.map(level => [
            t('moderationStatistics.ai.byLevel', {
              level: t(`moderationFormat.riskLevels.${level}`),
            }),
            formatRate(t, formatNumber, agreement.byRiskLevel[level]),
          ]),
          [t('moderationStatistics.ai.qualifying'), formatNumber(agreement.qualifying)],
          [t('moderationStatistics.ai.agreeing'), formatNumber(agreement.agreeing)],
          [
            t('moderationStatistics.ai.withoutRiskLevel'),
            formatNumber(agreement.succeededWithoutRiskLevel),
          ],
          [t('moderationStatistics.ai.without'), formatNumber(agreement.withoutLlmReview)],
        ]}
      />
    </Section>
  )
}
