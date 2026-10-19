import { useRef, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { Avatar, Badge, Button, Card, Input, Modal } from '../ui';

const emptyFeed = { items: [], total: 0 };
const emptyRole = { role: null };
export function AuthorRoleManagement({ onChanged }) {
  const { t } = useLocale();
  const [filter, setFilter] = useState({ page: 1, query: '' });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const feed = useBackendDocument(
    `/admin/authors?${new URLSearchParams({ ...filter, pageSize: 10 })}`,
    emptyFeed,
  );
  return (
    <Card className="mt-6" aria-label={t('authorRevocation.title')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3">{t('authorRevocation.title')}</h2>
          <p className="mt-2 text-sm text-muted">{t('authorRevocation.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={feed.retry}>
          {t('authorRevocation.reload')}
        </Button>
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter({ page: 1, query: query.trim() });
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="author-role-query" className="mb-2 block text-sm font-semibold">
            {t('authorRevocation.searchLabel')}
          </label>
          <Input
            id="author-role-query"
            type="search"
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          {t('authorRevocation.search')}
        </Button>
      </form>
      {notice && (
        <p role="status" className="mt-4 text-sm text-brand-strong">
          {notice}
        </p>
      )}
      {feed.status === 'loading' ? (
        <p role="status" className="mt-4 text-sm text-muted">
          {t('authorRevocation.loading')}
        </p>
      ) : feed.status !== 'ready' ? (
        <p role="alert" className="mt-4 text-sm text-rose-strong">
          {feed.error?.message || t('authorRevocation.failed')}
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted">
            {t('authorRevocation.total', { count: feed.data.total })}
          </p>
          {!feed.data.items.length && (
            <p className="mt-4 text-sm text-muted">{t('authorRevocation.empty')}</p>
          )}
          <ul className="mt-3 divide-y divide-line">
            {feed.data.items.map((author) => (
              <li key={author.accountId} className="flex flex-wrap items-center gap-3 py-4">
                <Avatar name={author.displayName} />
                <div className="min-w-0 flex-1 basis-40">
                  <p className="break-words font-semibold">{author.displayName}</p>
                  <p className="mt-1 break-all text-xs text-muted">{author.accountId}</p>
                </div>
                <Badge tone={author.status === 'active' ? 'green' : 'orange'}>
                  {t(
                    author.status === 'active'
                      ? 'authorRevocation.active'
                      : 'authorRevocation.suspended',
                  )}
                </Badge>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setSelected(author);
                    setNotice('');
                  }}
                >
                  {t('authorRevocation.open')}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={filter.page === 1}
              onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
            >
              {t('authorRevocation.previous')}
            </Button>
            <span className="text-sm text-muted">
              {t('authorRevocation.page', { page: filter.page })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={filter.page * 10 >= feed.data.total}
              onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
            >
              {t('authorRevocation.next')}
            </Button>
          </div>
        </>
      )}
      {selected && (
        <RevokeAuthorDialog
          key={selected.accountId}
          accountId={selected.accountId}
          onClose={() => setSelected(null)}
          onRevoked={(result) => {
            onChanged?.();
            setSelected(null);
            setNotice(
              t('authorRevocation.success', {
                stories: result.frozenStories,
                chapters: result.cancelledChapters,
                submissions: result.cancelledSubmissions,
              }),
            );
            if (filter.page !== 1) setFilter({ ...filter, page: 1 });
            else feed.retry();
          }}
        />
      )}
    </Card>
  );
}

export function RevokeAuthorDialog({ accountId, onClose, onRevoked }) {
  const { t } = useLocale();
  const resource = useBackendDocument(`/admin/authors/${accountId}/role`, emptyRole);
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const ready =
    resource.status === 'ready' &&
    resource.data.accountId === accountId &&
    resource.data.role &&
    ['active', 'suspended'].includes(resource.data.status);
  const confirm = async (event) => {
    event.preventDefault();
    if (!ready || busyRef.current || stale || !acknowledged || !reason.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest(`/admin/authors/${accountId}/revoke`, {
        method: 'POST',
        body: {
          roleId: resource.data.role.id,
          expectedRoleVersion: resource.data.role.version,
          expectedAccountVersion: resource.data.accountVersion,
          reason: reason.trim(),
        },
      });
      if (
        result?.accountId !== accountId ||
        result?.roleId !== resource.data.role.id ||
        result.status !== 'revoked' ||
        ![result.frozenStories, result.cancelledChapters, result.cancelledSubmissions].every(
          (count) => Number.isInteger(count) && count >= 0,
        )
      )
        throw new Error(t('authorRevocation.failed'));
      onRevoked(result);
    } catch (failure) {
      setError(failure.message || t('authorRevocation.failed'));
      if ([401, 403, 409].includes(failure.status)) {
        setStale(true);
        setAcknowledged(false);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const reload = () => {
    setStale(false);
    setAcknowledged(false);
    setError('');
    resource.retry();
  };
  return (
    <Modal open title={t('authorRevocation.confirmTitle')} onClose={() => !busy && onClose()}>
      {resource.status === 'loading' ? (
        <p role="status" className="text-sm text-muted">
          {t('authorRevocation.loading')}
        </p>
      ) : resource.status !== 'ready' ? (
        <p role="alert" className="text-sm text-rose-strong">
          {resource.error?.message || t('authorRevocation.failed')}
        </p>
      ) : (
        <>
          <h3 className="break-words text-base font-semibold">{resource.data.displayName}</h3>
          <p className="mt-2 break-all text-xs text-muted">{accountId}</p>
          {!ready && (
            <p role="status" className="mt-4 text-sm text-muted">
              {t('authorRevocation.noRole')}
            </p>
          )}
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted">
            <li>{t('authorRevocation.effectLive')}</li>
            <li>{t('authorRevocation.effectPending')}</li>
            <li>{t('authorRevocation.effectSession')}</li>
          </ul>
        </>
      )}
      <form className="mt-5" onSubmit={confirm}>
        <label htmlFor="author-revocation-reason" className="mb-2 block text-sm font-semibold">
          {t('authorRevocation.reason')}
        </label>
        <Input
          id="author-revocation-reason"
          value={reason}
          maxLength={1000}
          required
          disabled={!ready || busy || stale}
          onChange={(event) => setReason(event.target.value)}
        />
        <label className="mt-4 flex items-start gap-3 text-sm leading-6">
          <input
            type="checkbox"
            className="mt-1 accent-brand"
            checked={acknowledged}
            disabled={!ready || busy || stale}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>{t('authorRevocation.acknowledge')}</span>
        </label>
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-strong">
            {error}
          </p>
        )}
        {stale && <p className="mt-2 text-sm text-muted">{t('authorRevocation.stale')}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t('submissionData.cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || resource.status === 'loading'}
            onClick={reload}
          >
            {t('authorRevocation.reload')}
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!ready || busy || stale || !reason.trim() || !acknowledged}
          >
            {t(busy ? 'authorRevocation.saving' : 'authorRevocation.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
