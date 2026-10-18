import { useState } from 'react';
import { AlertTriangle, Coins } from '../../components/icons';
import { Badge, Button, Card, EmptyState, Input, Modal, Skeleton } from '../../components/ui';
import { useBackendResource, useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

const empty = Object.freeze({ items: [], nextCursor: null });
const emptyDetail = Object.freeze({ item: null, slip: null });
const time = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});
const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});
function readHistory(response) {
  if (
    !Array.isArray(response?.items) ||
    !(response.nextCursor === null || typeof response.nextCursor === 'string')
  )
    throw new Error('Invalid payout history');
  return response;
}
function State({ value }) {
  const { t } = useLocale();
  return (
    <Badge tone={value === 'paid' ? 'green' : value === 'failed' ? 'orange' : 'neutral'}>
      {t(`authorPayouts.states.${value}`)}
    </Badge>
  );
}
export function AuthorPayoutHistory({ apiBase = '/author' }) {
  const { t, formatNumber } = useLocale();
  const [period, setPeriod] = useState('');
  const [cursors, setCursors] = useState(['']);
  const [selected, setSelected] = useState(null);
  function onPeriodChange(value) {
    setPeriod(value);
    setCursors(['']);
  }
  const query = new URLSearchParams({ limit: '20' });
  if (period) query.set('period', period);
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1));
  const history = useBackendResource(`${apiBase}/payouts?${query}`, empty, readHistory);
  const loading = history.status === 'loading';
  return (
    <Card className="overflow-hidden p-0">
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-h3">{t('authorPayouts.title')}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{t('authorPayouts.hint')}</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onPeriodChange(event.currentTarget.elements.namedItem('period').value);
          }}
        >
          <div>
            <label htmlFor="author-payout-period" className="mb-2 block text-xs font-semibold">
              {t('authorPayouts.period')}
            </label>
            <Input
              id="author-payout-period"
              name="period"
              type="month"
              min="0001-01"
              max="9999-12"
              defaultValue=""
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" disabled={loading}>
            {t('authorPayouts.filter')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!period}
            onClick={(event) => {
              event.currentTarget.form.reset();
              onPeriodChange('');
            }}
          >
            {t('authorPayouts.allPeriods')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => {
              setCursors(['']);
              history.retry();
            }}
          >
            {t('authorPayouts.refresh')}
          </Button>
        </form>
      </div>
      {loading ? (
        <div
          role="status"
          aria-label={t('authorPayouts.loading')}
          className="space-y-4 border-t border-hairline p-6"
        >
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      ) : history.status !== 'ready' ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('authorPayouts.error')}
          action={
            <Button variant="secondary" onClick={history.retry}>
              {t('authorPayouts.retry')}
            </Button>
          }
        />
      ) : !history.data.items.length ? (
        <EmptyState
          icon={Coins}
          title={t('authorPayouts.empty')}
          description={t('authorPayouts.emptyHint')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table
            aria-label={t('authorPayouts.title')}
            className="w-full min-w-[580px] text-left text-sm"
          >
            <thead className="border-y border-hairline bg-elevated text-xs text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">
                  {t('authorPayouts.period')}
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  {t('authorPayouts.coins')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('authorPayouts.status')}
                </th>
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">{t('authorPayouts.details')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {history.data.items.map((item) => (
                <tr key={item.id}>
                  <th scope="row" className="px-5 py-4 font-semibold">
                    {item.period}
                  </th>
                  <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">
                    {formatNumber(item.amountCoins)} {t('wallet.coinUnit')}
                  </td>
                  <td className="px-4 py-4">
                    <State value={item.state} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t('authorPayouts.detailsNamed', { period: item.period })}
                      onClick={() => setSelected(item.id)}
                    >
                      {t('authorPayouts.details')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5 text-xs text-muted">
        <span>{t('authorTransactions.page', { count: cursors.length })}</span>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || cursors.length === 1}
            onClick={() => setCursors(cursors.slice(0, -1))}
          >
            {t('authorPayouts.previous')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || history.status !== 'ready' || !history.data.nextCursor}
            onClick={() => setCursors([...cursors, history.data.nextCursor])}
          >
            {t('authorPayouts.next')}
          </Button>
        </div>
      </div>
      {selected && (
        <PayoutDetail apiBase={apiBase} id={selected} onClose={() => setSelected(null)} />
      )}
    </Card>
  );
}
function PayoutDetail({ id, onClose, apiBase }) {
  const { t, formatNumber } = useLocale();
  const detail = useBackendDocument(`${apiBase}/payouts/${id}`, emptyDetail);
  const item = detail.data.item;
  const ready = detail.status === 'ready' && item?.id === id;
  const slip =
    ready && item.state === 'paid' && detail.data.slip?.id === id ? detail.data.slip : null;
  return (
    <Modal open title={t('authorPayouts.detailTitle')} onClose={onClose}>
      {detail.status === 'loading' ? (
        <p role="status" className="text-sm text-muted">
          {t('authorPayouts.loading')}
        </p>
      ) : !ready ? (
        <div role="alert">
          <p className="text-sm text-rose-strong">{t('authorPayouts.error')}</p>
          <Button className="mt-4" variant="secondary" onClick={detail.retry}>
            {t('authorPayouts.retry')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <State value={item.state} />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-muted">{t('authorPayouts.period')}</dt>
            <dd>{item.period}</dd>
            <dt className="text-muted">{t('authorPayouts.coins')}</dt>
            <dd>
              {formatNumber(item.amountCoins)} {t('wallet.coinUnit')}
            </dd>
            <dt className="text-muted">{t('authorPayouts.evaluatedAt')}</dt>
            <dd>{time.format(new Date(item.evaluatedAt))}</dd>
            <dt className="text-muted">{t('authorPayouts.cutoffAt')}</dt>
            <dd>{time.format(new Date(item.cutoffAt))}</dd>
            {item.lastFailedAt && (
              <>
                <dt className="text-muted">{t('authorPayouts.failedAt')}</dt>
                <dd>{time.format(new Date(item.lastFailedAt))}</dd>
              </>
            )}
          </dl>
          {item.finalPayout && <p className="text-sm text-muted">{t('authorPayouts.final')}</p>}
          {slip ? (
            <section
              aria-label={t('authorPayouts.slip')}
              className="rounded-2xl border border-line bg-elevated p-4"
            >
              <h3 className="text-sm font-semibold">{t('authorPayouts.slip')}</h3>
              <p className="mt-2 text-h3 tabular-nums">{vnd.format(slip.amountVnd)}</p>
              <p className="mt-2 text-xs text-muted">
                {t('authorPayouts.paidAt', { date: time.format(new Date(slip.paidAt)) })}
              </p>
            </section>
          ) : (
            <p className="text-sm leading-6 text-muted">
              {t(
                item.state === 'unavailable' ? 'authorPayouts.unavailable' : 'authorPayouts.noSlip',
              )}
            </p>
          )}
        </div>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t('authorPayouts.close')}
        </Button>
      </div>
    </Modal>
  );
}
