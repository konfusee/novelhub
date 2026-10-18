import { useSearchParams } from 'react-router';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { ModeratorLayout } from '../../layouts';
import { ROUTES } from '../../app/routes';
import { Button, ButtonLink, Card, Tabs } from '../../components/ui';
const empty = { items: [], hasMore: false };
export function ReviewHistoryPage() {
  const { t } = useLocale(),
    m = (key) => t(`reviewHistory.${key}`);
  const [params, setParams] = useSearchParams();
  const page = Math.floor(Math.max(1, Math.min(100000, Number(params.get('page')) || 1)));
  const outcome = ['approved', 'rejected', 'revision-requested'].includes(params.get('outcome'))
    ? params.get('outcome')
    : 'all';
  const feed = useBackendDocument(
    `/moderator/manual-reviews/history?page=${page}&outcome=${outcome}`,
    empty,
  );
  const navigate = (nextPage, nextOutcome = outcome) =>
    setParams({ page: String(nextPage), outcome: nextOutcome });
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
          value={outcome}
          onChange={(value) => navigate(1, value)}
          items={['all', 'approved', 'rejected', 'revision-requested'].map((value) => ({
            value,
            label: m(value),
          }))}
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
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-elevated text-muted">
                  <tr>
                    {['time', 'submission', 'result', 'reason', 'action'].map((key) => (
                      <th className="p-4 font-semibold" key={key}>
                        {m(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {feed.data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="p-4 text-muted">
                        {new Date(row.occurredAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="p-4">
                        <p className="break-all font-semibold">{row.submissionId}</p>
                        <p className="mt-1 break-all text-xs text-muted">
                          {m('revision')}: {row.revisionId}
                        </p>
                      </td>
                      <td className="p-4">{m(row.outcome)}</td>
                      <td className="max-w-md whitespace-pre-wrap break-words p-4">{row.reason}</td>
                      <td className="p-4">
                        <ButtonLink
                          size="sm"
                          variant="secondary"
                          to={ROUTES.moderatorManualReview(row.submissionId)}
                        >
                          {m('open')}
                        </ButtonLink>
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
      </div>
    </ModeratorLayout>
  );
}
