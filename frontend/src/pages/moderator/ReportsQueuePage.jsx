import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Flag, RotateCcw } from '../../components/icons'
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
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'

const VIEWS = ['queue', 'mine']
const targetTypes = ['all', 'story', 'chapter', 'comment']

/** UC-MOD-05 step 1: open reports a Moderator can take, or the Moderator's own claims. */
export function ReportsQueuePage() {
  const { t } = useLocale()
  const [searchParams] = useSearchParams()
  const [view, setView] = useState(() =>
    VIEWS.includes(searchParams.get('view')) ? searchParams.get('view') : 'queue',
  )
  const [targetType, setTargetType] = useState('all')
  const [page, setPage] = useState(1)
  const query =
    '/moderator/reports?view=' +
    view +
    (targetType === 'all' ? '' : '&targetType=' + targetType) +
    '&page=' +
    page
  const resource = useBackendDocument(query, null)
  const data = resource.status === 'ready' ? resource.data : null
  const items = data?.items ?? []

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
            value={view}
            onChange={value => {
              setView(value)
              setPage(1)
            }}
            items={VIEWS.map(value => ({ value, label: t('reportsQueue.tabs.' + value) }))}
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

        <div className="mt-4">
          {resource.status === 'loading' ? (
            <Card aria-busy="true" className="space-y-3 p-5">
              <p role="status" className="text-sm text-muted">
                {t('reportsQueue.loading')}
              </p>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-2xl" />
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
                <ReportRow key={report.reportId} report={report} />
              ))}
            </ul>
          )}
        </div>

        {data && <Pagination page={page} pageCount={data.pageCount} onChange={setPage} />}
      </div>
    </ModeratorLayout>
  )
}

function ReportRow({ report }) {
  const { t, formatDateTime } = useLocale()
  return (
    <li>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t('reportsQueue.targetTypes.' + report.targetType)}</Badge>
          <Badge tone="orange">{t('reportsQueue.reasons.' + report.reason)}</Badge>
          <Badge tone={report.claimState === 'mine' ? 'green' : 'neutral'}>
            {t('reportsQueue.claimStates.' + report.claimState, {
              dateTime: report.claimExpiresAt ? formatDateTime(report.claimExpiresAt) : '',
            })}
          </Badge>
        </div>
        <p className="mt-3 break-words font-semibold">
          {report.targetTitle || t('reportsQueue.targetTypes.' + report.targetType)}
        </p>
        <p className="mt-1 text-caption text-muted">
          {t('reportsQueue.reportedBy', {
            name: report.reporter.displayName,
            dateTime: formatDateTime(report.reportedAt),
          })}
        </p>
        <div className="mt-4">
          <ButtonLink to={ROUTES.moderatorReport(report.reportId)} size="sm" variant="secondary">
            {t('reportsQueue.open')}
          </ButtonLink>
        </div>
      </Card>
    </li>
  )
}
