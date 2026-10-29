import { useEffect, useId, useState } from 'react'
import { Avatar, Button, ButtonLink, EmptyState, Modal, SkeletonText } from '../ui'
import { Edit3, Flag, Heart, Lock, MessageCircle, Trash2 } from '../icons'
import {
  deleteComment,
  editComment,
  likeComment,
  listComments,
  postComment,
} from '../../api/community'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { ReportDialog } from './ReportDialog'
import { useLoginRedirect, useReturnPath } from './useLoginRedirect'

const BODY_MAX = 2000
const TIME_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

function relativeTime(iso, locale) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ''
  const distance = Math.abs(seconds)
  if (distance < 45) return null
  const [unit, size] = TIME_UNITS.find(([, length]) => distance >= length) || TIME_UNITS.at(-1)
  return new Intl.RelativeTimeFormat(locale === 'en' ? 'en' : 'vi-VN', { numeric: 'auto' }).format(
    Math.round(seconds / size) || -1,
    unit,
  )
}

const mapComment = (items, id, update) =>
  items.map(comment =>
    comment.id === id
      ? update(comment)
      : comment.replies?.length
        ? { ...comment, replies: mapComment(comment.replies, id, update) }
        : comment,
  )

/** Removes a deleted comment locally, mirroring the server: a deleted parent stays only while it has replies. */
function withoutComment(feed, target) {
  if (!target.parentId) {
    if (target.replies?.length)
      return {
        ...feed,
        items: mapComment(feed.items, target.id, comment => ({
          ...comment,
          deleted: true,
          body: '',
          edited: false,
          liked: false,
          mine: false,
        })),
      }
    return {
      ...feed,
      items: feed.items.filter(comment => comment.id !== target.id),
      total: Math.max(0, feed.total - 1),
    }
  }
  let removedParent = false
  const items = feed.items.flatMap(comment => {
    if (comment.id !== target.parentId) return [comment]
    const replies = comment.replies.filter(reply => reply.id !== target.id)
    if (comment.deleted && !replies.length) {
      removedParent = true
      return []
    }
    return [{ ...comment, replies }]
  })
  return { ...feed, items, total: removedParent ? Math.max(0, feed.total - 1) : feed.total }
}

function Composer({ label, submitLabel, initialBody = '', onSubmit, onCancel, autoFocus }) {
  const { t } = useLocale()
  const id = useId()
  const [body, setBody] = useState(initialBody)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const trimmed = body.trim()

  const submit = async event => {
    event.preventDefault()
    if (busy || !trimmed) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(trimmed)
      setBody('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={id}
        value={body}
        onChange={event => setBody(event.target.value)}
        maxLength={BODY_MAX}
        rows={3}
        required
        placeholder={t('community.placeholder')}
        autoFocus={autoFocus}
        aria-describedby={`${id}-count`}
        className="w-full resize-y rounded-2xl border border-line bg-surface p-3 text-base leading-6 text-ink placeholder:text-muted sm:text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-count`} className="text-xs text-muted">
          {t('community.counter', { count: body.length, max: BODY_MAX })}
        </p>
        <div className="flex flex-wrap gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              {t('community.cancel')}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={busy || !trimmed}>
            {busy ? t('community.saving') : submitLabel}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-strong">
          {error}
        </p>
      )}
    </form>
  )
}

