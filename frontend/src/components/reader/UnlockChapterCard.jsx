import { useRef, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useBackendResource } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { Button, ButtonLink, Modal } from '../ui';
import { ROUTES } from '../../app/routes';
const validateQuote = (value) => {
  if (
    !value ||
    !/^[a-f\d]{24}$/i.test(value.publishedRevisionId) ||
    !Number.isSafeInteger(value.balance) ||
    typeof value.free !== 'boolean' ||
    typeof value.entitled !== 'boolean'
  )
    throw new Error('Invalid unlock quote');
  return value;
};
export function UnlockChapterCard({ storyId, chapterId, onUnlocked }) {
  const { t, formatNumber } = useLocale();
  const m = (key) => t(`chapterUnlock.${key}`);
  const path = `/reader/stories/${storyId}/chapters/${chapterId}/unlock`;
  const quote = useBackendResource(path, null, validateQuote);
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef(null),
    lock = useRef(false);
  const buy = async () => {
    if (lock.current || error || quote.status !== 'ready') return;
    lock.current = true;
    setBusy(true);
    key.current ??= crypto.randomUUID();
    try {
      const result = await apiRequest(path, {
        method: 'POST',
        body: {
          publishedRevisionId: quote.data.publishedRevisionId,
          expectedPriceCoins: quote.data.priceCoins,
          idempotencyKey: key.current,
        },
      });
      if (result?.free !== true && !/^[a-f\d]{24}$/i.test(result?.entitlementId ?? ''))
        throw new Error(m('invalidResponse'));
      setConfirm(false);
      onUnlocked();
    } catch (e) {
      setError(e.message || m('invalidResponse'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const price = quote.data?.priceCoins;
  const validPrice = Number.isSafeInteger(price) && price > 0;
  return (
    <div className="space-y-4 py-6">
      <h3 className="text-h3">{m('title')}</h3>
      {quote.status === 'loading' ? (
        <p role="status" className="text-sm text-muted">
          {m('loading')}
        </p>
      ) : quote.status !== 'ready' ? (
        <div role="alert" className="space-y-3 text-sm text-muted">
          <p>{quote.error?.message || m('error')}</p>
          {quote.error?.status === 401 && (
            <ButtonLink to={ROUTES.login} variant="secondary">
              {m('login')}
            </ButtonLink>
          )}
          <Button variant="secondary" onClick={quote.retry}>
            {m('reload')}
          </Button>
        </div>
      ) : (
        <>
          {quote.data.free || quote.data.entitled ? (
            <>
              <p className="text-sm text-muted">{m('alreadyAvailable')}</p>
              <Button onClick={onUnlocked}>{m('continue')}</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                {m('balance')}: <strong>{formatNumber(quote.data.balance)} xu</strong>
              </p>
              {validPrice ? (
                <p className="text-sm">
                  {m('price')}: <strong>{formatNumber(price)} xu</strong>
                </p>
              ) : (
                <p role="alert" className="text-sm text-muted">
                  {m('unavailable')}
                </p>
              )}
              <p className="text-sm text-muted">{m('note')}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!validPrice || quote.data.balance < price}
                  onClick={() => setConfirm(true)}
                >
                  {m('unlock')}
                </Button>
                <ButtonLink variant="secondary" to="/reader/wallet">
                  {m('wallet')}
                </ButtonLink>
              </div>
              {validPrice && quote.data.balance < price && (
                <p className="text-sm text-muted">{m('insufficient')}</p>
              )}
            </>
          )}
        </>
      )}
      {confirm && (
        <Modal
          open
          title={m('confirmTitle')}
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p className="text-sm">
            {m('price')}: <strong>{formatNumber(price)} xu</strong>
          </p>
          <p className="mt-3 text-sm text-muted">{m('note')}</p>
          {error && (
            <div role="alert" className="mt-3 space-y-2 text-sm text-rose-strong">
              <p>{error}</p>
              <p>{m('reloadRequired')}</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                if (error) {
                  setError('');
                  quote.retry();
                }
              }}
            >
              {m('close')}
            </Button>
            <Button disabled={busy || !!error} onClick={buy}>
              {m(busy ? 'saving' : 'confirm')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
