import { useId, useRef, useState } from 'react';
import { Button, Input } from '../../components/ui';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';

const fields = ['priceMinCoins', 'priceMaxCoins', 'durationMinDays', 'durationMaxDays'];
export function PolicySettingsForm({ policy, onSaved, onBusy }) {
  const { t } = useLocale();
  const id = useId();
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((field) => [field, String(policy?.[field] ?? '')])),
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const dirty = fields.some((field) => values[field] !== String(policy?.[field] ?? ''));
  const numbers = Object.fromEntries(fields.map((field) => [field, Number(values[field])]));
  const valid =
    fields.every(
      (field) =>
        /^\d+$/.test(values[field]) &&
        Number.isSafeInteger(numbers[field]) &&
        numbers[field] >= (field.startsWith('duration') ? 1 : 0),
    ) &&
    numbers.priceMinCoins <= numbers.priceMaxCoins &&
    numbers.durationMinDays <= numbers.durationMaxDays;
  async function submit(event) {
    event.preventDefault();
    if (busyRef.current || failed || !dirty || !valid || !reason.trim()) return;
    busyRef.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const result = await apiRequest('/admin/policy', {
        method: 'POST',
        body: {
          ...numbers,
          reason: reason.trim(),
          expectedPolicyId: policy?.id ?? null,
          expectedPolicyVersion: policy?.version ?? null,
        },
      });
      if (
        !/^[a-f\d]{24}$/i.test(result?.policyId ?? '') ||
        result.policyId === policy?.id ||
        !Number.isSafeInteger(result.version) ||
        result.version < 0
      )
        throw new Error('Invalid policy response');
      onSaved();
    } catch (error) {
      setFailed(true);
      setError(t(error.code === 'future_policy' ? 'policy.futureBlocked' : 'policy.saveError'));
    } finally {
      busyRef.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form className="mt-6 border-t border-hairline pt-5" onSubmit={submit}>
      <h3 className="font-semibold">{t(policy ? 'policy.replace' : 'policy.initialize')}</h3>
      <p className="mt-2 text-caption text-muted">{t('policy.activationHint')}</p>
      {!policy && <p className="mt-2 text-caption text-muted">{t('policy.initialTerms')}</p>}
      <fieldset disabled={busy || failed} className="nh-grid-12 mt-4 grid gap-5 nh-sm-cols-2">
        {fields.map((field) => (
          <div key={field}>
            <label htmlFor={`${id}-${field}`} className="text-caption font-semibold">
              {t(`policy.${field}`)}
            </label>
            <Input
              id={`${id}-${field}`}
              type="number"
              min={field.startsWith('duration') ? 1 : 0}
              max={Number.MAX_SAFE_INTEGER}
              step="1"
              required
              value={values[field]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field]: event.target.value }))
              }
              className="mt-2"
            />
          </div>
        ))}
      </fieldset>
      <label htmlFor={`${id}-reason`} className="mt-4 block text-caption font-semibold">
        {t('policy.reason')}
      </label>
      <Input
        id={`${id}-reason`}
        required
        maxLength={1000}
        value={reason}
        disabled={busy || failed}
        onChange={(event) => setReason(event.target.value)}
        className="mt-2"
      />
      {dirty && !valid && (
        <p role="alert" className="mt-3 text-caption text-rose-strong">
          {t('policy.invalid')}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-caption text-rose-strong">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="mt-4"
        disabled={busy || failed || !dirty || !valid || !reason.trim()}
      >
        {t(busy ? 'policy.saving' : 'policy.activate')}
      </Button>
    </form>
  );
}
