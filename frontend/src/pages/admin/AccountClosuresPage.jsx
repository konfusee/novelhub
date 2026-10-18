import { useRef, useState } from 'react';
import { AdminLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { Button, Card, EmptyState, Input, Modal } from '../../components/ui';
const empty = { items: [], total: 0, pageSize: 20 };
export function AccountClosuresPage() {
  const { t, formatNumber } = useLocale();
  const m = (key) => t(`accountClosures.${key}`);
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(null);
  const [payoutAccount, setPayoutAccount] = useState(null);
  const feed = useBackendDocument(`/admin/account-closures?page=${page}`, empty);
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('description')}</p>
          </div>
          <Button variant="secondary" disabled={feed.status === 'loading'} onClick={feed.retry}>
            {m('reload')}
          </Button>
        </div>
        <Card className="mt-6 overflow-hidden p-0">
          {feed.status !== 'ready' ? (
            <p role={feed.status === 'loading' ? 'status' : 'alert'} className="p-5">
              {m(feed.status === 'loading' ? 'loading' : 'error')}
            </p>
          ) : (
            <>
              <p className="border-b border-hairline p-5 text-sm">
                {m('period')}: {feed.data.period} · {m('timezone')}
              </p>
              {!feed.data.items.length ? (
                <EmptyState title={m('empty')} description={m('emptyHint')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-elevated">
                      <tr>
                        {['account', 'balance', 'pending', 'state', 'actions'].map((key) => (
                          <th scope="col" key={key} className="px-5 py-3">
                            {m(key)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {feed.data.items.map((account) => (
                        <tr key={account.id}>
                          <td className="min-w-64 px-5 py-4 break-all">{account.id}</td>
                          <td className="px-5 py-4 tabular-nums">
                            {formatNumber(account.balance)} {m('coins')}
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            {formatNumber(account.pendingWithdrawals)}
                          </td>
                          <td className="px-5 py-4">
                            {m(
                              account.evaluatedAt
                                ? 'evaluated'
                                : account.canEvaluate
                                  ? 'due'
                                  : 'waiting',
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={!account.canEvaluate}
                              onClick={() => setSelected(account)}
                            >
                              {m('evaluate')}
                            </Button>
                            {account.pendingWithdrawals > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPayoutAccount(account.id)}
                              >
                                {m('payouts')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline p-5">
                <span>
                  {m('total')}: {formatNumber(feed.data.total)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    {m('previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page * feed.data.pageSize >= feed.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    {m('next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
        {selected && (
          <EvaluationDialog
            account={selected}
            onClose={() => setSelected(null)}
            onChanged={() => {
              setSelected(null);
              feed.retry();
            }}
          />
        )}
        {payoutAccount && (
          <PayoutsDialog
            accountId={payoutAccount}
            onClose={() => setPayoutAccount(null)}
            onChanged={feed.retry}
          />
        )}
      </div>
    </AdminLayout>
  );
}
function PayoutsDialog({ accountId, onClose, onChanged }) {
  const { t, formatNumber } = useLocale();
  const m = (key) => t(`accountClosures.${key}`);
  const feed = useBackendDocument(`/admin/account-closures/${accountId}/payouts`, null);
  const [selected, setSelected] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  return (
    <Modal open title={m('payouts')} onClose={() => !lock.current && onClose()}>
      <p className="text-sm break-all">{accountId}</p>
      <p className="mt-2 text-sm text-muted">{m('bankHint')}</p>
      {!selected ? (
        <>
          {feed.status !== 'ready' ? (
            <div className="mt-4">
              <p role={feed.status === 'loading' ? 'status' : 'alert'}>
                {m(feed.status === 'loading' ? 'loading' : 'error')}
              </p>
              <Button className="mt-3" variant="secondary" onClick={feed.retry}>
                {m('reload')}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {feed.data.items.length === 0 && <p>{m('noPayouts')}</p>}
              {feed.data.items.map((row) => (
                <div key={row.id} className="rounded-2xl border border-line p-4">
                  <p className="font-semibold">
                    {row.period} · {formatNumber(row.amountCoins)} {m('coins')}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {m('originalBank')}:{' '}
                    {row.originalBank
                      ? `${row.originalBank.bankName} · ${row.originalBank.accountNumber} · ${row.originalBank.accountHolder}`
                      : m('missingBank')}
                  </p>
                  {row.correctedBank && (
                    <p className="mt-2 text-sm">
                      {m('correctedBank')}: {row.correctedBank.bankName} ·{' '}
                      {row.correctedBank.accountNumber} · {row.correctedBank.accountHolder}
                    </p>
                  )}
                  {row.correctionReason && (
                    <p className="mt-2 text-sm text-muted">
                      {m('reason')}: {row.correctionReason}
                    </p>
                  )}
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="secondary"
                    disabled={!row.canCorrect}
                    onClick={() => {
                      setError('');
                      setSelected(row);
                    }}
                  >
                    {m('correctBank')}
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted">{m('payoutLimit')}</p>
            </div>
          )}
        </>
      ) : (
        <form
          key={`${selected.id}:${selected.rowVersion}`}
          className="mt-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current || error) return;
            const data = new FormData(event.currentTarget);
            const reason = String(data.get('reason') ?? '').trim();
            const bank = Object.fromEntries(
              ['bankName', 'accountNumber', 'accountHolder'].map((key) => [
                key,
                String(data.get(key) ?? '').trim(),
              ]),
            );
            if (!reason || Object.values(bank).some((value) => !value)) return;
            lock.current = true;
            setBusy(true);
            try {
              const result = await apiRequest(
                `/admin/account-closures/${accountId}/payouts/${selected.id}/bank`,
                {
                  method: 'POST',
                  body: {
                    expectedRowVersion: selected.rowVersion,
                    expectedWithdrawalVersion: selected.version,
                    reason,
                    bank,
                  },
                },
              );
              if (
                result?.withdrawalId !== selected.id ||
                !Number.isSafeInteger(result.rowVersion) ||
                result.rowVersion <= selected.rowVersion ||
                !Number.isSafeInteger(result.withdrawalVersion) ||
                result.withdrawalVersion <= selected.version
              )
                throw new Error(m('failed'));
              setSelected(null);
              feed.retry();
              onChanged();
            } catch (failure) {
              setError(failure.message || m('failed'));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          {['bankName', 'accountNumber', 'accountHolder'].map((key) => (
            <label key={key} className="mt-3 block text-sm font-medium">
              {m(key)}
              <Input
                className="mt-2"
                name={key}
                required
                maxLength={200}
                disabled={busy || !!error}
                defaultValue={(selected.correctedBank ?? selected.originalBank)?.[key] ?? ''}
              />
            </label>
          ))}
          <label className="mt-3 block text-sm font-medium">
            {m('bankReason')}
            <Input
              className="mt-2"
              name="reason"
              required
              maxLength={1000}
              disabled={busy || !!error}
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-strong">
              {error} {m('reloadHint')}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setError('');
                feed.retry();
              }}
            >
              {m('back')}
            </Button>
            <Button type="submit" disabled={busy || !!error}>
              {m(busy ? 'saving' : 'saveBank')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
function EvaluationDialog({ account, onClose, onChanged }) {
  const { t, formatNumber } = useLocale();
  const m = (key) => t(`accountClosures.${key}`);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  return (
    <Modal open title={m('evaluate')} onClose={() => !lock.current && onClose()}>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (lock.current || error) return;
          const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
          if (!reason) return;
          lock.current = true;
          setBusy(true);
          try {
            const result = await apiRequest(`/admin/account-closures/${account.id}/evaluate`, {
              method: 'POST',
              body: { expectedVersion: account.version, reason },
            });
            if (
              result?.account?.id !== account.id ||
              !Number.isSafeInteger(result.account.version) ||
              result.account.version <= account.version ||
              typeof result.account.financiallyClosed !== 'boolean'
            )
              throw new Error(m('failed'));
            onChanged();
          } catch (failure) {
            setError(failure.message || m('failed'));
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      >
        <p className="font-semibold break-all">{account.id}</p>
        <p className="mt-3 text-sm text-muted">{m('evaluateHint')}</p>
        <p className="mt-3 text-sm">
          {m('balance')}: {formatNumber(account.balance)} {m('coins')}
        </p>
        <label className="mt-4 block text-sm font-medium">
          {m('reason')}
          <Input
            name="reason"
            required
            maxLength={1000}
            disabled={busy || !!error}
            className="mt-2"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error} {m('reloadHint')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {m('cancel')}
          </Button>
          <Button type="submit" disabled={busy || !!error}>
            {m(busy ? 'saving' : 'evaluate')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