function CommentItem({ comment, isReply, actions, state }) {
  const { t, locale, formatDate } = useLocale()
  const name = comment.author?.displayName || t('community.deletedUser')
  const relative = relativeTime(comment.createdAt, locale)
  const editing = state.editingId === comment.id
  const replying = state.replyToId === comment.id
  const live = !comment.deleted

  return (
    <article
      className={
        isReply
          ? 'border-l-2 border-brand/30 pl-3 sm:pl-4'
          : 'rounded-2xl border border-line bg-surface p-4'
      }
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Avatar name={name} className="size-8 text-sm" />
        <span className="text-sm font-semibold text-ink">{name}</span>
        {comment.createdAt && (
          <time
            dateTime={comment.createdAt}
            title={formatDate(comment.createdAt)}
            className="text-xs text-muted"
          >
            {relative === null ? t('community.justNow') : relative}
          </time>
        )}
        {live && comment.edited && (
          <span className="text-xs text-muted">{t('community.edited')}</span>
        )}
      </header>

      {!live ? (
        <p className="mt-2 text-sm italic text-muted">{t('community.deletedComment')}</p>
      ) : editing ? (
        <div className="mt-3">
          <Composer
            label={t('community.editLabel')}
            submitLabel={t('community.saveEdit')}
            initialBody={comment.body}
            autoFocus
            onSubmit={body => actions.edit(comment, body)}
            onCancel={actions.cancelEdit}
          />
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-ink/85">
          {comment.body}
        </p>
      )}

      {live && !editing && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-pressed={state.isAuthenticated ? comment.liked : undefined}
            aria-label={t(comment.liked ? 'community.unlike' : 'community.like', {
              count: comment.likeCount,
            })}
            disabled={state.liking.has(comment.id)}
            onClick={() => actions.like(comment)}
            className={
              'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors hover:bg-rose/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 pointer-coarse:min-h-11 ' +
              (comment.liked ? 'text-rose-strong' : 'text-muted')
            }
          >
            <Heart size={16} className={comment.liked ? 'fill-current' : undefined} />
            <span data-testid="like-count">{comment.likeCount}</span>
          </button>
          {!isReply && state.canReply && (
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={replying}
              onClick={() => actions.reply(replying ? null : comment.id)}
            >
              <MessageCircle size={16} />
              {t('community.reply')}
            </Button>
          )}
          {comment.mine && (
            <>
              <Button variant="ghost" size="sm" onClick={() => actions.startEdit(comment.id)}>
                <Edit3 size={16} />
                {t('community.edit')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => actions.askDelete(comment)}>
                <Trash2 size={16} />
                {t('community.delete')}
              </Button>
            </>
          )}
          {!comment.mine && (
            <Button variant="ghost" size="sm" onClick={() => actions.report(comment.id)}>
              <Flag size={16} />
              {t('community.report.action')}
            </Button>
          )}
        </div>
      )}

      {replying && (
        <div className="mt-3 border-l-2 border-brand/30 pl-3 sm:pl-4">
          <Composer
            label={t('community.replyLabel', { name })}
            submitLabel={t('community.submitReply')}
            autoFocus
            onSubmit={body => actions.submitReply(comment, body)}
            onCancel={() => actions.reply(null)}
          />
        </div>
      )}

      {!isReply && comment.replies?.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply actions={actions} state={state} />
          ))}
        </div>
      )}
    </article>
  )
}

const emptyFeed = { status: 'loading', items: [], total: 0, page: 1, error: null }

