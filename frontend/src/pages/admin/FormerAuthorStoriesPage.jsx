import { useRef, useState } from 'react'
import { AdminLayout } from '../../layouts'
import { useBackendDocument, useBackendResource } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, ButtonLink, Card, EmptyState, Input, Modal, Select } from '../../components/ui'
import { ROUTES } from '../../app/routes'
const empty = { items: [], total: 0, page: 1, pageSize: 20 }
export function FormerAuthorStoriesPage() {
  const { t, formatNumber } = useLocale()
  const m = key => t(`formerAuthorContent.${key}`)
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(null)
  const feed = useBackendDocument(`/admin/former-author-stories?page=${page}`, empty)
  const ready = feed.status === 'ready'
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('description')}</p>
          </div>
          <Button variant="secondary" disabled={feed.status === 'loading'} onClick={feed.retry}>
            {m('reload')}
          </Button>
        </div>
        <Card className="mt-6 overflow-hidden p-0">
          {!ready ? (
            <p role={feed.status === 'loading' ? 'status' : 'alert'} className="p-5">
              {m(feed.status === 'loading' ? 'loading' : 'loadError')}
            </p>
          ) : !feed.data.items.length ? (
            <EmptyState title={m('empty')} description={m('emptyHint')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-elevated">
                  <tr>
                    {['story', 'status', 'owner', 'actions'].map(key => (
                      <th scope="col" key={key} className="px-5 py-3">
                        {m(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {feed.data.items.map(story => (
                    <tr key={story.id}>
                      <td className="max-w-sm break-words px-5 py-4 font-semibold">
                        {story.title}
                      </td>
                      <td className="px-5 py-4">{m(`statuses.${story.status}`)}</td>
                      <td className="px-5 py-4 break-all">{story.ownerName ?? '—'}</td>
                      <td className="px-5 py-4">
                        {story.status === 'published' && (
                          <ButtonLink to={ROUTES.story(story.id)} variant="ghost" size="sm">
                            {m('publicView')}
                          </ButtonLink>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setSelected(story.id)}>
                          {m('manage')}
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
              <span>
                {m('total')}: {formatNumber(feed.data.total)}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {m('previous')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={page * feed.data.pageSize >= feed.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  {m('next')}
                </Button>
              </div>
            </div>
          )}
        </Card>
        {selected && (
          <FormerStoryDialog
            id={selected}
            onClose={() => setSelected(null)}
            onChanged={() => {
              setSelected(null)
              feed.retry()
            }}
          />
        )}
      </div>
    </AdminLayout>
  )
}
function FormerStoryDialog({ id, onClose, onChanged }) {
  const { t } = useLocale()
  const m = key => t(`formerAuthorContent.${key}`)
  const detail = useBackendDocument(`/admin/former-author-stories/${id}`, null)
  const categories = useBackendResource('/catalog/categories')
  const story = detail.status === 'ready' ? detail.data.story : null
  const [action, setAction] = useState('correct'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const lock = useRef(false)
  return (
    <Modal open title={m('manage')} onClose={() => !lock.current && onClose()}>
      {!story ? (
        <div>
          <p role={detail.status === 'loading' ? 'status' : 'alert'}>
            {detail.error?.message ?? m('loading')}
          </p>
          <Button className="mt-3" onClick={detail.retry}>
            {m('reload')}
          </Button>
        </div>
      ) : (
        <form
          key={story.version}
          onSubmit={async event => {
            event.preventDefault()
            if (lock.current) return
            const form = new FormData(event.currentTarget)
            const reason = String(form.get('reason') ?? '').trim()
            if (!reason) return
            lock.current = true
            setBusy(true)
            setError('')
            try {
              const input = {
                action,
                expectedVersion: story.version,
                expectedPublishedRevisionId: story.publishedRevisionId,
                reason,
                ...(action === 'correct'
                  ? {
                      title: String(form.get('title')).trim(),
                      description: String(form.get('description')).trim(),
                      categoryId: String(form.get('categoryId') ?? ''),
                    }
                  : {}),
              }
              const result = await apiRequest(`/admin/former-author-stories/${id}`, {
                method: 'POST',
                body: input,
              })
              if (
                result?.story?.id !== id ||
                result.story.status !==
                  ({ unpublish: 'unpublished', republish: 'published' }[action] ?? story.status) ||
                !Number.isSafeInteger(result.story.version) ||
                result.story.version <= story.version
              )
                throw new Error(m('failed'))
              onChanged()
            } catch (failure) {
              setError(failure.message || m('failed'))
            } finally {
              lock.current = false
              setBusy(false)
            }
          }}
        >
          <p className="font-semibold break-words">{story.title}</p>
          <p className="mt-2 text-sm text-muted">{m('hint')}</p>
          <label className="mt-4 block text-sm font-medium">
            {m('action')}
            <Select
              className="mt-2"
              disabled={busy}
              value={action}
              onChange={event => setAction(event.target.value)}
            >
              <option value="correct">{m('correct')}</option>
              <option value={story.status === 'published' ? 'unpublish' : 'republish'}>
                {m(story.status === 'published' ? 'unpublish' : 'republish')}
              </option>
            </Select>
          </label>
          <div className={action === 'correct' ? 'mt-4 space-y-4' : 'hidden'}>
            <label className="block text-sm font-medium">
              {m('story')}
              <Input
                className="mt-2"
                name="title"
                defaultValue={story.title}
                maxLength={200}
                required={action === 'correct'}
                disabled={busy}
              />
            </label>
            <label className="block text-sm font-medium">
              {m('summary')}
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-surface p-3 text-ink"
                name="description"
                defaultValue={story.description}
                maxLength={10000}
                required={action === 'correct'}
                disabled={busy}
              />
            </label>
            {categories.status === 'ready' ? (
              <label className="block text-sm font-medium">
                {m('categories')}
                <Select
                  className="mt-2"
                  name="categoryId"
                  defaultValue={story.categoryId}
                  required={action === 'correct'}
                  disabled={busy}
                >
                  {categories.data.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <div>
                <p className="text-sm font-medium">{m('categories')}</p>
                <p role="status" className="mt-2 text-sm text-muted">
                  {m('categoriesUnavailable')}
                </p>
              </div>
            )}
          </div>
          <label className="mt-4 block text-sm font-medium">
            {m('reason')}
            <Input className="mt-2" name="reason" required maxLength={1000} disabled={busy} />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-strong">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              {m('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={busy || (action === 'correct' && categories.status !== 'ready')}
            >
              {m(busy ? 'saving' : action)}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
