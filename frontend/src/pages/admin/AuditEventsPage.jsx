import { useSearchParams } from 'react-router'
import { AdminLayout } from '../../layouts'
import { Button, Card, EmptyState, Input } from '../../components/ui'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'

const empty = { items: [], total: 0, page: 1, pageSize: 20 }
const fields = ['action', 'targetType', 'targetId', 'actorId', 'result', 'from', 'to']
const timestamp = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
})
export function AuditEventsPage() {
  const { t, formatNumber } = useLocale()
  const m = key => t(`adminAudit.${key}`)
  const [search, setSearch] = useSearchParams()
  const query = new URLSearchParams(search)
  for (const key of ['from', 'to']) {
    const value = search.get(key)
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(`${value}T${key === 'from' ? '00:00:00.000' : '23:59:59.999'}+07:00`)
      if (Number.isFinite(date.getTime())) query.set(key, date.toISOString())
    }
  }
  const feed = useBackendDocument(`/admin/audit-events?${query}`, empty)
  const ready = feed.status === 'ready'
  const loading = feed.status === 'loading'
  const { items, total, page, pageSize } = feed.data
  const move = next => {
    const params = new URLSearchParams(search)
    params.set('page', String(next))
    setSearch(params)
  }
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
        <p className="mt-2 text-sm text-muted">{m('description')}</p>
        <Card className="mt-6">
          <form
            key={search.toString()}
            onSubmit={event => {
              event.preventDefault()
              const draft = Object.fromEntries(new FormData(event.currentTarget))
              setSearch(
                Object.fromEntries(
                  fields.filter(key => draft[key]?.trim()).map(key => [key, draft[key].trim()]),
                ),
              )
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map(key => (
                <label key={key} className="block min-w-0 text-sm font-medium">
                  {m(key)}
                  <Input
                    className="mt-2"
                    type={['from', 'to'].includes(key) ? 'date' : 'text'}
                    name={key}
                    defaultValue={search.get(key) ?? ''}
                    maxLength={['actorId', 'targetId'].includes(key) ? 24 : 120}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button type="submit">{m('filter')}</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch({})
                }}
              >
                {m('clear')}
              </Button>
              <Button variant="secondary" disabled={loading} onClick={feed.retry}>
                {m('refresh')}
              </Button>
            </div>
          </form>
        </Card>
        <Card className="mt-6 overflow-hidden p-0">
          {loading ? (
            <p role="status" className="p-5 text-muted">
              {m('loading')}
            </p>
          ) : !ready ? (
            <div className="p-5">
              <p role="alert">{m('error')}</p>
              <Button className="mt-3" onClick={feed.retry}>
                {m('refresh')}
              </Button>
            </div>
          ) : !items.length ? (
            <EmptyState title={m('empty')} description={m('emptyHint')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-elevated">
                  <tr>
                    {['time', 'actorId', 'action', 'target', 'result', 'reason'].map(key => (
                      <th key={key} scope="col" className="px-4 py-3">
                        {m(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {items.map(event => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap px-4 py-4">
                        {timestamp.format(new Date(event.occurredAt))}
                      </td>
                      <td className="px-4 py-4 break-all">
                        {event.actorType === 'system' ? m('system') : (event.actorId ?? '—')}
                      </td>
                      <td className="px-4 py-4 break-all">{event.action}</td>
                      <td className="px-4 py-4 break-all">
                        {event.targetType}
                        <br />
                        {event.targetId}
                      </td>
                      <td className="px-4 py-4">{event.result}</td>
                      <td className="max-w-sm whitespace-pre-wrap px-4 py-4 break-words">
                        {event.reason ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ready && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-4">
              <p className="text-sm text-muted">
                {m('total')}: {formatNumber(total)} · {m('page')}: {formatNumber(page)}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => move(page - 1)}>
                  {m('previous')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={page * pageSize >= total}
                  onClick={() => move(page + 1)}
                >
                  {m('next')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}
