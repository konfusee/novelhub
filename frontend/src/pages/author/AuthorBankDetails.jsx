import { useRef, useState } from 'react';
import { useBackendResource } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { Button, Card, Input } from '../../components/ui';
const empty = { version: null, bank: null };
const fields = ['bankName', 'accountNumber', 'accountHolder'];
const validate = (value) => {
  if (
    !Number.isSafeInteger(value?.version) ||
    value.version < 0 ||
    (value.bank !== null &&
      (!value.bank || fields.some((key) => typeof value.bank[key] !== 'string')))
  )
    throw new Error('Invalid bank details response');
  return value;
};
export function AuthorBankDetails() {
  const { t } = useLocale(),
    m = (key) => t(`authorBank.${key}`);
  const feed = useBackendResource('/author/bank-details', empty, validate);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const lock = useRef(false);
  return (
    <Card id="payout-bank" className="scroll-mt-24">
      <h2 className="text-lg font-semibold">{m('title')}</h2>
      <p className="mt-2 text-sm text-muted">{m('hint')}</p>
      {feed.status !== 'ready' ? (
        <div className="mt-4">
          <p role={feed.status === 'loading' ? 'status' : 'alert'}>
            {m(feed.status === 'loading' ? 'loading' : 'loadFailed')}
          </p>
          <Button className="mt-3" variant="secondary" onClick={feed.retry}>
            {m('reload')}
          </Button>
        </div>
      ) : (
        <form
          key={feed.data.version}
          className="mt-4 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (lock.current) return;
            const data = new FormData(event.currentTarget);
            const bank = Object.fromEntries(
              fields.map((key) => [key, String(data.get(key) ?? '').trim()]),
            );
            if (Object.values(bank).some((value) => !value)) return;
            lock.current = true;
            setBusy(true);
            setError('');
            setSaved(false);
            try {
              const result = validate(
                await apiRequest('/author/bank-details', {
                  method: 'PUT',
                  body: { expectedVersion: feed.data.version, bank },
                }),
              );
              if (result.version <= feed.data.version) throw new Error(m('saveFailed'));
              setSaved(true);
              feed.retry();
            } catch (failure) {
              setError(failure.message || m('saveFailed'));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          {fields.map((key) => (
            <label key={key} className="block text-sm font-medium">
              {m(key)}
              <Input
                className="mt-1"
                name={key}
                required
                maxLength={200}
                defaultValue={feed.data.bank?.[key] ?? ''}
                disabled={busy}
                autoComplete="off"
              />
            </label>
          ))}
          {error && (
            <p role="alert" className="text-sm text-rose-strong">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {m(busy ? 'saving' : 'save')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setError('');
                setSaved(false);
                feed.retry();
              }}
            >
              {m('reload')}
            </Button>
          </div>
        </form>
      )}
      {saved && (
        <p role="status" className="mt-3 text-sm text-brand-strong">
          {m('saved')}
        </p>
      )}
    </Card>
  );
}
