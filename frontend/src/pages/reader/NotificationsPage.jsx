import { Fragment, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCheck,
  MessageCircle,
  RefreshCw,
  Trash2,
  UserRound,
  WalletCards,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { apiRequest } from '../../api/client'
import { formatWhen } from '../../components/reader/readerLinks'
import { useLocale } from '../../context/LocaleContext'
import { notifyNotificationsChanged } from '../../api/notificationEvents'

/* Filters map to the `type` of each notification (see notificationView on the backend). */
const FILTERS = [
  ['all', Bell],
  ['story', BookOpen],
  ['author', UserRound],
  ['comment', MessageCircle],
  ['system', WalletCards],
]
const typeStyles = {
  story: { tone: 'green', tile: 'bg-brand/12 text-brand-strong', icon: BookOpen },
  author: { tone: 'purple', tile: 'bg-purple/12 text-purple-strong', icon: UserRound },
  comment: { tone: 'green', tile: 'bg-brand/12 text-brand-strong', icon: MessageCircle },
  system: { tone: 'orange', tile: 'bg-orange/16 text-orange-strong', icon: WalletCards },
}

function NotificationSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="p-4 sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <Skeleton className="size-11 shrink-0 rounded-2xl sm:size-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-24" />
          </div>
          <span className="mt-2 flex h-7 items-center">
            <Skeleton className="h-5 w-3/5" />
          </span>
          <span className="mt-1 flex max-w-prose flex-col gap-3 py-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </span>
          <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="ml-auto size-11 shrink-0" />
          </div>
        </div>
      </div>
    </Card>
  )
}

