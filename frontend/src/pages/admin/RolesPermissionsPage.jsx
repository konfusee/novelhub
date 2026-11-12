import { useState } from 'react'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Select, Skeleton } from '../../components/ui'
import { useBackendDocument } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { AuthorRoleManagement } from '../../components/admin/AuthorRoleManagement'

const emptyRoles = { roles: [] }
const emptyAccounts = { items: [], total: 0 }
export function RolesPermissionsPage() {
  const { t, formatNumber } = useLocale()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [saved, setSaved] = useState(false)
  const summary = useBackendDocument('/admin/roles', emptyRoles)
  const accounts = useBackendDocument(
    `/admin/accounts?query=${encodeURIComponent(query)}&page=${page}&pageSize=10`,
    emptyAccounts,
  )
  const reload = () => {
    summary.retry()
    accounts.retry()
  }
  return (
    <AdminLayout>
      <div className="page-admin space-y-6 py-6">
        <header>
          <h1 className="text-h2 sm:text-h1">{t('staffRoles.title')}</h1>
          <p className="mt-2 text-muted">{t('staffRoles.hint')}</p>
        </header>
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy={summary.status === 'loading'}
        >
          {summary.status === 'loading' ? (
            <Skeleton className="h-24" />
          ) : (
            summary.data.roles.map(item => (
              <Card key={item.role}>
                <h2 className="text-sm text-muted">{t(`adminAccounts.roles.${item.role}`)}</h2>
                <p className="mt-2 text-h2">{formatNumber(item.count)}</p>
              </Card>
            ))
          )}
        </div>
        <Card>
          <label htmlFor="staff-role-search" className="font-semibold">
            {t('staffRoles.search')}
          </label>
          <Input
            id="staff-role-search"
            value={query}
            className="mt-3"
            onChange={event => {
              setQuery(event.target.value)
              setPage(1)
              setSaved(false)
            }}
          />
          {saved && (
            <p role="status" className="mt-3 text-brand-strong">
              {t('staffRoles.saved')}
            </p>
          )}
          {(summary.status === 'error' || accounts.status === 'error') && (
            <p role="alert" className="mt-3 text-rose-strong">
              {t('staffRoles.failed')}
            </p>
          )}
          <Button variant="secondary" className="mt-3" onClick={reload}>
            {t('policy.reload')}
          </Button>
          {accounts.status === 'loading' ? (
            <Skeleton className="mt-4 h-40" />
          ) : (
            <ul className="mt-4 divide-y divide-hairline">
              {accounts.data.items.map(account => (
                <li
                  key={account.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold break-words">{account.name}</p>
                    <p className="break-all text-sm text-muted">{account.email ?? '—'}</p>
                    <Badge>{t(`adminAccounts.roles.${account.roles[0] ?? 'reader'}`)}</Badge>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={
                      accounts.status !== 'ready' ||
                      account.status !== 'active' ||
                      account.roles.some(role => role === 'author' || role === 'admin')
                    }
                    onClick={() => setSelected(account)}
                  >
                    {t('staffRoles.change')}
                  </Button>
                </li>
              ))}
              {!accounts.data.items.length && (
                <li className="py-4 text-muted">{t('staffRoles.empty')}</li>
              )}
            </ul>
          )}
          <nav className="mt-4 flex flex-wrap gap-3" aria-label={t('staffRoles.pages')}>
            <Button
              variant="secondary"
              disabled={page === 1 || accounts.status !== 'ready'}
              onClick={() => setPage(value => value - 1)}
            >
              {t('authorRevocation.previous')}
            </Button>
            <Button
              variant="secondary"
              disabled={page * 10 >= accounts.data.total || accounts.status !== 'ready'}
              onClick={() => setPage(value => value + 1)}
            >
              {t('authorRevocation.next')}
            </Button>
          </nav>
        </Card>
        <AuthorRoleManagement />
        {selected && (
          <StaffRoleDialog
            account={selected}
            onClose={() => setSelected(null)}
            onSaved={() => {
              setSelected(null)
              setSaved(true)
              reload()
            }}
          />
        )}
      </div>
    </AdminLayout>
  )
}
function StaffRoleDialog({ account, onClose, onSaved }) {
  const { t } = useLocale()
  const [role, setRole] = useState(account.roles.includes('moderator') ? 'moderator' : 'reader')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <Modal open title={t('staffRoles.change')} onClose={() => !busy && onClose()}>
      <form
        onSubmit={async event => {
          event.preventDefault()
          if (busy || !reason.trim()) return
          setBusy(true)
          setError('')
          try {
            const response = await apiRequest(`/admin/accounts/${account.id}/role`, {
              method: 'POST',
              body: { role, reason: reason.trim(), expectedVersion: account.version },
            })
            if (response?.account?.id !== account.id || response.account.role !== role)
              throw new Error(t('staffRoles.failed'))
            onSaved()
          } catch (failure) {
            setError(failure.message || t('staffRoles.failed'))
          } finally {
            setBusy(false)
          }
        }}
      >
        <p className="font-semibold break-words">{account.name}</p>
        <p className="mt-2 text-sm text-muted">{t('staffRoles.confirmHint')}</p>
        <label htmlFor="staff-role" className="mt-4 block text-sm">
          {t('adminAccounts.columns.role')}
        </label>
        <Select
          id="staff-role"
          value={role}
          onChange={event => setRole(event.target.value)}
          disabled={busy}
          className="mt-2"
        >
          {['reader', 'moderator'].map(value => (
            <option key={value} value={value}>
              {t(`adminAccounts.roles.${value}`)}
            </option>
          ))}
        </Select>
        <label htmlFor="staff-role-reason" className="mt-4 block text-sm">
          {t('policy.reason')}
        </label>
        <Input
          id="staff-role-reason"
          className="mt-2"
          required
          maxLength={1000}
          disabled={busy}
          value={reason}
          onChange={event => setReason(event.target.value)}
        />
        {error && (
          <p role="alert" className="mt-3 text-rose-strong">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t('authorAccountStatus.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={busy || !reason.trim() || role === (account.roles[0] ?? 'reader')}
          >
            {t(busy ? 'policy.saving' : 'staffRoles.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
