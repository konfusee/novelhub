import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  BookOpen,
  Headphones,
  History,
  RefreshCw,
  Trash2,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { StoryCover } from '../../components/story/StoryCover'
import { chapterLabel } from '../../components/reader/chapterLabel'
import { formatWhen } from '../../components/reader/readerLinks'
import { useReaderFeed } from '../../components/reader/useReaderFeed'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Modal,
  ProgressBar,
  Skeleton,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'
import { apiRequest } from '../../api/client'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const SKELETONS = 5

function EntrySkeleton() {
  return (
    <li aria-hidden="true">
      <Card as="div" className="flex gap-4 p-4">
        <Skeleton className="h-24 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <span className="flex h-6 items-center">
            <Skeleton className="h-4 w-3/5" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-2/5" />
          </span>
          <div className="mt-3 flex h-4 items-center gap-3">
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-3 w-10" />
          </div>
          <span className="mt-2 flex h-4 items-center">
            <Skeleton className="h-2.5 w-32" />
          </span>
        </div>
        <Skeleton className="hidden h-9 w-28 shrink-0 self-center sm:block" />
      </Card>
    </li>
  )
}

/* One history row (GET /reader/history): mode, chapter, progress, badges, resume and remove. */
function HistoryEntry({ entry, onRemove, t }) {
  const { story, chapter } = entry
  const audio = entry.mode === 'audio'
  /* `percent`: the paragraph reached out of the chapter's paragraphs (100 once finished). */
  const percent = entry.percent ?? 0
  const href = !chapter.available
    ? ROUTES.story(story.id)
    : audio
      ? ROUTES.listen(story.id, chapter.id)
      : `${ROUTES.read(story.id, chapter.id)}${entry.contentUpdated ? '?updated=1' : ''}`
  const ModeIcon = audio ? Headphones : BookOpen
  return (
    <li>
      <Card as="article" className="flex gap-4 p-4">
        <Link to={ROUTES.story(story.id)} tabIndex={-1} aria-hidden="true" className="shrink-0">
          <StoryCover story={story} className="h-24 w-16 rounded-xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-base font-semibold" title={story.title}>
            <Link to={ROUTES.story(story.id)} className="transition-colors hover:text-brand">
              {story.title}
            </Link>
          </h2>
          <p className="truncate text-xs text-muted">
            {story.author} · {chapterLabel(t, chapter)}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar
              value={entry.completed ? 100 : percent}
              size="sm"
              label={t('history.chapterProgress', { chapter: chapterLabel(t, chapter) })}
              className="flex-1"
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-strong">
              {entry.completed ? 100 : percent}%
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={audio ? 'purple' : 'neutral'}>
              <ModeIcon size={12} aria-hidden="true" />
              {t(audio ? 'history.modeAudio' : 'history.modeText')}
            </Badge>
            <span className="mr-1 text-xs text-muted">
              {t('history.lastRead', { when: formatWhen(entry.lastReadAt) })}
            </span>
            {entry.completed && <Badge tone="green">{t('history.completedBadge')}</Badge>}
            {entry.contentUpdated && <Badge tone="orange">{t('history.contentUpdated')}</Badge>}
            {!chapter.available && <Badge tone="rose">{t('history.unavailable')}</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2 sm:flex-row sm:items-center">
          <IconButton
            label={t('history.removeEntry', { title: story.title })}
            tone="rose"
            shape="circle"
            size="sm"
            onClick={() => onRemove(entry)}
          >
            <Trash2 size={15} />
          </IconButton>
          <ButtonLink to={href} size="sm" variant={chapter.available ? 'primary' : 'secondary'}>
            <ModeIcon size={14} aria-hidden="true" />
            <span className="hidden sm:inline">
              {chapter.available
                ? audio
                  ? t(entry.completed ? 'history.relisten' : 'history.resumeListening')
                  : t(entry.completed ? 'history.reread' : 'history.resume')
                : t('history.viewStory')}
            </span>
          </ButtonLink>
        </div>
      </Card>
    </li>
  )
}

export function ReadingHistoryPage() {
  const { t } = useLocale()
  const [page, setPage] = useState(1)
  const [confirm, setConfirm] = useState(null)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState(null)
  const history = useReaderFeed(`/reader/history?page=${page}`)
  const data = history.data
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const runConfirmed = async () => {
    setPending(true)
    setNotice(null)
    try {
      if (confirm === 'all') {
        await apiRequest('/reader/history', { method: 'DELETE' })
        setNotice(t('history.cleared'))
        if (page !== 1) setPage(1)
        else history.reload()
      } else {
        await apiRequest(`/reader/history/${encodeURIComponent(confirm.id)}`, {
          method: 'DELETE',
        })
        setNotice(t('history.removed'))
        if (data.items.length === 1 && page > 1) setPage(page - 1)
        else history.reload()
      }
      setConfirm(null)
    } catch (error) {
      setNotice(error.message)
      setConfirm(null)
    } finally {
      setPending(false)
    }
  }
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t('history.pageTitle')}</h1>
            <p className="mt-2 max-w-prose text-sm text-muted">{t('history.description')}</p>
          </div>
          <Button
            variant="secondary"
            disabled={!data?.items.length}
            onClick={() => setConfirm('all')}
          >
            <Trash2 size={15} />
            {t('history.clear')}
          </Button>
        </div>
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-2xl bg-brand-soft px-4 py-3 text-sm text-brand-strong"
          >
            {notice}
          </p>
        )}
        {history.status === 'loading' ? (
          <ul aria-busy="true" aria-label={t('history.loading')} className="mt-6 space-y-3">
            {Array.from({ length: SKELETONS }, (_, index) => (
              <EntrySkeleton key={index} />
            ))}
          </ul>
        ) : history.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={t('history.error')}
              description={history.error?.message}
              action={
                <Button variant="secondary" size="sm" onClick={history.retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  {t('history.retry')}
                </Button>
              }
            />
          </Card>
        ) : !data.items.length ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={History}
              title={t('history.empty')}
              description={t('history.emptyDescription')}
              action={
                <ButtonLink to={ROUTES.library} variant="secondary" size="sm">
                  {t('history.openLibrary')}
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <>
            <ul aria-label={t('history.listLabel')} className="nh-fade-enter mt-6 space-y-3">
              {data.items.map(entry => (
                <HistoryEntry key={entry.id} entry={entry} onRemove={setConfirm} t={t} />
              ))}
            </ul>
            <div className="mt-6">
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          </>
        )}
      </div>
      <Modal
        open={Boolean(confirm)}
        title={t(confirm === 'all' ? 'history.clearTitle' : 'history.removeTitle')}
        onClose={() => !pending && setConfirm(null)}
      >
        <p className="text-sm leading-6 text-muted">
          {confirm === 'all'
            ? t('history.clearDescription')
            : confirm && t('history.removeDescription', { title: confirm.story.title })}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>
            {t('history.cancel')}
          </Button>
          <Button variant="danger" disabled={pending} onClick={runConfirmed}>
            {t(confirm === 'all' ? 'history.clearConfirm' : 'history.removeConfirm')}
          </Button>
        </div>
      </Modal>
    </ReaderLayout>
  )
}
