import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { Button, Modal } from '../../components/ui';

const validOrder = (value) =>
  value &&
  /^[a-f\d]{24}$/i.test(value.id) &&
  /^NH\d{8}$/.test(value.paymentCode) &&
  ['pending', 'paid', 'expired'].includes(value.status) &&
  Number.isSafeInteger(value.coinAmount) &&
  value.coinAmount > 0 &&
  Number.isSafeInteger(value.priceVnd) &&
  value.priceVnd > 0 &&
  Number.isFinite(Date.parse(value.expiresAt));

export function TopUpDialog({ selected, payment, onClose, onRefresh }) {
  const { t, formatNumber } = useLocale();
  const m = (key) => t(`walletLive.${key}`);
  const [order, setOrder] = useState(selected.order ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = order
        ? await apiRequest(`/reader/top-up-orders/${order.id}`)
        : await apiRequest('/reader/top-up-orders', {
            method: 'POST',
            body: { packageId: selected.id },
          });
      if (!validOrder(result?.order) || (order && result.order.id !== order.id))
        throw new Error(m('invalidOrder'));
      setOrder(result.order);
      onRefresh();
    } catch (e) {
      setError(e.message || m('invalidOrder'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const expired =
    order &&
    (order.status === 'expired' ||
      (order.status === 'pending' && Date.parse(order.expiresAt) <= now));
  return (
    <Modal
      open
      title={m('paymentTitle')}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="rounded-2xl border border-line bg-elevated p-4">
        <strong>{order ? `${formatNumber(order.coinAmount)} xu` : selected.label}</strong>
        <p className="mt-1 text-muted">
          {order ? `${formatNumber(order.priceVnd)} VND` : selected.price}
        </p>
      </div>
      {order && (
        <div className="mt-4 space-y-3 break-words text-sm">
          <p role="status">
            {m(order.status === 'paid' ? 'paid' : expired ? 'expired' : 'pending')}
          </p>
          {order.status === 'pending' && !expired && (
            <>
              {payment?.bankName ? (
                <>
                  <p>
                    {m('bank')}: <strong>{payment.bankName}</strong>
                  </p>
                  <p>
                    {m('bankAccount')}: <strong>{payment.accountNumber}</strong>
                  </p>
                </>
              ) : (
                <p role="alert">{m('paymentUnavailable')}</p>
              )}
              <p>
                {m('paymentCode')}: <strong className="select-all">{order.paymentCode}</strong>
              </p>
              <p>
                {m('expiresAt')}: {new Date(order.expiresAt).toLocaleString('vi-VN')}
              </p>
            </>
          )}
        </div>
      )}
      <p className="mt-4 text-sm text-muted">{m('creditAfterVerification')}</p>
      {error && (
        <p role="alert" className="mt-3 text-rose-strong">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {m('close')}
        </Button>
        {(!order || (order.status === 'pending' && !expired)) && (
          <Button disabled={busy} onClick={submit}>
            {m(busy ? 'working' : order ? 'checkPayment' : 'createInvoice')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