export function NotificationsPage({ embedded = false, workspace = 'reader' }) {
  const { t } = useLocale()
  const Layout = embedded ? Fragment : ReaderLayout
  /* Pages loaded so far are kept in one list; "load more" appends the next page. */
  const [feed, setFeed] = useState({ status: 'loading', items: [], page: 1, hasMore: false })
  const [unread, setUnread] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all')
  const [removed, setRemoved] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let controller
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      apiRequest('/reader/notifications?page=1', { signal })
        .then(response => {
          if (signal.aborted) return
          setFeed(current => {
            if (current.status === 'ready' && current.page > 1) {
              const newest = new Set(response.items.map(item => item.id))
              return {
                ...current,
                items: [...response.items, ...current.items.filter(item => !newest.has(item.id))],
              }
            }
            return { status: 'ready', items: response.items, page: 1, hasMore: response.hasMore }
          })
          setUnread(response.unreadCount)
        })
        .catch(failure => {
          if (!signal.aborted)
            setFeed(current =>
              current.status === 'ready'
                ? current
                : { status: 'error', items: [], page: 1, hasMore: false, error: failure },
            )
        })
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshVisible)
    const timer = window.setInterval(refreshVisible, 30000)
    return () => {
      controller?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [attempt])
  const retry = () => {
    setFeed({ status: 'loading', items: [], page: 1, hasMore: false })
    setAttempt(value => value + 1)
  }
  const act = async (request, apply) => {
    setError('')
    try {
      await request()
      apply()
      notifyNotificationsChanged()
    } catch (failure) {
      setError(failure.message)
    }
  }
  const setRead = (item, read) =>
    act(
      () =>
        apiRequest(`/reader/notifications/${encodeURIComponent(item.id)}`, {
          method: 'PUT',
          body: { read },
        }),
      () => {
        setFeed(current => ({
          ...current,
          items: current.items.map(entry =>
            entry.id === item.id ? { ...entry, read, unread: !read } : entry,
          ),
        }))
        if (item.unread === read) setUnread(count => Math.max(0, count + (read ? -1 : 1)))
      },
    )
  const markAll = () =>
    act(
      () => apiRequest('/reader/notifications/read-all', { method: 'POST' }),
      () => {
        setFeed(current => ({
          ...current,
          items: current.items.map(entry => ({ ...entry, read: true, unread: false })),
        }))
        setUnread(0)
      },
    )
  const remove = item =>
    act(
      () =>
        apiRequest(`/reader/notifications/${encodeURIComponent(item.id)}`, { method: 'DELETE' }),
      () => {
        setRemoved({ item, index: feed.items.indexOf(item) })
        setFeed(current => ({
          ...current,
          items: current.items.filter(entry => entry.id !== item.id),
        }))
        if (item.unread) setUnread(count => Math.max(0, count - 1))
      },
    )
  const undoRemove = () => {
    const { item, index } = removed
    act(
      () =>
        apiRequest(`/reader/notifications/${encodeURIComponent(item.id)}/restore`, {
          method: 'POST',
        }),
      () => {
        setFeed(current => {
          const items = [...current.items]
          items.splice(Math.min(index, items.length), 0, item)
          return { ...current, items }
        })
        if (item.unread) setUnread(count => count + 1)
        setRemoved(null)
      },
    )
  }
  const loadMore = async () => {
    setLoadingMore(true)
    setError('')
    try {
      const next = feed.page + 1
      const response = await apiRequest(`/reader/notifications?page=${next}`)
      setFeed(current => {
        const seen = new Set(current.items.map(entry => entry.id))
        return {
          ...current,
          items: [...current.items, ...response.items.filter(entry => !seen.has(entry.id))],
          page: next,
          hasMore: response.hasMore,
        }
      })
      setUnread(response.unreadCount)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setLoadingMore(false)
    }
  }
  const items = feed.items
  const shown = filter === 'all' ? items : items.filter(item => item.type === filter)
  const ready = feed.status === 'ready'
  return (
    <Layout>
      <div className={`page-${workspace} py-7`}>
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t('readerData.notifications.title')}</h1>
            <p className="mt-2 max-w-prose text-sm text-muted">
              {t('readerData.notifications.description')}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={markAll} disabled={!unread}>
            <CheckCheck size={16} />
            {t('readerData.notifications.markAll')}
          </Button>
        </div>
        <div className="mt-5">
          <Tabs
            label={t('readerData.notifications.filterLabel')}
            value={filter}
            onChange={setFilter}
            items={FILTERS.map(([value, Icon]) => {
              const label = t(`readerData.notifications.filter.${value}`)
              const count =
                value === 'all' ? items.length : items.filter(item => item.type === value).length
              return { value, icon: Icon, label: ready ? `${label} (${count})` : label }
            })}
          />
        </div>
        {ready && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${unread ? 'bg-brand' : 'bg-ink/25'}`}
              />
              {unread
                ? t('readerData.notifications.unreadCount', { count: unread })
                : t('readerData.notifications.allRead')}
            </span>
            {removed && (
              <span className="flex items-center gap-2 text-xs text-muted">
                {t('readerData.notifications.deleted')}
                <button
                  type="button"
                  onClick={undoRemove}
                  className="min-h-9 font-semibold text-brand-strong underline-offset-4 hover:underline"
                >
                  {t('readerData.notifications.undo')}
                </button>
              </span>
            )}
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-rose/10 px-4 py-3 text-sm text-rose-strong"
          >
            {error}
          </p>
        )}
        {feed.status === 'loading' ? (
          <section
            aria-busy="true"
            aria-label={t('readerData.notifications.loading')}
            className="mt-5 space-y-3"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <NotificationSkeleton key={index} />
            ))}
          </section>
        ) : feed.status === 'error' ? (
          <Card className="mt-5 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={t('readerData.notifications.error')}
              description={feed.error?.message}
              action={
                <Button variant="secondary" size="sm" onClick={retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {t('readerData.notifications.retry')}
                </Button>
              }
            />
          </Card>
        ) : (
          <section
            aria-label={t('readerData.notifications.listLabel')}
            className="nh-fade-enter mt-5 space-y-3"
          >
            {shown.map(item => {
              const style = typeStyles[item.type] || typeStyles.system
              const Icon = style.icon
              return (
                <Card
                  as="article"
                  key={item.id}
                  className={`p-4 sm:p-5 ${item.unread ? 'border-brand/45' : ''}`}
                >
                  <div className="flex gap-3 sm:gap-4">
                    <span
                      className={`relative grid size-11 shrink-0 place-items-center rounded-2xl sm:size-14 ${style.tile}`}
                    >
                      <Icon size={20} />
                      {item.unread && (
                        <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-surface bg-brand" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={style.tone}>{item.label}</Badge>
                        <span className="text-xs text-muted">{formatWhen(item.createdAt)}</span>
                        <span
                          className={`ml-auto text-xs ${item.unread ? 'font-semibold text-brand-strong' : 'text-muted'}`}
                        >
                          {t(
                            item.unread
                              ? 'readerData.notifications.unread'
                              : 'readerData.notifications.read',
                          )}
                        </span>
                      </div>
                      <h2 className="mt-2 break-words text-base font-semibold sm:text-h3">
                        {item.title}
                      </h2>
                      {item.body && (
                        <p className="mt-1 max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                          {item.body}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-3">
                        <ButtonLink
                          to={item.href}
                          size="sm"
                          onClick={() => {
                            if (item.unread) setRead(item, true)
                          }}
                        >
                          {item.action}
                        </ButtonLink>
                        <div className="ml-auto flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setRead(item, item.unread)}
                            className="min-h-9 rounded-full px-3 text-xs font-medium text-muted transition-colors hover:text-ink pointer-coarse:min-h-11"
                          >
                            {t(
                              item.unread
                                ? 'readerData.notifications.markRead'
                                : 'readerData.notifications.markUnread',
                            )}
                          </button>
                          <IconButton
                            label={t('readerData.notifications.delete', { title: item.title })}
                            tone="rose"
                            shape="circle"
                            size="md"
                            onClick={() => remove(item)}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
            {shown.length === 0 && (
              <Card className="p-0">
                <EmptyState
                  icon={Bell}
                  title={t(
                    items.length
                      ? 'readerData.notifications.filterEmpty'
                      : 'readerData.notifications.empty',
                  )}
                  description={t(
                    items.length
                      ? 'readerData.notifications.filterEmptyDescription'
                      : 'readerData.notifications.emptyDescription',
                  )}
                  action={
                    filter !== 'all' ? (
                      <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                        {t('readerData.notifications.showAll')}
                      </Button>
                    ) : (
                      <ButtonLink to="/reader/following" variant="secondary" size="sm">
                        {t('readerData.notifications.manageFollowing')}
                      </ButtonLink>
                    )
                  }
                />
              </Card>
            )}
          </section>
        )}
        {ready && (
          <div className="mt-6 flex flex-col justify-between gap-3 border-t border-hairline pt-5 text-xs text-muted sm:flex-row sm:items-center">
            <span>
              {feed.hasMore
                ? t('readerData.notifications.loaded', { count: items.length })
                : t('readerData.notifications.noMore')}
            </span>
            <Button variant="secondary" disabled={!feed.hasMore || loadingMore} onClick={loadMore}>
              {t('readerData.notifications.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
