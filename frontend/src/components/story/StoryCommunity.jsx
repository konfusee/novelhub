import { useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Button, ButtonLink, EmptyState } from '../ui';
import { Star, MessageCircle } from '../icons';
import { Pagination } from '../ui/Pagination';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
const emptyFeed = { items: [], total: 0, pageSize: 5 };
function CommunityReplies({ storyId, parentId, renderEntry }) {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const feed = useBackendDocument(
    `/community/stories/${storyId}/comments?parentId=${parentId}&page=${page}`,
    emptyFeed,
  );
  return (
    <div className="space-y-3">
      {feed.status === 'loading' ? (
        <p role="status">{t('community.loading')}</p>
      ) : feed.status === 'error' ? (
        <Button variant="secondary" onClick={feed.retry}>
          {t('community.retry')}
        </Button>
      ) : (
        feed.data.items.map((post) => renderEntry(post, true))
      )}
      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(feed.data.total / 20))}
        onChange={setPage}
      />
    </div>
  );
}
export function StoryCommunity({ storyId, onSaved }) {
  const { isAuthenticated } = useAuth();
  const { t, formatDate } = useLocale();
  const { pathname } = useLocation();
  const [kind, setKind] = useState('review');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(0);
  const [replyTo, setReplyTo] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const field = useRef(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const feed = useBackendDocument(
    `/community/stories/${storyId}/${kind === 'review' ? 'ratings' : 'comments'}?page=${page}`,
    emptyFeed,
  );
  const pageCount = Math.max(1, Math.ceil(feed.data.total / feed.data.pageSize));
  const visible = feed.data.items;
  const key = (name, vars) => t('community.' + name, vars);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!isAuthenticated || busy) return;
    if ((kind === 'discussion' && body.trim().length < 3) || (kind === 'review' && !rating)) {
      setError(key('invalid'));
      return;
    }
    setBusy(true);
    try {
      await apiRequest(
        `/community/stories/${storyId}/${kind === 'review' ? 'rating' : 'comments'}`,
        {
          method: kind === 'review' ? 'PUT' : 'POST',
          body:
            kind === 'review'
              ? { value: rating }
              : { body: body.trim(), ...(replyTo ? { parentId: replyTo.id } : {}) },
        },
      );
      if (kind === 'discussion') setBody('');
      setRating(0);
      if (!replyTo) setPage(1);
      setReplyTo(null);
      setRevision((value) => value + 1);
      feed.retry();
      setNotice(key('saved'));
      onSaved?.();
    } catch {
      setError(key('saveError'));
    } finally {
      setBusy(false);
    }
  };
  const entry = (post, isReply = false) => (
    <article
      key={post.id}
      className={
        (isReply
          ? 'ml-4 border-l-2 border-brand/30 pl-4'
          : 'rounded-2xl border border-line bg-surface p-4') + ' space-y-3'
      }
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{post.author}</span>
        {post.createdAt && (
          <time dateTime={post.createdAt} className="text-xs text-muted">
            {formatDate(post.createdAt)}
          </time>
        )}
      </header>
      {post.rating && (
        <p
          className="flex gap-1 text-orange-strong"
          aria-label={key('stars', { rating: post.rating })}
        >
          {Array.from({ length: post.rating }, (_, i) => (
            <Star key={i} size={14} className="fill-current" />
          ))}
        </p>
      )}
      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-ink/80">
        {post.body || key('ratingOnly')}
      </p>
      {isAuthenticated && !isReply && kind === 'discussion' && (
        <Button
          variant="ghost"
          disabled={busy}
          size="sm"
          onClick={() => {
            setKind('discussion');
            setReplyTo(post);
            setNotice('');
            field.current?.focus();
          }}
        >
          {key('reply')}
        </Button>
      )}
      {!isReply && post.replyCount > 0 && (
        <CommunityReplies
          key={`${post.id}:${revision}`}
          storyId={storyId}
          parentId={post.id}
          renderEntry={entry}
        />
      )}
    </article>
  );
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label={key('typeLabel')}>
        {['review', 'discussion'].map((value) => (
          <Button
            key={value}
            disabled={busy}
            variant={kind === value ? 'primary' : 'secondary'}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setReplyTo(null);
              setPage(1);
              setError('');
              setNotice('');
            }}
          >
            {key(value)}
          </Button>
        ))}
      </div>
      {isAuthenticated ? (
        <form onSubmit={submit} className="rounded-2xl border border-line bg-reader p-4 sm:p-5">
          <h3 className="font-semibold">
            {key(replyTo ? 'replyTitle' : kind + 'Title', { name: replyTo?.author })}
          </h3>
          {replyTo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
              {key('cancelReply')}
            </Button>
          )}
          {kind === 'review' && (
            <fieldset className="mt-3">
              <legend className="text-sm font-semibold">{key('ratingLabel')}</legend>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <label
                    key={value}
                    className="cursor-pointer rounded-sm focus-within:ring-2 focus-within:ring-brand"
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="rating"
                      disabled={busy}
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                    />
                    <span className="sr-only">{key('stars', { rating: value })}</span>
                    <Star
                      size={28}
                      className={
                        'rounded-sm has-[:focus-visible]:ring-2 ' +
                        (value <= rating ? 'fill-orange text-orange-strong' : 'text-muted')
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {kind === 'discussion' && (
            <>
              <label className="mt-4 block text-sm font-semibold" htmlFor="community-body">
                {key('bodyLabel')}
              </label>
              <textarea
                id="community-body"
                ref={field}
                disabled={busy}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                minLength={3}
                maxLength={2000}
                rows={4}
                className="mt-2 w-full resize-y rounded-2xl border border-line bg-surface p-3 text-sm leading-6 text-ink"
              />
            </>
          )}
          <p className="mt-2 text-xs leading-5 text-muted">
            {key(kind === 'review' ? 'ratingNotice' : 'serverNotice')}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-strong">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="mt-4">
            {key(busy ? 'saving' : kind === 'review' ? 'submitReview' : 'submitDiscussion')}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-reader p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{key('signInHint')}</p>
          <ButtonLink to="/login" state={{ from: pathname }}>
            {t('auth.signIn')}
          </ButtonLink>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-brand-strong">
          {notice}
        </p>
      )}
      <div className="space-y-4">
        {feed.status === 'loading' ? (
          <p role="status">{key('loading')}</p>
        ) : feed.status === 'error' ? (
          <div role="alert">
            <p>{key('loadError')}</p>
            <Button variant="secondary" onClick={feed.retry}>
              {key('retry')}
            </Button>
          </div>
        ) : visible.length ? (
          visible.map((post) => entry(post))
        ) : (
          <EmptyState
            icon={MessageCircle}
            headingAs="h3"
            title={key(kind === 'review' ? 'emptyRatingTitle' : 'emptyTitle')}
            description={key(kind === 'review' ? 'emptyRatingDescription' : 'emptyDescription')}
          />
        )}
      </div>
      <Pagination page={Math.min(page, pageCount)} pageCount={pageCount} onChange={setPage} />
    </section>
  );
}
