import { useSearchParams } from 'react-router';
import { useBackendResource } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { AdminLayout } from '../../layouts';
import { Button, ButtonLink, Card, Input } from '../../components/ui';
const metrics = [
  'evaluations',
  'bankRequired',
  'belowThreshold',
  'remainingCandidates',
  'pendingWithdrawals',
  'paidWithdrawals',
  'pendingEmails',
  'failedEmails',
  'expiredEmailLeases',
];
const results = [
  'pending-payout',
  'pending-existing-payout',
  'financially-closed',
  'bank-required',
  'below-threshold',
];
const empty = { summary: {}, items: [], total: 0, pageSize: 20 };
const validate = (value) => {
  if (
    !value?.summary ||
    !Array.isArray(value.items) ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0 ||
    value.pageSize !== 20 ||
    !Number.isFinite(Date.parse(value.asOf)) ||
    metrics.some((key) =>
      key === 'remainingCandidates' && value.summary[key] === null
        ? false
        : !Number.isSafeInteger(value.summary[key]) || value.summary[key] < 0,
    ) ||
    value.items.some(
      (row) =>
        !row ||
        typeof row.id !== 'string' ||
        typeof row.accountId !== 'string' ||
        !Number.isFinite(Date.parse(row.occurredAt)),
    )
  )
    throw new Error('Invalid payout operations');
  return value;
};
export function PayoutOperationsPage() {
  const { t, formatNumber, formatDate } = useLocale(),
    m = (key) => t(`payoutOperations.${key}`);
  const [params, setParams] = useSearchParams();
  const period = params.get('period') || '';
  const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1));
  const query = new URLSearchParams({ page: String(page), ...(period ? { period } : {}) });
  const feed = useBackendResource(`/admin/payout-operations?${query}`, empty, validate);
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('hint')}</p>
          </div>
          <ButtonLink variant="secondary" to="/admin/monthly-payouts">
            {m('payouts')}
          </ButtonLink>
        </div>
        <Card className="mt-6">
          <form
            key={period}
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(new FormData(event.currentTarget).get('period') ?? '');
              setParams(value ? { period: value } : {});
            }}
          >
            <label className="text-sm font-medium">
              {m('period')}
              <Input className="mt-1" name="period" type="month" defaultValue={period} />
            </label>
            <Button type="submit">{m('apply')}</Button>
            <Button type="button" variant="secondary" onClick={() => setParams({})}>
              {m('current')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={feed.retry}
              disabled={feed.status === 'loading'}
            >
              {m('reload')}
            </Button>
          </form>
        </Card>
        {feed.status !== 'ready' ? (
          <Card className="mt-4">
            <p role={feed.status === 'loading' ? 'status' : 'alert'}>
              {m(feed.status === 'loading' ? 'loading' : 'error')}
            </p>
          </Card>
        ) : (
          <>
            <p className="mt-4 text-xs text-muted">
              {feed.data.period} · {m('asOf')}: {formatDate(feed.data.asOf)}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {metrics.map((key) => (
                <Card key={key}>
                  <p className="text-sm text-muted">{m(key)}</p>
                  <strong className="mt-2 block text-h2 tabular-nums">
                    {feed.data.summary[key] === null ? '—' : formatNumber(feed.data.summary[key])}
                  </strong>
                </Card>
              ))}
            </div>
            <Card className="mt-6 overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead>
                    <tr>
                      {['time', 'account', 'kind', 'result'].map((key) => (
                        <th className="p-4" key={key} scope="col">
                          {m(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {feed.data.items.map((row) => (
                      <tr key={row.id} className="border-t border-line">
                        <td className="p-4">{formatDate(row.occurredAt)}</td>
                        <td className="p-4 break-all">{row.accountId}</td>
                        <td className="p-4">
                          {m(
                            row.action === 'author.monthly-payout.evaluated' ? 'monthly' : 'final',
                          )}
                        </td>
                        <td className="p-4">
                          {m(results.includes(row.result) ? row.result : 'unknown')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!feed.data.items.length && <p className="p-4 text-muted">{m('empty')}</p>}
              <div className="flex flex-wrap justify-between gap-3 border-t border-line p-4">
                <span>
                  {m('total')}: {formatNumber(feed.data.total)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() =>
                      setParams({ ...(period ? { period } : {}), page: String(page - 1) })
                    }
                  >
                    {m('previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page * 20 >= feed.data.total}
                    onClick={() =>
                      setParams({ ...(period ? { period } : {}), page: String(page + 1) })
                    }
                  >
                    {m('next')}
                  </Button>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
