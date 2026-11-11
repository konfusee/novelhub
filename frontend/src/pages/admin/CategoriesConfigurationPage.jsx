import { useRef, useState } from 'react'
import { AdminLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, Card, EmptyState, Input, Modal, Select, Tabs } from '../../components/ui'
import { FolderTree, Hash, Plus, Search } from '../../components/icons'

const empty = { items: [], total: 0, page: 1, pageSize: 20 }
export function CategoriesConfigurationPage() {
  const { t, formatNumber } = useLocale()
  const m = key => t(`adminTaxonomy.${key}`)
  const [active, setActive] = useState('categories')
  const [filter, setFilter] = useState({ q: '', status: 'all', page: 1 })
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const feed = useBackendDocument(
    `/admin/taxonomy/categories?${new URLSearchParams({ ...filter, page: String(filter.page) })}`,
    empty,
  )
  const ready = feed.status === 'ready'
  const loading = feed.status === 'loading'
  const open = item => {
    setError('')
    setForm(item ? { ...item, reason: '' } : { name: '', sortKey: 0, reason: '', status: 'active' })
  }
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <p className="text-caption text-ink/70">{m('breadcrumb')}</p>
            <h1 className="mt-1 text-h2 sm:text-h1">{m('title')}</h1>
          </div>
          {active === 'categories' && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={loading} onClick={feed.retry}>
                {m('reload')}
              </Button>
              <Button onClick={() => open()}>
                <Plus size={16} />
                {m('add')}
              </Button>
            </div>
          )}
        </header>
        <div className="mt-6">
          <Tabs
            label={m('groups')}
            singleRow
            value={active}
            onChange={setActive}
            items={['categories', 'tags', 'ratings', 'lifecycle'].map(value => ({
              value,
              label: m(value),
            }))}
          />
        </div>
        {active === 'tags' ? (
          <TagUsagePanel />
        ) : active !== 'categories' ? (
          <Card className="mt-6">
            <EmptyState title={m('unsupported')} description={m('unsupportedHint')} />
          </Card>
        ) : (
          <Card className="mt-6 overflow-hidden p-0">
            <div className="p-5">
              <h2 className="flex items-center gap-2 text-h3">
                <FolderTree size={20} />
                {m('core')}
              </h2>
              <p className="mt-1 text-sm text-muted">{m('description')}</p>
              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row"
                onSubmit={event => {
                  event.preventDefault()
                  setFilter({ ...filter, q: query.trim(), page: 1 })
                }}
              >
                <Input
                  icon={Search}
                  className="min-w-0 flex-1"
                  type="search"
                  aria-label={m('search')}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  maxLength={100}
                />
                <Select
                  aria-label={m('status')}
                  value={filter.status}
                  onChange={event => setFilter({ ...filter, status: event.target.value, page: 1 })}
                >
                  {['all', 'active', 'retired'].map(status => (
                    <option key={status} value={status}>
                      {m(status)}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="secondary">
                  {m('filter')}
                </Button>
              </form>
            </div>
            {loading ? (
              <p role="status" className="p-5">
                {m('loading')}
              </p>
            ) : !ready ? (
              <p role="alert" className="p-5">
                {m('loadError')}
              </p>
            ) : !feed.data.items.length ? (
              <EmptyState icon={FolderTree} title={m('empty')} description={m('emptyHint')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-elevated">
                    <tr>
                      {['name', 'order', 'stories', 'status', 'actions'].map(key => (
                        <th key={key} scope="col" className="px-5 py-3">
                          {m(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {feed.data.items.map(item => (
                      <tr key={item.id}>
                        <td className="max-w-sm break-words px-5 py-4 font-semibold">
                          {item.name}
                        </td>
                        <td className="px-5 py-4">{formatNumber(item.sortKey)}</td>
                        <td className="px-5 py-4">{formatNumber(item.storyCount)}</td>
                        <td className="px-5 py-4">
                          <Badge tone={item.status === 'active' ? 'green' : 'neutral'}>
                            {m(item.status)}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <Button size="sm" variant="secondary" onClick={() => open(item)}>
                            {m('edit')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {ready && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5">
                <p className="text-sm text-muted">
                  {m('total')}: {formatNumber(feed.data.total)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={filter.page <= 1}
                    onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
                  >
                    {m('previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={filter.page * feed.data.pageSize >= feed.data.total}
                    onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
                  >
                    {m('next')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
        {form && (
          <Modal
            open
            title={m(form.id ? 'edit' : 'add')}
            onClose={() => !lock.current && setForm(null)}
          >
            <form
              onSubmit={async event => {
                event.preventDefault()
                if (lock.current || !form.name.trim() || !form.reason.trim()) return
                lock.current = true
                setBusy(true)
                setError('')
                try {
                  const body = {
                    name: form.name.trim(),
                    sortKey: Number(form.sortKey),
                    reason: form.reason.trim(),
                    ...(form.id ? { expectedVersion: form.version, status: form.status } : {}),
                  }
                  const result = await apiRequest(
                    `/admin/taxonomy/categories${form.id ? '/' + form.id : ''}`,
                    { method: form.id ? 'PUT' : 'POST', body },
                  )
                  if (
                    !result?.category?.id ||
                    (form.id && result.category.id !== form.id) ||
                    !Number.isSafeInteger(result.category.version) ||
                    (form.id && result.category.version <= form.version)
                  )
                    throw new Error(m('saveError'))
                  setForm(null)
                  feed.retry()
                } catch (failure) {
                  setError(failure.message || m('saveError'))
                } finally {
                  lock.current = false
                  setBusy(false)
                }
              }}
            >
              <p className="mb-4 text-sm text-muted">{m('changeHint')}</p>
              <label className="block text-sm font-medium">
                {m('name')}
                <Input
                  className="mt-2"
                  value={form.name}
                  maxLength={100}
                  required
                  disabled={busy}
                  onChange={event => setForm({ ...form, name: event.target.value })}
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                {m('order')}
                <Input
                  className="mt-2"
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  required
                  disabled={busy}
                  value={form.sortKey}
                  onChange={event => setForm({ ...form, sortKey: event.target.value })}
                />
              </label>
              {form.id && (
                <label className="mt-4 block text-sm font-medium">
                  {m('status')}
                  <Select
                    className="mt-2"
                    disabled={busy}
                    value={form.status}
                    onChange={event => setForm({ ...form, status: event.target.value })}
                  >
                    {['active', 'retired'].map(status => (
                      <option key={status} value={status}>
                        {m(status)}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              <label className="mt-4 block text-sm font-medium">
                {m('reason')}
                <Input
                  className="mt-2"
                  value={form.reason}
                  maxLength={1000}
                  required
                  disabled={busy}
                  onChange={event => setForm({ ...form, reason: event.target.value })}
                />
              </label>
              {error && (
                <p role="alert" className="mt-3 text-sm text-rose-strong">
                  {error}
                </p>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={() => setForm(null)}>
                  {m('cancel')}
                </Button>
                <Button type="submit" disabled={busy || !form.name.trim() || !form.reason.trim()}>
                  {m(busy ? 'saving' : 'save')}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </AdminLayout>
  )
}

/** Read-only usage of free-form author tags; tags are never created, edited or deleted here. */
function TagUsagePanel() {
  const { t, formatNumber } = useLocale()
  const m = key => t(`adminTaxonomy.${key}`)
  const [filter, setFilter] = useState({ q: '', page: 1 })
  const [query, setQuery] = useState('')
  const feed = useBackendDocument(
    `/admin/taxonomy/tags?${new URLSearchParams({ q: filter.q, page: String(filter.page) })}`,
    empty,
  )
  const ready = feed.status === 'ready'
  return (
    <Card className="mt-6 overflow-hidden p-0">
      <div className="p-5">
        <h2 className="flex items-center gap-2 text-h3">
          <Hash size={20} />
          {m('tagsTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted">{m('tagsDescription')}</p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={event => {
            event.preventDefault()
            setFilter({ q: query.trim(), page: 1 })
          }}
        >
          <Input
            icon={Search}
            className="min-w-0 flex-1"
            type="search"
            aria-label={m('tagSearch')}
            value={query}
            onChange={event => setQuery(event.target.value)}
            maxLength={31}
          />
          <Button type="submit" variant="secondary">
            {m('filter')}
          </Button>
        </form>
      </div>
      {feed.status === 'loading' ? (
        <p role="status" className="p-5">
          {m('tagLoading')}
        </p>
      ) : !ready ? (
        <div className="flex flex-wrap items-center gap-3 p-5">
          <p role="alert">{m('tagLoadError')}</p>
          <Button size="sm" variant="secondary" onClick={feed.retry}>
            {m('reload')}
          </Button>
        </div>
      ) : !feed.data.items.length ? (
        <EmptyState icon={Hash} title={m('tagEmpty')} description={m('tagEmptyHint')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-elevated">
              <tr>
                {['tagLabel', 'tagPublished', 'tagStories'].map(key => (
                  <th key={key} scope="col" className="px-5 py-3">
                    {m(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {feed.data.items.map(item => (
                <tr key={item.key}>
                  <td className="max-w-sm break-words px-5 py-4 font-semibold">#{item.label}</td>
                  <td className="px-5 py-4">{formatNumber(item.publishedStories)}</td>
                  <td className="px-5 py-4">{formatNumber(item.totalStories)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ready && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5">
          <p className="text-sm text-muted">
            {m('tagTotal')}: {formatNumber(feed.data.total)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={filter.page <= 1}
              onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
            >
              {m('previous')}
            </Button>
            <Button
              variant="secondary"
              disabled={filter.page * feed.data.pageSize >= feed.data.total}
              onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
            >
              {m('next')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
