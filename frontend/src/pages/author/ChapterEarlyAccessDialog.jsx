import { useId, useRef, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { Button, Input, Modal } from '../../components/ui';

export function ChapterEarlyAccessDialog({ storyId, chapterId, onClose, onSaved }) {
  const { t } = useLocale();
  const path = `/author/stories/${storyId}/chapters/${chapterId}/early-access`;
  const resource = useBackendDocument(path, null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open title={t('earlyAccess.title')} onClose={() => !busy && onClose()}>
      {resource.status === 'ready' ? (
        <EarlyAccessForm
          key={`${resource.data.version}:${resource.data.storyVersion}:${resource.data.policy?.version}`}
          data={resource.data}
          path={path}
          busy={busy}
          setBusy={setBusy}
          onClose={onClose}
          onSaved={onSaved}
          onReload={resource.retry}
        />
      ) : (
        <>
          <p
            role={resource.status === 'loading' ? 'status' : 'alert'}
            className="text-sm text-muted"
          >
            {t(resource.status === 'loading' ? 'earlyAccess.loading' : 'earlyAccess.failed')}
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('earlyAccess.close')}
            </Button>
            <Button disabled={resource.status === 'loading'} onClick={resource.retry}>
              {t('earlyAccess.reload')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
function EarlyAccessForm({ data, path, busy, setBusy, onClose, onSaved, onReload }) {
  const { t } = useLocale();
  const id = useId();
  const [enabled, setEnabled] = useState(data.settings.enabled);
  const [price, setPrice] = useState(
    String(data.settings.coinPrice ?? data.policy?.priceMinCoins ?? ''),
  );
  const [days, setDays] = useState(
    String(data.settings.durationDays ?? data.policy?.durationMinDays ?? ''),
  );
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const busyRef = useRef(false);
  const policy = data.policy;
  const coinPrice = Number(price),
    durationDays = Number(days);
  const valid =
    !enabled ||
    Boolean(
      policy &&
      price.trim() &&
      days.trim() &&
      Number.isSafeInteger(coinPrice) &&
      Number.isSafeInteger(durationDays) &&
      coinPrice >= policy.priceMinCoins &&
      coinPrice <= policy.priceMaxCoins &&
      durationDays >= policy.durationMinDays &&
      durationDays <= policy.durationMaxDays,
    );
  const dirty =
    enabled !== data.settings.enabled ||
    (enabled &&
      (coinPrice !== data.settings.coinPrice || durationDays !== data.settings.durationDays));
  const canManage = data.canEdit || data.canDisable;
  const permitted = data.canEdit || (!enabled && data.canDisable);
  const save = async (event) => {
    event.preventDefault();
    if (busyRef.current || stale || !permitted || !dirty || !valid) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest(path, {
        method: 'PUT',
        body: {
          enabled,
          expectedVersion: data.version,
          expectedStoryVersion: data.storyVersion,
          ...(enabled
            ? {
                coinPrice,
                durationDays,
                policyId: policy.id,
                expectedPolicyVersion: policy.version,
              }
            : {}),
        },
      });
      if (
        result?.chapterId !== data.chapterId ||
        result?.version !== data.version + 1 ||
        result?.storyVersion !== data.storyVersion + 1 ||
        result?.settings?.enabled !== enabled ||
        (enabled &&
          (result.settings.coinPrice !== coinPrice ||
            result.settings.durationDays !== durationDays))
      )
        throw new Error(t('earlyAccess.failed'));
      onSaved();
    } catch (failure) {
      setError(failure.message || t('earlyAccess.failed'));
      setStale(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} aria-busy={busy}>
      <h3 className="break-words text-base font-semibold">{data.title}</h3>
      {data.canEdit && <p className="mt-3 text-sm leading-6 text-muted">{t('earlyAccess.hint')}</p>}
      {!data.canEdit && (
        <p className="mt-3 text-sm text-muted">
          {t(data.canDisable ? 'earlyAccess.disableOnly' : 'earlyAccess.locked')}
        </p>
      )}
      {!policy && <p className="mt-3 text-sm text-orange-strong">{t('earlyAccess.noPolicy')}</p>}
      <label className="mt-5 flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          disabled={busy || stale || !canManage}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {t(data.canEdit ? 'earlyAccess.enable' : 'earlyAccess.enabledState')}
      </label>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-price`} className="text-sm font-semibold">
            {t('earlyAccess.price')}
          </label>
          <Input
            id={`${id}-price`}
            type="number"
            inputMode="numeric"
            min={policy?.priceMinCoins}
            max={policy?.priceMaxCoins}
            step="1"
            value={price}
            disabled={!enabled || busy || stale || !data.canEdit}
            className="mt-2"
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-days`} className="text-sm font-semibold">
            {t('earlyAccess.days')}
          </label>
          <Input
            id={`${id}-days`}
            type="number"
            inputMode="numeric"
            min={policy?.durationMinDays}
            max={policy?.durationMaxDays}
            step="1"
            value={days}
            disabled={!enabled || busy || stale || !data.canEdit}
            className="mt-2"
            onChange={(event) => setDays(event.target.value)}
          />
        </div>
      </div>
      {policy && <p className="mt-3 text-caption text-muted">{t('earlyAccess.bounds', policy)}</p>}
      {!valid && <p className="mt-3 text-sm text-rose-strong">{t('earlyAccess.invalid')}</p>}
      <p className="mt-4 text-sm leading-6 text-muted">{t('earlyAccess.releaseLimit')}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-strong">
          {error} {t('earlyAccess.retryHint')}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
          {t('earlyAccess.close')}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onReload}>
          {t('earlyAccess.reload')}
        </Button>
        {canManage && (
          <Button type="submit" disabled={busy || stale || !permitted || !dirty || !valid}>
            {t(busy ? 'earlyAccess.saving' : 'earlyAccess.save')}
          </Button>
        )}
      </div>
    </form>
  );
}
