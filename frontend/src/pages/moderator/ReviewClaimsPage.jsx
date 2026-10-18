import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { ModeratorLayout } from '../../layouts';
import { Button, Card, Modal, Tabs } from '../../components/ui';
const empty = { items: [], hasMore: false };
export function ReviewClaimsPage() {
  const { t } = useLocale();
  const m = (key) => t(`reviewClaims.${key}`);
  const [params, setParams] = useSearchParams();
  const page = Math.floor(Math.max(1, Math.min(100000, Number(params.get('page')) || 1)));
  const view = params.get('view') === 'mine' ? 'mine' : 'available';
  const feed = useBackendDocument(`/moderator/review-claims?page=${page}&view=${view}`, empty);
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const navigate = (nextPage, nextView = view) =>
    setParams({ page: String(nextPage), view: nextView });
  const submit = async () => {
    if (!selected || lock.current || error) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await apiRequest(
        `/moderator/review-claims/${selected.row.id}${selected.release ? '/release' : ''}`,
        {
          method: 'POST',
          body: {
            expectedVersion: selected.row.version,
            expectedClaimVersion: selected.row.claimVersion,
          },
        },
      );
      if (
        response?.claim?.id !== selected.row.id ||
        !Number.isInteger(response.claim.claimVersion) ||
        response.claim.claimVersion <= selected.row.claimVersion
      )
        throw new Error(m('invalidResponse'));
      setSelected(null);
      feed.retry();
    } catch (e) {
      setError(e.message || m('invalidResponse'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('description')}</p>
          </div>
          <Button variant="secondary" disabled={feed.status === 'loading'} onClick={feed.retry}>
            {m('reload')}
          </Button>
        </div>
        <Tabs
          className="mt-6"
          value={view}
          onChange={(value) => navigate(1, value)}
          items={['available', 'mine'].map((value) => ({ value, label: m(value) }))}
        />
        <Card className="mt-5 overflow-hidden p-0">
          {feed.status !== 'ready' ? (
            <p className="p-5" role={feed.status === 'loading' ? 'status' : 'alert'}>
              {m(feed.status === 'loading' ? 'loading' : 'error')}
            </p>
          ) : !feed.data.items.length ? (
            <p className="p-5 text-muted">{m('empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-elevated text-muted">
                  <tr>
                    {['submission', 'submittedAt', 'expiresAt', 'action'].map((key) => (
                      <th className="p-4 font-semibold" key={key}>
                        {m(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {feed.data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="p-4">
                        <p className="break-all font-semibold">{row.id}</p>
                        <p className="mt-1 break-all text-xs text-muted">
                          {m('story')}: {row.storyId}
                        </p>
                        {row.chapterId && (
                          <p className="mt-1 break-all text-xs text-muted">
                            {m('chapter')}: {row.chapterId}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-muted">
                        {new Date(row.submittedAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-4 text-muted">
                        {row.expiresAt ? new Date(row.expiresAt).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td className="p-4">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setError('');
                            setSelected({ row, release: view === 'mine' });
                          }}
                        >
                          {m(view === 'mine' ? 'release' : 'acquire')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <Button
              variant="secondary"
              disabled={page <= 1 || feed.status === 'loading'}
              onClick={() => navigate(page - 1)}
            >
              {m('previous')}
            </Button>
            <span>{page}</span>
            <Button
              variant="secondary"
              disabled={feed.status !== 'ready' || !feed.data.hasMore}
              onClick={() => navigate(page + 1)}
            >
              {m('next')}
            </Button>
          </div>
        </Card>
        {selected && (
          <Modal
            open
            title={m(selected.release ? 'release' : 'acquire')}
            onClose={() => {
              if (!busy) setSelected(null);
            }}
          >
            <p className="break-all font-semibold">{selected.row.id}</p>
            <p className="mt-3 text-sm text-muted">
              {m(selected.release ? 'releaseNote' : 'acquireNote')}
            </p>
            {error && (
              <div role="alert" className="mt-3 space-y-2 text-sm text-rose-strong">
                <p>{error}</p>
                <p>{m('reloadRequired')}</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>
                {m('close')}
              </Button>
              <Button disabled={busy || !!error} onClick={submit}>
                {m(busy ? 'saving' : 'confirm')}
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </ModeratorLayout>
  );
}
