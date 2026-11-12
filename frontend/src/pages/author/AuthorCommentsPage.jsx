import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
} from '../../components/ui'

const emptyComments = { items: [], stories: [], total: 0, page: 1, pageCount: 1, pageSize: 20 }
const statusTones = { visible: 'green', hidden: 'orange', 'soft-deleted': 'red' }

export function AuthorCommentsPage() {
  const { t, formatDate } = useLocale()
  const [page, setPage] = useState(1)
  const [storyId, setStoryId] = useState('')
  const [chapterId, setChapterId] = useState('')
  const [targetType, setTargetType] = useState('')
  const [status, setStatus] = useState('visible')
  const [replyTarget, setReplyTarget] = useState(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const query = `/author/comments?page=${page}${storyId ? `&storyId=${encodeURIComponent(storyId)}` : ''}${chapterId ? `&chapterId=${encodeURIComponent(chapterId)}` : ''}${targetType ? `&targetType=${targetType}` : ''}${status ? `&status=${status}` : ''}`
  const resource = useBackendDocument(query, emptyComments)
  const changeFilter = setter => event => {
    setter(event.target.value)
    setPage(1)
  }
  const selectStory = nextStory => {
    setStoryId(nextStory)
    setChapterId('')
    setTargetType('')
    setPage(1)
  }
  const selectChapter = nextChapter => {
    const chapter = (resource.data.chapters ?? []).find(item => item.id === nextChapter)
    setStoryId(chapter?.storyId ?? '')
    setChapterId(nextChapter)
    setTargetType('chapter')
    setPage(1)
  }
  const updateStatus = async (commentId, nextStatus) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/author/comments/${commentId}/status`, {
        method: 'PATCH',
        body: { status: nextStatus },
      })
      resource.retry()
    } catch (failure) {
      setError(failure.message || t('authorComments.saveError'))
    } finally {
      setBusy(false)
    }
  }
  const submitReply = async event => {
    event.preventDefault()
    if (!replyTarget || reply.trim().length < 1 || busy) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/author/comments/${replyTarget}/reply`, {
        method: 'POST',
        body: { body: reply.trim() },
      })
      setReply('')
      setReplyTarget(null)
      resource.retry()
    } catch (failure) {
      setError(failure.message || t('authorComments.saveError'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted">{t('authorComments.eyebrow')}</p>
            <h1 className="mt-2 text-h1">{t('authorComments.title')}</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">
              {t('authorComments.hint')}
            </p>
          </div>
          <Button variant="secondary" onClick={resource.retry}>
            <RefreshCw size={16} aria-hidden="true" />
            {t('authorComments.refresh')}
          </Button>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <Card>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-xs font-semibold text-muted" htmlFor="comments-story">
                  {t('authorComments.story')}
                  <Select
                    id="comments-story"
                    className="mt-1 w-full"
                    value={storyId}
                    onChange={event => selectStory(event.target.value)}
                  >
                    <option value="">{t('authorComments.allStories')}</option>
                    {resource.data.stories.map(story => (
                      <option key={story.id} value={story.id}>
                        {story.title}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-xs font-semibold text-muted" htmlFor="comments-target">
                  {t('authorComments.target')}
                  <Select
                    id="comments-target"
                    className="mt-1 w-full"
                    value={targetType}
                    onChange={changeFilter(setTargetType)}
                  >
                    <option value="">{t('authorComments.allTargets')}</option>
                    <option value="story">{t('authorComments.storyComments')}</option>
                    <option value="chapter">{t('authorComments.chapterComments')}</option>
                  </Select>
                </label>
                <label className="text-xs font-semibold text-muted" htmlFor="comments-status">
                  {t('authorComments.status')}
                  <Select
                    id="comments-status"
                    className="mt-1 w-full"
                    value={status}
                    onChange={changeFilter(setStatus)}
                  >
                    <option value="">{t('authorComments.allStatuses')}</option>
                    <option value="visible">{t('authorComments.visible')}</option>
                    <option value="hidden">{t('authorComments.hidden')}</option>
                    <option value="soft-deleted">{t('authorComments.deleted')}</option>
                  </Select>
                </label>
              </div>
            </Card>

            {error && (
              <p className="mt-4 text-sm text-rose-strong" role="alert">
                {error}
              </p>
            )}
            <Card className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-h3">{t('authorComments.listTitle')}</h2>
                {resource.status === 'ready' && (
                  <Badge tone="green">
                    {resource.data.total} {t('authorComments.commentUnit')}
                  </Badge>
                )}
              </div>
              {resource.status === 'loading' ? (
                <div aria-busy="true" className="mt-5 space-y-3">
                  {[0, 1, 2].map(item => (
                    <Skeleton key={item} className="h-40 w-full" />
                  ))}
                </div>
              ) : resource.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title={t('authorComments.loadError')}
                  action={<Button onClick={resource.retry}>{t('authorComments.retry')}</Button>}
                />
              ) : !resource.data.items.length ? (
                <EmptyState
                  className="mt-5"
                  icon={MessageCircle}
                  title={t('authorComments.empty')}
                  description={t('authorComments.emptyHint')}
                />
              ) : (
                <div className="mt-5 space-y-4">
                  {resource.data.items.map(item => (
                    <CommentCard
                      key={item.id}
                      item={item}
                      t={t}
                      formatDate={formatDate}
                      busy={busy}
                      setReplyTarget={setReplyTarget}
                      onStatus={updateStatus}
                    />
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(value => value - 1)}
                    >
                      {t('authorComments.previous')}
                    </Button>
                    <span className="text-sm tabular-nums">
                      {t('authorComments.pageOf', {
                        page: resource.data.page,
                        pageCount: resource.data.pageCount,
                      })}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= resource.data.pageCount}
                      onClick={() => setPage(value => value + 1)}
                    >
                      {t('authorComments.next')}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            <form onSubmit={submitReply} className="mt-5">
              <label htmlFor="author-comment-reply" className="text-sm font-semibold">
                {t('authorComments.replyLabel')}
              </label>
              <Input
                id="author-comment-reply"
                className="mt-2"
                value={reply}
                disabled={!replyTarget || busy}
                onChange={event => setReply(event.target.value)}
                placeholder={t('authorComments.replyPlaceholder')}
                trailing={
                  <button
                    type="submit"
                    className="grid size-8 place-items-center rounded-full bg-brand text-on-brand disabled:opacity-40"
                    disabled={!replyTarget || busy || !reply.trim()}
                    aria-label={t('authorComments.sendReply')}
                  >
                    <Send size={14} aria-hidden="true" />
                  </button>
                }
              />
              <p className="mt-2 text-xs text-muted">
                {replyTarget ? t('authorComments.replyReady') : t('authorComments.selectReply')}
              </p>
            </form>
          </div>
          <aside
            className="min-w-0 xl:sticky xl:top-24 xl:self-start"
            aria-label="Chuyển phạm vi bình luận"
          >
            <Card>
              <h2 className="text-sm font-semibold">{t('authorComments.sidebarTitle')}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{t('authorComments.sidebarHint')}</p>
              <div className="mt-4 space-y-1">
                <button
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${!storyId && !chapterId ? 'bg-brand text-on-brand' : 'hover:bg-elevated'}`}
                  onClick={() => selectStory('')}
                >
                  {t('authorComments.allStories')}
                </button>
                {resource.data.stories.map(story => {
                  const storyChapters = (resource.data.chapters ?? []).filter(
                    chapter => chapter.storyId === story.id,
                  )
                  return (
                    <div key={story.id}>
                      <button
                        type="button"
                        className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${storyId === story.id && !chapterId ? 'bg-brand text-on-brand' : 'hover:bg-elevated'}`}
                        onClick={() => selectStory(story.id)}
                      >
                        {story.title}
                      </button>
                      {storyChapters.length > 0 && (
                        <div className="ml-3 border-l border-hairline pl-2">
                          {storyChapters.map(chapter => (
                            <button
                              key={chapter.id}
                              type="button"
                              className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${chapterId === chapter.id ? 'bg-brand-soft text-brand-strong' : 'text-muted hover:bg-elevated'}`}
                              onClick={() => selectChapter(chapter.id)}
                            >
                              {chapter.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </AuthorLayout>
  )
}

function CommentCard({ item, t, formatDate, busy, setReplyTarget, onStatus }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <article className="rounded-2xl border border-hairline p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{item.author}</strong>
            <Badge tone={item.targetType === 'chapter' ? 'purple' : 'brand'}>
              {item.targetType === 'chapter'
                ? t('authorComments.chapterComments')
                : t('authorComments.storyComments')}
            </Badge>
            <Badge tone={statusTones[item.status] ?? 'neutral'}>
              {t(`authorComments.${item.status === 'soft-deleted' ? 'deleted' : item.status}`)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {item.storyTitle}
            {item.chapterTitle ? ` · ${item.chapterTitle}` : ''} · {formatDate(item.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.status === 'visible' && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setReplyTarget(item.id)}
            >
              <MessageCircle size={14} aria-hidden="true" />
              {t('authorComments.reply')}
            </Button>
          )}
          {item.status === 'visible' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onStatus(item.id, 'hidden')}
            >
              {t('authorComments.hide')}
            </Button>
          )}
          {item.status === 'hidden' && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onStatus(item.id, 'visible')}
            >
              <Check size={14} aria-hidden="true" />
              {t('authorComments.restore')}
            </Button>
          )}
          {item.status !== 'soft-deleted' && (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} aria-hidden="true" />
              {t('authorComments.delete')}
            </Button>
          )}
        </div>
      </div>
      <p
        className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${item.status === 'soft-deleted' ? 'text-muted line-through' : ''}`}
      >
        {item.body}
      </p>
      {item.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-brand/30 pl-4">
          {item.replies.map(reply => (
            <div key={reply.id} className="rounded-xl bg-elevated p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <strong>{reply.author}</strong>
                {reply.status !== 'soft-deleted' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onStatus(reply.id, 'soft-deleted')}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    {t('authorComments.delete')}
                  </Button>
                )}
              </div>
              <p
                className={`mt-1 whitespace-pre-wrap ${reply.status === 'soft-deleted' ? 'text-muted line-through' : 'text-muted'}`}
              >
                {reply.body}
              </p>
            </div>
          ))}
        </div>
      )}
      <Modal
        open={deleteOpen}
        title={t('authorComments.deleteTitle')}
        onClose={() => !busy && setDeleteOpen(false)}
      >
        <p className="text-sm leading-6 text-muted">{t('authorComments.deleteHint')}</p>
        <p className="mt-3 rounded-xl bg-elevated p-3 text-sm">{item.body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>
            {t('authorComments.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setDeleteOpen(false)
              onStatus(item.id, 'soft-deleted')
            }}
          >
            {t('authorComments.confirmDelete')}
          </Button>
        </div>
      </Modal>
    </article>
  )
}
