import { useSearchParams } from 'react-router'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { AdminLayout } from '../../layouts'
import { Button, Card, Input, Select } from '../../components/ui'
const metrics = [
  'registrations',
  'unlocks',
  'requestedUnlocks',
  'rejectedUnlocks',
  'committedUnlocks',
  'applications',
  'approvedApplications',
  'rejectedApplications',
  'pendingApplications',
  'activeAuthors',
]
const empty = {
  summary: {},
}
const validate = value => {
  if (
    !value?.summary ||
    metrics.some(key => !Number.isSafeInteger(value.summary[key]) || value.summary[key] < 0) ||
    !Number.isFinite(Date.parse(value.asOf))
  )
    throw new Error('Invalid Author statistics')
  return value
}
export function AuthorStatisticsPage() {
  const { t, formatNumber, formatDate } = useLocale(),
    m = key => t(`adminAuthorStats.${key}`)
  const [params, setParams] = useSearchParams()
  const period = params.get('period') || 'all'
  const accountStatus = params.get('accountStatus') || 'all'
  const feed = useBackendResource(
    `/admin/author-statistics?${new URLSearchParams({
      period,
      accountStatus,
    })}`,
    empty,
    validate,
  )
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('hint')}</p>
          </div>
        </div>
        <Card className="mt-6">
          <form
            key={`${period}:${accountStatus}`}
            className="flex flex-wrap items-end gap-3"
            onSubmit={event => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const value = String(form.get('period') ?? '')
              const status = String(form.get('accountStatus') ?? 'all')
              setParams(
                value || status !== 'all' ? { period: value || 'all', accountStatus: status } : {},
              )
            }}
          >
            <label className="text-sm font-medium">
              {m('period')}
              <Input
                className="mt-1"
                type="month"
                name="period"
                defaultValue={period === 'all' ? '' : period}
              />
            </label>
            <label className="text-sm font-medium">
              {m('accountStatus')}
              <Select className="mt-1" name="accountStatus" defaultValue={accountStatus}>
                {['all', 'active', 'suspended', 'pending-verification', 'anonymized'].map(value => (
                  <option key={value} value={value}>
                    {m(`statuses.${value}`)}
                  </option>
                ))}
              </Select>
            </label>
            <Button type="submit">{m('apply')}</Button>
            <Button type="button" variant="secondary" onClick={() => setParams({})}>
              {m('all')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={feed.status === 'loading'}
              onClick={feed.retry}
            >
              {m('reload')}
            </Button>
          </form>
        </Card>
        {feed.status === 'ready' ? (
          <>
            <p className="mt-4 text-xs text-muted">
              {m('asOf')}: {formatDate(feed.data.asOf)}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map(key => (
                <Card key={key}>
                  <p className="text-sm text-muted">{m(key)}</p>
                  <strong className="mt-2 block text-h2 tabular-nums">
                    {formatNumber(feed.data.summary[key])}
                  </strong>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card className="mt-4">
            <p role={feed.status === 'loading' ? 'status' : 'alert'}>
              {m(feed.status === 'loading' ? 'loading' : 'error')}
            </p>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
