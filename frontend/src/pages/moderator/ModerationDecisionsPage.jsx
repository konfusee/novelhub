import { useId, useState } from 'react'
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
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'

const columns = [
  'reviewHistory.time',
  'reviewHistory.submission',
  'reviewHistory.result',
  'reviewHistory.reason',
  'reviewHistory.moderator',
  'reviewHistory.action',
]
const outcomes = [
  ['all', 'reviewHistory.all'],
  ['approved', 'reviewHistory.approved'],
  ['rejected', 'reviewHistory.rejected'],
]

export function ModerationDecisionsPage() {
  const { t, formatDate } = useLocale()
  const fieldId = useId()
  const [scope, setScope] = useState('all')
  const [outcome, setOutcome] = useState('all')
  const [page, setPage] = useState(1)
  const resource = useBackendDocument(
    '/moderator/decisions?outcome=' + outcome + '&scope=' + scope + '&page=' + page,
    null,
  )
  const items = resource.status === 'ready' ? (resource.data?.items ?? []) : []
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="min-w-0">
          <h1 className="text-h2 sm:text-h1">{t('reviewHistory.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {t('reviewHistory.description')}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Tabs
            label={t('reviewHistory.title')}
            value={scope}
            onChange={value => {
              setScope(value)
              setPage(1)
            }}
            items={[
              { value: 'all', label: t('reviewHistory.scopeAll') },
              { value: 'mine', label: t('reviewHistory.scopeMine') },
            ]}
          />
          <div className="w-full sm:max-w-xs">
            <label htmlFor={`${fieldId}-outcome`} className="mb-2 block text-sm font-medium">
              {t('reviewHistory.outcome')}
            </label>
            <Select
              id={`${fieldId}-outcome`}
              value={outcome}
              onChange={event => {
                setOutcome(event.target.value)
                setPage(1)
              }}
            >
              {outcomes.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </div>
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
          ) : resource.status === 'error' ? (
            <EmptyState
              tone="rose"
              icon={RotateCcw}
              title={t('reviewHistory.error')}
              action={
                <Button variant="secondary" onClick={resource.retry}>
                  {t('reviewHistory.reload')}
                </Button>
              }
            />
          ) : !items.length ? (
            <EmptyState icon={Gavel} title={t('reviewHistory.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
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
                  {items.map(item => (
                    <tr
                      key={item.id}
                      className="border-b border-hairline align-top last:border-b-0"
                    >
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(item.occurredAt)}</td>
                      <td className="px-4 py-3 break-words font-medium">{item.title}</td>
                      <td className="px-4 py-3">
                        <Badge tone={item.outcome === 'approved' ? 'green' : 'red'}>
                          {t('reviewHistory.' + item.outcome)}
                        </Badge>
                      </td>
                      <td className="max-w-md px-4 py-3">
                        <p className="whitespace-pre-wrap break-words">{item.feedback}</p>
                      </td>
                      <td className="px-4 py-3">{item.moderator.displayName}</td>
                      <td className="px-4 py-3">
                        <ButtonLink
                          to={ROUTES.moderatorSubmission(item.submissionId)}
                          size="sm"
                          variant="secondary"
                        >
                          {t('reviewHistory.open')}
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {resource.status === 'ready' && resource.data && (
          <Pagination page={page} pageCount={resource.data.pageCount} onChange={setPage} />
        )}
      </div>
    </ModeratorLayout>
  )
}
