import { useState } from 'react';
import { AlertTriangle, Coins } from '../../components/icons';
import { Button, Card, EmptyState, Select, Skeleton } from '../../components/ui';
import { useBackendResource } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

const empty = Object.freeze({ items: [], nextCursor: null });
const time = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});
function historyFrom(response) {
  if (
    !Array.isArray(response?.items) ||
    !(response.nextCursor === null || typeof response.nextCursor === 'string')
  )
    throw new Error('Invalid ledger response');
  return response;
}
export function AuthorTransactionHistory({ period }) {
  const { t, formatNumber } = useLocale();
  const [direction, setDirection] = useState('all');
  const filter = `${period}:${direction}`;
  const [position, setPosition] = useState({ filter, cursors: [''] });
  const cursors = position.filter === filter ? position.cursors : [''];
  const query = new URLSearchParams({ period, direction, limit: '20' });
  if (cursors.at(-1)) query.set('cursor', cursors.at(-1));
  const history = useBackendResource(`/author/transactions?${query}`, empty, historyFrom);
  const loading = history.status === 'loading';
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <h2 className="text-h3">{t('authorTransactions.title')}</h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-6 text-muted">
            {t('authorTransactions.hint')}
          </p>
        </div>
        <div>
          <label htmlFor="author-ledger-direction" className="mb-2 block text-xs font-semibold">
            {t('authorTransactions.direction')}
          </label>
          <Select
            id="author-ledger-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
          >
            <option value="all">{t('authorTransactions.all')}</option>
            <option value="credit">{t('authorTransactions.credit')}</option>
            <option value="debit">{t('authorTransactions.debit')}</option>
          </Select>
        </div>
      </div>
      {loading ? (
        <div
          role="status"
          aria-label={t('authorTransactions.loading')}
          className="space-y-4 border-t border-hairline p-6"
        >
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      ) : history.status === 'error' || history.status === 'empty' ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('authorTransactions.error')}
          action={
            <Button variant="secondary" onClick={history.retry}>
              {t('authorTransactions.retry')}
            </Button>
          }
        />
      ) : !history.data.items.length ? (
        <EmptyState
          icon={Coins}
          title={t('authorTransactions.empty')}
          description={t('authorTransactions.emptyHint')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full min-w-[560px] text-left text-sm"
            aria-label={t('authorTransactions.title')}
          >
            <thead className="border-y border-hairline bg-elevated text-xs text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">
                  {t('authorTransactions.time')}
                </th>
                <th scope="col" className="px-4 py-3">
                  {t('authorTransactions.type')}
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  {t('authorTransactions.amount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {history.data.items.map((item) => (
                <tr key={item.id}>
                  <td className="whitespace-nowrap px-5 py-4">
                    <time dateTime={item.occurredAt}>{time.format(new Date(item.occurredAt))}</time>
                  </td>
                  <td className="px-4 py-4">{t(`authorTransactions.types.${item.type}`)}</td>
                  <td
                    className={`whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums ${item.direction === 'credit' ? 'text-brand-strong' : 'text-ink'}`}
                  >
                    <span className="sr-only">{t(`authorTransactions.${item.direction}`)} </span>
                    {item.direction === 'credit' ? '+' : '−'}
                    {formatNumber(item.amount)} {t('wallet.coinUnit')}
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
            onClick={() => setPosition({ filter, cursors: cursors.slice(0, -1) })}
          >
            {t('authorTransactions.previous')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || history.status !== 'ready' || !history.data.nextCursor}
            onClick={() => setPosition({ filter, cursors: [...cursors, history.data.nextCursor] })}
          >
            {t('authorTransactions.next')}
          </Button>
        </div>
      </div>
    </Card>
  );
}
