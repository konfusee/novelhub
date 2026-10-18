import { useSearchParams } from 'react-router';
import { useBackendResource } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { AdminLayout } from '../../layouts';
import { ROUTES } from '../../app/routes';
import { Button, ButtonLink, Card, Input, Select } from '../../components/ui';
const empty = { summary: {}, items: [], hasMore: false };
const validateReport = (value) => {
  const fields = [
    'platformBalanceCoins',
    'platformRevenueCoins',
    'authorRevenueCoins',
    'topUpCoins',
    'unlockCoins',
    'pendingPayoutCoins',
    'paidPayoutCoins',
    'openBankExceptions',
    'failedPayoutAttempts',
  ];
  if (
    !value ||
    !value.summary ||
    fields.some((key) => !Number.isSafeInteger(value.summary[key]) || value.summary[key] < 0) ||
    !Array.isArray(value.items) ||
    !Number.isFinite(Date.parse(value.asOf)) ||
    value.items.some(
      (r) =>
        !r ||
        typeof r.id !== 'string' ||
        !Number.isSafeInteger(r.amount) ||
        r.amount < 0 ||
        !['credit', 'debit'].includes(r.direction) ||
        !Number.isFinite(Date.parse(r.occurredAt)),
    )
  )
    throw new Error('Invalid financial report');
  return value;
};
const types = [
  'all',
  'topup-credit',
  'unlock-debit',
  'allocation-credit',
  'withdrawal-debit',
  'adjustment',
  'reversal',
  'deletion-forfeiture',
];
const purposes = ['all', 'reader-coins', 'author-earnings', 'system-earnings'];
const timestamp = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
});
export function FinanceReportPage() {
  const { t, formatNumber } = useLocale(),
    m = (key) => t(`financeReport.${key}`);
  const [params, setParams] = useSearchParams();
  const page = Math.floor(Math.max(1, Math.min(100000, Number(params.get('page')) || 1)));
  const period = params.get('period') || 'all';
  const type = types.includes(params.get('type')) ? params.get('type') : 'all';
  const purpose = purposes.includes(params.get('purpose')) ? params.get('purpose') : 'all';
  const query = new URLSearchParams({ period, type, purpose, page: String(page) });
  const feed = useBackendResource(`/admin/finance-report?${query}`, empty, validateReport);
  const metrics = [
    'platformBalanceCoins',
    'platformRevenueCoins',
    'authorRevenueCoins',
    'topUpCoins',
    'unlockCoins',
    'pendingPayoutCoins',
    'paidPayoutCoins',
    'openBankExceptions',
  ];
  const move = (value) => setParams({ period, type, purpose, page: String(value) });
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('description')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink to="/admin/monthly-payouts" variant="secondary">
              {t('accountClosures.monthlyTitle')}
            </ButtonLink>
            <ButtonLink to={ROUTES.adminBankReceipts} variant="secondary">
              {m('bankReview')}
            </ButtonLink>
            <Button variant="secondary" disabled={feed.status === 'loading'} onClick={feed.retry}>
              {m('reload')}
            </Button>
          </div>
        </div>
        <Card className="mt-6">
          <form
            key={query.toString()}
            className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(new FormData(event.currentTarget));
              setParams({
                period: values.period || 'all',
                type: values.type,
                purpose: values.purpose,
                page: '1',
              });
            }}
          >
            <div>
              <label htmlFor="finance-period" className="mb-2 block text-sm font-semibold">
                {m('period')}
              </label>
              <Input
                id="finance-period"
                name="period"
                type="month"
                defaultValue={period === 'all' ? '' : period}
              />
            </div>
            <div>
              <label htmlFor="finance-type" className="mb-2 block text-sm font-semibold">
                {m('type')}
              </label>
              <Select id="finance-type" name="type" defaultValue={type}>
                {types.map((value) => (
                  <option key={value} value={value}>
                    {m(`types.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="finance-purpose" className="mb-2 block text-sm font-semibold">
                {m('purpose')}
              </label>
              <Select id="finance-purpose" name="purpose" defaultValue={purpose}>
                {purposes.map((value) => (
                  <option key={value} value={value}>
                    {m(`purposes.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">{m('apply')}</Button>
              <Button type="button" variant="secondary" onClick={() => setParams({})}>
                {m('clear')}
              </Button>
            </div>
          </form>
          <p className="mt-4 text-xs text-muted">{m('scopeNote')}</p>
        </Card>
        {feed.status === 'ready' ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((key) => (
                <Card key={key}>
                  <p className="text-sm text-muted">{m(`metrics.${key}`)}</p>
                  <p className="mt-3 text-h2 tabular-nums">
                    {formatNumber(feed.data.summary[key])}
                    {key !== 'openBankExceptions' && (
                      <span className="ml-1 text-sm font-medium text-muted">{m('coins')}</span>
                    )}
                  </p>
                </Card>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted">
              {m('periodLabel')}: {period === 'all' ? m('allTime') : period} · {m('asOf')}:{' '}
              {timestamp.format(new Date(feed.data.asOf))} · {m('failedAttempts')}:{' '}
              {formatNumber(feed.data.summary.failedPayoutAttempts)}
            </p>
          </>
        ) : (
          <Card className="mt-6">
            <p role={feed.status === 'loading' ? 'status' : 'alert'}>
              {m(feed.status === 'loading' ? 'loading' : 'error')}
            </p>
          </Card>
        )}
        <Card className="mt-6 overflow-hidden p-0">
          <div className="border-b border-line p-5">
            <h2 className="text-h3">{m('ledger')}</h2>
            <p className="mt-2 text-sm text-muted">{m('ledgerNote')}</p>
          </div>
          {feed.status === 'ready' &&
            (feed.data.items.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="bg-elevated text-muted">
                    <tr>
                      {['time', 'type', 'purpose', 'owner', 'amount', 'source'].map((key) => (
                        <th key={key} className="p-4 font-semibold">
                          {m(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {feed.data.items.map((row) => (
                      <tr key={row.id}>
                        <td className="p-4 text-muted">
                          {timestamp.format(new Date(row.occurredAt))}
                        </td>
                        <td className="p-4">
                          {m(`types.${row.type}`)}
                          <p className="mt-1 text-xs text-muted">
                            {m(row.direction === 'credit' ? 'credit' : 'debit')}
                          </p>
                        </td>
                        <td className="p-4">{m(`purposes.${row.purpose}`)}</td>
                        <td className="p-4">
                          <p className="text-xs text-muted">
                            {m(row.ownerType === 'system' ? 'system' : 'account')}
                          </p>
                          <p className="mt-1 break-all text-xs">{row.ownerId}</p>
                        </td>
                        <td className="whitespace-nowrap p-4 font-semibold tabular-nums">
                          {row.direction === 'credit' ? '+' : '−'}
                          {formatNumber(row.amount)} {m('coins')}
                        </td>
                        <td className="p-4">
                          <p className="break-all text-xs text-muted">
                            {m('sourceId')}: {row.sourceId}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted">
                            {m('entryId')}: {row.id}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-muted">{m('empty')}</p>
            ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
            <Button
              variant="secondary"
              disabled={page <= 1 || feed.status === 'loading'}
              onClick={() => move(page - 1)}
            >
              {m('previous')}
            </Button>
            <span>{page}</span>
            <Button
              variant="secondary"
              disabled={feed.status !== 'ready' || !feed.data.hasMore}
              onClick={() => move(page + 1)}
            >
              {m('next')}
            </Button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
