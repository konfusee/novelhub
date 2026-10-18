import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { AdminLayout } from '../../layouts';
import { Button, Card, Input, Modal, Tabs } from '../../components/ui';
const empty = { items: [], hasMore: false };
export function BankReceiptsPage() {
  const { t, formatNumber, formatDate } = useLocale();
  const m = (key) => t(`bankReceipts.${key}`);
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1));
  const status = params.get('status') === 'resolved' ? 'resolved' : 'open';
  const feed = useBackendDocument(`/admin/bank-receipts?page=${page}&status=${status}`, empty);
  const [selected, setSelected] = useState(null);
  const navigate = (nextPage, nextStatus = status) =>
    setParams({ page: String(nextPage), status: nextStatus });
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('description')}</p>
          </div>
          <Button variant="secondary" onClick={feed.retry} disabled={feed.status === 'loading'}>
            {m('reload')}
          </Button>
        </div>
        <Tabs
          className="mt-6"
          value={status}
          onChange={(value) => navigate(1, value)}
          items={['open', 'resolved'].map((value) => ({ value, label: m(value) }))}
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
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-elevated text-muted">
                  <tr>
                    {['receipt', 'amount', 'content', 'status', 'action'].map((key) => (
                      <th key={key} className="p-4 font-semibold">
                        {m(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {feed.data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="p-4">
                        <strong>{row.providerId}</strong>
                        <p className="mt-1 text-xs text-muted">{formatDate(row.receivedAt)}</p>
                      </td>
                      <td className="whitespace-nowrap p-4 tabular-nums">
                        {formatNumber(row.amountVnd)} VND
                      </td>
                      <td className="max-w-sm break-words p-4">
                        <p className="whitespace-pre-wrap">{row.content}</p>
                        <p className="mt-2 text-xs text-muted">{row.paymentCode || '—'}</p>
                        {row.orderId && (
                          <p className="mt-1 break-all text-xs text-muted">
                            {m('originalOrder')}: {row.orderId}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        {m(`statuses.${row.status}`)}
                        {row.status === 'resolved' && (
                          <p className="mt-2 text-xs text-muted">
                            {m(`statuses.${row.originalStatus}`)} · {row.reason}
                          </p>
                        )}
                      </td>
                      <td className="p-4">
                        {row.canResolve ? (
                          <Button size="sm" variant="secondary" onClick={() => setSelected(row)}>
                            {m('resolve')}
                          </Button>
                        ) : (
                          <span className="break-all text-xs text-muted">
                            {row.adjustmentId || '—'}
                          </span>
                        )}
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
          <ResolveReceipt
            key={selected.id}
            receipt={selected}
            onClose={() => setSelected(null)}
            onSaved={() => {
              setSelected(null);
              feed.retry();
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
function ResolveReceipt({ receipt, onClose, onSaved }) {
  const { t, formatNumber } = useLocale();
  const m = (key) => t(`bankReceipts.${key}`);
  const [accountId, setAccountId] = useState(''),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const save = async (event) => {
    event.preventDefault();
    if (lock.current || error) return;
    lock.current = true;
    setBusy(true);
    try {
      const response = await apiRequest(`/admin/bank-receipts/${receipt.id}/resolve`, {
        method: 'POST',
        body: {
          expectedVersion: receipt.version,
          accountId: accountId.trim(),
          reason: reason.trim(),
          confirmedRecipient: confirmed,
        },
      });
      if (response?.receiptId !== receipt.id || !response.adjustmentId)
        throw new Error(m('invalidResponse'));
      onSaved();
    } catch (e) {
      setError(e.message || m('invalidResponse'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={m('resolve')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save} className="space-y-4">
        <div className="rounded-2xl border border-line bg-elevated p-4">
          <p className="font-semibold">{receipt.providerId}</p>
          <p className="mt-2">
            {formatNumber(receipt.amountVnd)} VND → {formatNumber(receipt.amountVnd)} xu
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
            {receipt.content}
          </p>
        </div>
        <p className="text-sm text-muted">{m('adjustmentNote')}</p>
        <div>
          <label htmlFor="receipt-recipient" className="mb-2 block text-sm font-semibold">
            {m('recipient')}
          </label>
          <Input
            id="receipt-recipient"
            required
            pattern="[a-fA-F0-9]{24}"
            maxLength={24}
            value={accountId}
            disabled={busy}
            onChange={(e) => setAccountId(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="receipt-reason" className="mb-2 block text-sm font-semibold">
            {m('reason')}
          </label>
          <Input
            id="receipt-reason"
            required
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{m('confirmation')}</span>
        </label>
        {error && (
          <div role="alert" className="space-y-2 text-sm text-rose-strong">
            <p>{error}</p>
            <p>{m('reloadRequired')}</p>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {m('close')}
          </Button>
          <Button
            type="submit"
            disabled={
              busy ||
              !!error ||
              !confirmed ||
              !reason.trim() ||
              !/^[a-f\d]{24}$/i.test(accountId.trim())
            }
          >
            {m(busy ? 'saving' : 'credit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
