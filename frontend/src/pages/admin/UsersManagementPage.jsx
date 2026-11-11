import { ROUTES } from '../../app/routes'
import { useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from '../../components/icons'
import { AdminLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { AuthorApplications } from '../../components/admin/AuthorApplications'
import { AuthorRoleManagement } from '../../components/admin/AuthorRoleManagement'
import { AuthorAccountStatusDialog } from '../../components/admin/AuthorAccountStatusDialog'
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Input,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'
const emptyFeed = {
  items: [],
  total: 0,
  summary: {},
}
const emptyDetail = {
  account: {},
  stories: [],
  audit: [],
}
const roleTone = {
  reader: 'blue',
  author: 'green',
  moderator: 'orange',
  admin: 'purple',
}
const statusTone = {
  active: 'green',
  suspended: 'red',
  'pending-verification': 'orange',
  anonymized: 'neutral',
}
const cell = 'px-4 py-4 first:pl-5 last:pr-5'
export function UsersManagementPage() {
  const [accountRevision, setAccountRevision] = useState(0)
  const { t, formatDate, formatNumber } = useLocale()
  const [filter, setFilter] = useState({
    query: '',
    role: 'all',
    status: 'all',
    sort: 'newest',
    page: 1,
  })
  const resource = useBackendDocument(
    `/admin/accounts?${new URLSearchParams({
      ...filter,
      pageSize: 10,
    })}`,
    emptyFeed,
  )
  const loading = resource.status === 'loading'
  const [selectedId, setSelectedId] = useState(null)
  const inspectorTitleRef = useRef(null)
  const selected = resource.data.items.find(user => user.id === selectedId)
  const update = values => {
    setFilter(current => ({
      ...current,
      ...values,
      page: 1,
    }))
    setSelectedId(null)
  }
  const summary = resource.data.summary
  const count = key => (resource.status === 'ready' ? formatNumber(summary[key] ?? 0) : '—')
  const closeInspector = () => {
    const id = selectedId
    setSelectedId(null)
    requestAnimationFrame(() => document.querySelector(`[data-inspect="${id}"]`)?.focus())
  }
  const inspect = user => {
    setSelectedId(user.id)
    requestAnimationFrame(() => inspectorTitleRef.current?.focus())
  }
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-ink/70">{t('adminAccounts.breadcrumb')}</p>
            <h1 className="mt-1 text-h2 sm:text-h1">{t('adminAccounts.title')}</h1>
            <p className="mt-2 text-caption text-ink/70">
              {t('adminAccounts.summary', {
                accounts: count('accounts'),
                authors: count('authors'),
                staff:
                  resource.status === 'ready'
                    ? formatNumber((summary.moderators ?? 0) + (summary.admins ?? 0))
                    : '—',
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled title={t('adminAccounts.unavailable')}>
              <Download size={16} />
              {t('adminAccounts.export')}
            </Button>
            <Button disabled title={t('adminAccounts.unavailable')}>
              <UserPlus size={16} />
              {t('adminAccounts.invite')}
            </Button>
          </div>
        </header>
        <AuthorApplications />
        <AuthorRoleManagement key={accountRevision} onChanged={resource.retry} />
        <Card className="mt-6 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Input
              icon={Search}
              type="search"
              maxLength={100}
              value={filter.query}
              onChange={event =>
                update({
                  query: event.target.value,
                })
              }
              aria-label={t('adminAccounts.search')}
              placeholder={t('adminAccounts.search')}
              className="sm:col-span-2 xl:col-span-1"
            />
            <Select
              aria-label={t('adminAccounts.statusFilter')}
              value={filter.status}
              onChange={event =>
                update({
                  status: event.target.value,
                })
              }
            >
              <option value="all">{t('adminAccounts.allStatuses')}</option>
              {Object.keys(statusTone).map(status => (
                <option key={status} value={status}>
                  {t(`adminAccounts.statuses.${status}`)}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('adminAccounts.sortLabel')}
              value={filter.sort}
              onChange={event =>
                update({
                  sort: event.target.value,
                })
              }
            >
              {['newest', 'oldest', 'stories'].map(sort => (
                <option key={sort} value={sort}>
                  {t(`adminAccounts.sort.${sort}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-4 min-w-0">
            <Tabs
              label={t('adminAccounts.roleFilter')}
              singleRow
              value={filter.role}
              onChange={role =>
                update({
                  role,
                })
              }
              items={['all', 'reader', 'author', 'moderator', 'admin'].map(role => ({
                value: role,
                label: t('adminAccounts.roleCount', {
                  role: t(`adminAccounts.roles.${role}`),
                  count: count(
                    {
                      all: 'accounts',
                      reader: 'readers',
                      author: 'authors',
                      moderator: 'moderators',
                      admin: 'admins',
                    }[role],
                  ),
                }),
              }))}
            />
          </div>
        </Card>
        <div
          className={`nh-grid-12 mt-5 grid items-start gap-5 ${selected ? 'nh-layout-2xl-8-4' : ''}`}
        >
          <Card className="overflow-hidden p-0">
            {!loading && resource.status !== 'ready' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title={t('adminAccounts.failed')}
                description={resource.error?.message}
                action={
                  <Button variant="secondary" onClick={resource.retry}>
                    <RefreshCw size={15} />
                    {t('adminAccounts.reload')}
                  </Button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table
                    aria-busy={loading}
                    className="w-full whitespace-nowrap text-left text-sm md:min-w-[820px]"
                  >
                    <caption className="sr-only">{t('adminAccounts.table')}</caption>
                    <thead className="border-b border-hairline bg-elevated text-[11px] uppercase tracking-[.12em] text-ink/70">
                      <tr>
                        {['identity', 'role', 'status', 'joined', 'activity', 'actions'].map(
                          key => (
                            <th
                              key={key}
                              scope="col"
                              className={`${cell} py-3 font-semibold ${['joined', 'activity'].includes(key) ? 'hidden md:table-cell' : ''} ${key === 'actions' ? 'text-right' : ''}`}
                            >
                              {t(`adminAccounts.columns.${key}`)}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className={`divide-y divide-hairline ${loading ? '' : 'nh-fade-enter'}`}>
                      {loading
                        ? Array.from(
                            {
                              length: 5,
                            },
                            (_, index) => <SkeletonRow key={index} />,
                          )
                        : resource.data.items.map(user => (
                            <tr
                              key={user.id}
                              onClick={() => inspect(user)}
                              className={`cursor-pointer transition-colors ${selectedId === user.id ? 'bg-brand/10' : 'hover:bg-elevated/70'}`}
                            >
                              <td className={cell}>
                                <div className="flex items-center gap-3">
                                  <Avatar name={user.name} />
                                  <div className="min-w-0">
                                    <strong className="block font-semibold">{user.name}</strong>
                                    <span className="text-xs text-muted">#{user.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td className={cell}>
                                <Badge tone={roleTone[user.roles[0] ?? 'reader']}>
                                  {t(`adminAccounts.roles.${user.roles[0] ?? 'reader'}`)}
                                </Badge>
                              </td>
                              <td className={cell}>
                                <Badge tone={statusTone[user.status]}>
                                  {t(`adminAccounts.statuses.${user.status}`)}
                                </Badge>
                              </td>
                              <td className={`${cell} hidden md:table-cell`}>
                                {formatDate(user.createdAt)}
                              </td>

                              <td className={`${cell} hidden md:table-cell`}>
                                {t('adminAccounts.stories', {
                                  count: formatNumber(user.storyCount),
                                })}
                              </td>
                              <td className={`${cell} text-right`}>
                                <Button
                                  data-inspect={user.id}
                                  size="sm"
                                  variant={selectedId === user.id ? 'outline' : 'secondary'}
                                  aria-pressed={selectedId === user.id}
                                  onClick={event => {
                                    event.stopPropagation()
                                    inspect(user)
                                  }}
                                >
                                  {t('adminAccounts.inspect')}
                                </Button>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
                {!loading && !resource.data.items.length && (
                  <EmptyState
                    icon={UsersRound}
                    title={t('adminAccounts.empty')}
                    action={
                      <Button
                        variant="secondary"
                        onClick={() =>
                          update({
                            query: '',
                            role: 'all',
                            status: 'all',
                          })
                        }
                      >
                        {t('adminAccounts.clear')}
                      </Button>
                    }
                  />
                )}
                <div className="flex flex-col justify-between gap-3 border-t border-hairline px-5 py-4 text-caption text-muted sm:flex-row sm:items-center">
                  <span>
                    {loading
                      ? t('adminAccounts.loading')
                      : t('adminAccounts.shown', {
                          count: resource.data.items.length,
                          total: formatNumber(resource.data.total),
                        })}
                  </span>
                  <nav aria-label={t('adminAccounts.pagination')} className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={loading || filter.page === 1}
                      onClick={() => {
                        setSelectedId(null)
                        setFilter({
                          ...filter,
                          page: filter.page - 1,
                        })
                      }}
                    >
                      {t('authorRevocation.previous')}
                    </Button>
                    <Button size="sm" aria-current="page" disabled>
                      {filter.page}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={loading || filter.page * 10 >= resource.data.total}
                      onClick={() => {
                        setSelectedId(null)
                        setFilter({
                          ...filter,
                          page: filter.page + 1,
                        })
                      }}
                    >
                      {t('authorRevocation.next')}
                    </Button>
                  </nav>
                </div>
              </>
            )}
          </Card>
          {selected && (
            <UserInspector
              key={selected.id}
              user={selected}
              titleRef={inspectorTitleRef}
              onClose={closeInspector}
              onChanged={() => {
                closeInspector()
                resource.retry()
                setAccountRevision(value => value + 1)
              }}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
function UserInspector({ user, titleRef, onClose, onChanged }) {
  const { t, formatDate, formatNumber } = useLocale()
  const detail = useBackendDocument(`/admin/accounts/${user.id}`, emptyDetail)
  const [statusDialog, setStatusDialog] = useState(false)
  return (
    <aside
      aria-labelledby="user-inspector-title"
      className="grid content-start gap-4 md:grid-cols-2 2xl:sticky 2xl:top-24 2xl:grid-cols-1"
    >
      <Card className="md:col-span-2 2xl:col-span-1">
        <div className="flex items-start gap-3">
          <Avatar name={user.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <h2
              id="user-inspector-title"
              ref={titleRef}
              tabIndex={-1}
              className="text-h3 outline-none"
            >
              {user.name}
            </h2>
            <p className="mt-1 break-all text-xs text-muted">#{user.id}</p>
            <Badge tone={statusTone[user.status]}>
              {t(`adminAccounts.statuses.${user.status}`)}
            </Badge>
          </div>
          <IconButton label={t('adminAccounts.close')} shape="circle" size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        {user.roles.includes('author') && (
          <ButtonLink to={ROUTES.adminUser(user.id)} variant="secondary" size="sm" className="mt-4">
            {t('agreement.title')}
          </ButtonLink>
        )}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {detail.status === 'ready' &&
            ['active', 'suspended', 'pending-verification'].includes(
              detail.data.account.status,
            ) && (
              <>
                {detail.data.account.status !== 'pending-verification' && (
                  <Button variant="secondary" size="sm" onClick={() => setStatusDialog('status')}>
                    {t(
                      `authorAccountStatus.${detail.data.account.status === 'active' ? 'suspend' : 'restore'}`,
                    )}
                  </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => setStatusDialog('close')}>
                  {t('authorAccountStatus.close')}
                </Button>
              </>
            )}
        </div>
      </Card>
      {statusDialog && (
        <AuthorAccountStatusDialog
          account={detail.data.account}
          closeAccount={statusDialog === 'close'}
          onClose={() => setStatusDialog(false)}
          onChanged={onChanged}
        />
      )}
      {detail.status !== 'ready' ? (
        <Card className="md:col-span-2 2xl:col-span-1">
          <p role={detail.status === 'loading' ? 'status' : 'alert'} className="text-sm text-muted">
            {detail.status === 'loading'
              ? t('adminAccounts.loading')
              : detail.error?.message || t('adminAccounts.failed')}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            disabled={detail.status === 'loading'}
            onClick={detail.retry}
          >
            {t('adminAccounts.reload')}
          </Button>
        </Card>
      ) : (
        <>
          <InfoCard title={t('adminAccounts.info')} icon={ShieldCheck}>
            <Row label={t('adminAccounts.email')} value={detail.data.account.email ?? '—'} />
            <Row
              label={t('adminAccounts.columns.role')}
              value={
                user.roles.length
                  ? user.roles.map(role => t(`adminAccounts.roles.${role}`)).join(', ')
                  : t('adminAccounts.roles.reader')
              }
            />
            <Row
              label={t('adminAccounts.columns.joined')}
              value={formatDate(detail.data.account.createdAt)}
            />
          </InfoCard>
          <InfoCard title={t('adminAccounts.authoring')} icon={BookOpen}>
            <Row label={t('adminAccounts.storyTotal')} value={formatNumber(user.storyCount)} />
            <ul className="mt-3 space-y-2 text-sm">
              {detail.data.stories.map(story => (
                <li key={story.id} className="break-words">
                  {story.title}
                </li>
              ))}
            </ul>
            {!detail.data.stories.length && (
              <p className="text-sm text-muted">{t('adminAccounts.noStories')}</p>
            )}
          </InfoCard>

          <InfoCard title={t('adminAccounts.audit')} icon={CheckCircle2}>
            <ol className="space-y-3 text-sm">
              {detail.data.audit.map(event => (
                <li key={event.id}>
                  <strong className="break-words">{event.action}</strong>
                  <p className="text-xs text-muted">
                    {event.result} · {formatDate(event.occurredAt)}
                  </p>
                </li>
              ))}
            </ol>
            {!detail.data.audit.length && (
              <p className="text-sm text-muted">{t('adminAccounts.noAudit')}</p>
            )}
          </InfoCard>
        </>
      )}
    </aside>
  )
}
function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className={cell}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </td>
      <td className={cell}>
        <Skeleton className="h-6 w-24" />
      </td>
      <td className={cell}>
        <Skeleton className="h-6 w-28" />
      </td>
      {['w-20', 'w-24'].map(width => (
        <td key={width} className={`${cell} hidden md:table-cell`}>
          <Skeleton className={`h-3.5 ${width}`} />
          <Skeleton className="mt-2 h-3 w-14" />
        </td>
      ))}
      <td className={`${cell} text-right`}>
        <Skeleton className="ml-auto h-9 w-[5.5rem]" />
      </td>
    </tr>
  )
}
function InfoCard({ title, icon: Icon, loading = false, children }) {
  return (
    <Card className={`p-5 ${loading ? '' : 'nh-fade-enter'}`}>
      <h3 className="flex items-center justify-between gap-3 text-base font-semibold">
        {title}
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-strong">
          <Icon size={16} aria-hidden="true" />
        </span>
      </h3>
      <div className="mt-3">{children}</div>
    </Card>
  )
}
function Row({ label, value }) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-hairline py-3 text-sm last:border-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-muted">{label}</span>
      <strong className="break-all font-semibold sm:text-right">{value}</strong>
    </div>
  )
}