export function CommentThread({ targetType, targetId, canComment = true, disabledReason }) {
  const { isAuthenticated } = useAuth()
  const { t, formatNumber } = useLocale()
  const toLogin = useLoginRedirect()
  const returnPath = useReturnPath()
  const headingId = useId()
  const [attempt, setAttempt] = useState(0)
  const feedKey = `${targetType}:${targetId}:${attempt}`
  const [feedState, setFeed] = useState({ ...emptyFeed, key: null })
  const [more, setMore] = useState({ busy: false, error: '' })
  const [replyToId, setReplyToId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' })
  const [reportId, setReportId] = useState(null)
  const [liking, setLiking] = useState(() => new Set())
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    listComments(targetType, targetId, 1, controller.signal)
      .then(response => {
        if (controller.signal.aborted) return
        setFeed({
          key: feedKey,
          status: 'ready',
          items: response.items || [],
          total: response.total ?? 0,
          page: response.page ?? 1,
          error: null,
        })
      })
      .catch(error => {
        if (!controller.signal.aborted)
          setFeed({ ...emptyFeed, key: feedKey, status: 'error', error })
      })
    return () => controller.abort()
  }, [feedKey, targetType, targetId])

  const feed = feedState.key === feedKey ? feedState : emptyFeed
  const canWrite = isAuthenticated && canComment
  const patch = (id, update) =>
    setFeed(current => ({ ...current, items: mapComment(current.items, id, update) }))

  const loadMore = async () => {
    if (more.busy) return
    setMore({ busy: true, error: '' })
    try {
      const response = await listComments(targetType, targetId, feed.page + 1)
      setFeed(current => {
        const known = new Set(current.items.map(comment => comment.id))
        return {
          ...current,
          items: [...current.items, ...(response.items || []).filter(item => !known.has(item.id))],
          total: response.total ?? current.total,
          page: response.page ?? current.page + 1,
        }
      })
      setMore({ busy: false, error: '' })
    } catch (error) {
      setMore({ busy: false, error: error.message })
    }
  }

  const actions = {
    reply: id => {
      setReplyToId(id)
      setEditingId(null)
    },
    startEdit: id => {
      setEditingId(id)
      setReplyToId(null)
    },
    cancelEdit: () => setEditingId(null),
    submitReply: async (parent, body) => {
      const { comment } = await postComment(targetType, targetId, { body, parentId: parent.id })
      patch(parent.id, current => ({ ...current, replies: [...(current.replies || []), comment] }))
      setReplyToId(null)
      setNotice(t('community.posted'))
    },
    edit: async (comment, body) => {
      const response = await editComment(comment.id, { body, expectedVersion: comment.version })
      patch(comment.id, current => ({ ...response.comment, replies: current.replies }))
      setEditingId(null)
      setNotice(t('community.updated'))
    },
    like: async comment => {
      if (!isAuthenticated) {
        toLogin()
        return
      }
      const previous = { liked: comment.liked, likeCount: comment.likeCount }
      const liked = !comment.liked
      setActionError('')
      setLiking(current => new Set(current).add(comment.id))
      patch(comment.id, current => ({
        ...current,
        liked,
        likeCount: Math.max(0, current.likeCount + (liked ? 1 : -1)),
      }))
      try {
        const response = await likeComment(comment.id, liked)
        patch(comment.id, current => ({
          ...current,
          liked: response.liked,
          likeCount: response.likeCount,
        }))
      } catch (error) {
        patch(comment.id, current => ({ ...current, ...previous }))
        setActionError(error.message)
      } finally {
        setLiking(current => {
          const next = new Set(current)
          next.delete(comment.id)
          return next
        })
      }
    },
    askDelete: comment => {
      setDeleteState({ busy: false, error: '' })
      setPendingDelete(comment)
    },
    report: id => {
      if (!isAuthenticated) toLogin()
      else setReportId(id)
    },
  }

  const confirmDelete = async () => {
    if (!pendingDelete || deleteState.busy) return
    setDeleteState({ busy: true, error: '' })
    try {
      await deleteComment(pendingDelete.id)
      setFeed(current => withoutComment(current, pendingDelete))
      if (editingId === pendingDelete.id) setEditingId(null)
      setPendingDelete(null)
      setDeleteState({ busy: false, error: '' })
      setNotice(t('community.deleted'))
    } catch (error) {
      setDeleteState({ busy: false, error: error.message })
    }
  }

  const submitTopLevel = async body => {
    const { comment } = await postComment(targetType, targetId, { body })
    setFeed(current => ({
      ...current,
      items: [{ ...comment, replies: comment.replies || [] }, ...current.items],
      total: current.total + 1,
    }))
    setNotice(t('community.posted'))
  }

  const itemState = {
    editingId,
    replyToId,
    liking,
    isAuthenticated,
    canReply: canWrite,
  }

  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-lg font-semibold text-ink">
          {t('community.title')}
        </h3>
        {feed.status === 'ready' && (
          <span className="text-sm text-muted">
            {t('community.count', { count: formatNumber(feed.total) })}
          </span>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-reader p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-sm text-muted">{t('community.signInHint')}</p>
          <ButtonLink to={ROUTES.login} state={{ from: returnPath }} className="shrink-0">
            {t('community.signIn')}
          </ButtonLink>
        </div>
      ) : !canComment ? (
        <p className="flex items-start gap-2 rounded-2xl border border-line bg-reader p-4 text-sm text-muted">
          <Lock size={18} className="mt-0.5 shrink-0" />
          {disabledReason || t('community.disabled')}
        </p>
      ) : (
        <div className="rounded-2xl border border-line bg-reader p-4 sm:p-5">
          <Composer
            label={t('community.composerLabel')}
            submitLabel={t('community.submit')}
            onSubmit={submitTopLevel}
          />
        </div>
      )}

      {notice && (
        <p role="status" className="text-sm text-brand-strong">
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-rose-strong">
          {actionError}
        </p>
      )}

      {feed.status === 'loading' ? (
        <div role="status" aria-label={t('community.loading')} className="space-y-4">
          <SkeletonText lines={3} />
          <SkeletonText lines={2} />
        </div>
      ) : feed.status === 'error' ? (
        <EmptyState
          tone="rose"
          icon={MessageCircle}
          headingAs="h4"
          title={t('community.loadError')}
          description={feed.error?.message}
          action={
            <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>
              {t('community.retry')}
            </Button>
          }
        />
      ) : feed.items.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          headingAs="h4"
          title={t('community.emptyTitle')}
          description={t('community.emptyDescription')}
        />
      ) : (
        <div className="space-y-4">
          {feed.items.map(comment => (
            <CommentItem key={comment.id} comment={comment} actions={actions} state={itemState} />
          ))}
          {feed.items.length < feed.total && (
            <div className="flex flex-col items-center gap-2">
              <Button variant="secondary" onClick={loadMore} disabled={more.busy}>
                {more.busy ? t('community.loadingMore') : t('community.loadMore')}
              </Button>
              {more.error && (
                <p role="alert" className="text-sm text-rose-strong">
                  {more.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => !deleteState.busy && setPendingDelete(null)}
        title={t('community.deleteTitle')}
      >
        <p className="text-sm leading-6 text-muted">{t('community.deleteBody')}</p>
        {deleteState.error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {deleteState.error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => setPendingDelete(null)}
            disabled={deleteState.busy}
          >
            {t('community.cancel')}
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleteState.busy}>
            {deleteState.busy ? t('community.deleting') : t('community.deleteConfirm')}
          </Button>
        </div>
      </Modal>

      <ReportDialog
        open={Boolean(reportId)}
        onClose={() => setReportId(null)}
        targetType="comment"
        targetId={reportId}
      />
    </section>
  )
}
