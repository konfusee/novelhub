import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileSearch,
  History,
  RotateCcw,
  Search,
} from '../../components/icons'
import { AdminLayout, AuthorLayout, ModeratorLayout, ReaderLayout } from '../../layouts'
import { Badge, Button, Card, EmptyState, Input, ProgressBar, Skeleton } from '../../components/ui'
import { useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'

const layouts = {
  reader: ReaderLayout,
  author: AuthorLayout,
  moderator: ModeratorLayout,
  admin: AdminLayout,
}

const statusTone = { active: 'green', review: 'orange', resolved: 'purple' }
const emptyActivity = Object.freeze([])

/* Same grid template as the activity rows so placeholders keep each row's height. */
const rowGrid =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_11rem_auto] sm:px-6'
const statTones = {
  brand: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
}

export function RoleUtilityPage({ role, eyebrow, title, description }) {
  const Layout = layouts[role]
  const { t } = useLocale()
  const activity = useBackendResource('/workspace/activity', emptyActivity)
  const [query, setQuery] = useState('')
  const records = activity.data.map(row => ({
    ...row,
    name: row.title,
    time: row.updatedAt ? new Date(row.updatedAt).toLocaleString('vi-VN') : '—',
    status: row.status === 'Chưa đọc' ? 'review' : 'resolved',
  }))
  const keyword = query.trim().toLowerCase()
  const visible = keyword
    ? records.filter(row => `${row.id} ${row.name}`.toLowerCase().includes(keyword))
    : records
  const loading = activity.status === 'loading'
  const ready = activity.status === 'ready' || activity.status === 'empty'
  const openCount = records.filter(row => row.status !== 'resolved').length
  const reviewCount = records.filter(row => row.status === 'review').length
  const resolvedCount = records.length - openCount
  const completedPercent = records.length ? Math.round((resolvedCount / records.length) * 100) : 0

  const stats = [
    { label: t('workspace.openItems'), value: openCount, icon: Activity, tone: 'brand' },
    { label: t('workspace.dueToday'), value: reviewCount, icon: Clock3, tone: 'orange' },
    {
      label: t('workspace.completed'),
      value: `${completedPercent}%`,
      icon: CheckCircle2,
      tone: 'purple',
      progress: completedPercent,
    },
  ]

  return (
    <Layout>
      <div className="page-shell space-y-6 pt-6 sm:pt-8">
        <Card as="header" className="p-6 sm:p-8">
          {eyebrow && <p className="nh-eyebrow">{eyebrow}</p>}
          <h1 className="mt-3 text-h2 sm:text-h1">{title}</h1>
          {description && (
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">{description}</p>
          )}
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {stats.map(({ label, value, icon: Icon, tone, progress }) => (
            <Card key={label} className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-5">
              <div className="flex flex-col items-start gap-2 sm:gap-4 lg:flex-row lg:items-center">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-2xl sm:size-11 ${statTones[tone]}`}
                >
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <strong className="block text-h3 tabular-nums sm:text-h2">
                    {loading ? (
                      <span className="flex h-7 items-center sm:h-8">
                        <span className="sr-only">{t('workspace.loading')}</span>
                        <Skeleton className="h-5 w-10 sm:h-6 sm:w-14" />
                      </span>
                    ) : ready ? (
                      value
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </strong>
                  <span className="block text-xs text-muted sm:text-sm">{label}</span>
                </div>
              </div>
              {progress !== undefined &&
                (loading ? (
                  <Skeleton className="h-1.5 w-full" />
                ) : (
                  ready && <ProgressBar value={progress} tone="purple" size="sm" label={label} />
                ))}
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-hairline p-5 sm:flex-row sm:items-center sm:px-6">
            <div className="min-w-0">
              <h2 className="text-h3">{t('workspace.recentActivity')}</h2>
              <p className="mt-0.5 text-sm text-muted">{t('workspace.latestChanges')}</p>
            </div>
            <Input
              icon={Search}
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              disabled={!ready || !records.length}
              aria-label={t('workspace.searchRecords')}
              placeholder={t('workspace.searchRecords')}
              className="w-full sm:ml-auto sm:w-72"
            />
          </div>

          {loading && (
            <div aria-busy="true" aria-label={t('workspace.loading')}>
              <ul aria-hidden="true" className="divide-y divide-hairline">
                {Array.from({ length: 3 }, (_, index) => (
                  <li key={index} className={rowGrid}>
                    <span className="flex h-4 items-center">
                      <Skeleton className="h-3 w-16" />
                    </span>
                    <span className="row-span-2 self-center justify-self-end sm:order-last sm:row-span-1">
                      <Skeleton className="h-6 w-24" />
                    </span>
                    <span className="flex h-5 items-center">
                      <Skeleton className="h-3.5 w-3/4" />
                    </span>
                    <span className="col-span-2 flex h-4 items-center sm:col-span-1 sm:h-5">
                      <Skeleton className="h-3 w-32" />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="flex h-10 items-center border-t border-hairline px-5 sm:px-6">
                <Skeleton className="h-3 w-24" />
              </p>
            </div>
          )}

          {activity.status === 'error' && (
            <EmptyState
              tone="rose"
              headingAs="h3"
              icon={AlertTriangle}
              title={t('workspace.errorTitle')}
              description={t('workspace.errorHint')}
              action={
                <Button variant="secondary" size="sm" onClick={activity.retry}>
                  <RotateCcw size={15} />
                  {t('workspace.retry')}
                </Button>
              }
            />
          )}

          {ready && !records.length && (
            <EmptyState
              icon={History}
              headingAs="h3"
              title={t('workspace.emptyTitle')}
              description={t('workspace.emptyHint')}
            />
          )}

          {ready && records.length > 0 && !visible.length && (
            <EmptyState
              icon={FileSearch}
              headingAs="h3"
              title={t('workspace.noResults')}
              description={t('workspace.noResultsHint')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                  {t('workspace.clearSearch')}
                </Button>
              }
            />
          )}

          {ready && visible.length > 0 && (
            <div className="nh-fade-enter">
              <ul className="divide-y divide-hairline">
                {visible.map(row => (
                  <li
                    key={row.id}
                    className={`${rowGrid} transition-colors duration-200 hover:bg-ink/[0.025]`}
                  >
                    <span className="font-mono text-xs text-muted">{row.id}</span>
                    <span className="row-span-2 self-center justify-self-end sm:order-last sm:row-span-1">
                      <Badge tone={statusTone[row.status]} className="whitespace-nowrap">
                        {t(`workspace.status.${row.status}`)}
                      </Badge>
                    </span>
                    <strong className="min-w-0 truncate text-sm font-semibold">{row.name}</strong>
                    <span className="col-span-2 text-xs text-muted sm:col-span-1 sm:text-sm">
                      {row.time}
                    </span>
                  </li>
                ))}
              </ul>
              <p
                className="border-t border-hairline px-5 py-3 text-xs text-muted sm:px-6"
                aria-live="polite"
              >
                {t('workspace.recordCount', { count: visible.length })}
              </p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
