import { useId, useRef, useState } from 'react';
import { Button, Input, Modal } from '../../components/ui';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';

const actionTime = () => Date.now();
export function PolicyReschedulingDialog({ policy, onClose, onSaved, onReload }) {
  const { t, locale } = useLocale();
  const id = useId();
  const [effectiveAt, setEffectiveAt] = useState('');
  const [reason, setReason] = useState('');
  const [validationTime, setValidationTime] = useState(actionTime);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const selected = new Date(effectiveAt);
  const valid = Boolean(
    policy.future &&
    effectiveAt &&
    Number.isFinite(selected.getTime()) &&
    selected.getTime() > validationTime &&
    selected.getTime() !== new Date(policy.effectiveAt).getTime(),
  );
  async function submit(event) {
    event.preventDefault();
    if (busyRef.current || failed || !valid || !reason.trim()) return;
    const now = actionTime();
    if (selected.getTime() <= now) {
      setValidationTime(now);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const response = await apiRequest(`/admin/policy/${policy.id}/reschedule`, {
        method: 'POST',
        body: {
          expectedVersion: policy.version,
          effectiveAt: selected.toISOString(),
          reason: reason.trim(),
        },
      });
      if (
        !/^[a-f\d]{24}$/i.test(response?.policyId ?? '') ||
        response.policyId === policy.id ||
        !Number.isSafeInteger(response.version) ||
        response.version < 0 ||
        response.previousPolicyId !== policy.id ||
        response.previousVersion !== policy.version + 1 ||
        response.effectiveAt !== selected.toISOString()
      )
        throw new Error('Invalid rescheduling response');
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal open title={t('policyReschedule.title')} onClose={() => !busyRef.current && onClose()}>
      <form onSubmit={submit}>
        <p className="text-sm text-muted">{t('policyReschedule.description')}</p>
        <p className="mt-2 break-all text-caption text-muted">
          {t('policyHistory.identity', { id: policy.id })}
        </p>
        <p className="mt-2 text-caption text-muted">
          {t('policyReschedule.previous', {
            date: new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(policy.effectiveAt)),
          })}
        </p>
        <label htmlFor={`${id}-time`} className="mt-4 block text-caption font-semibold">
          {t('policyReschedule.date')}
        </label>
        <Input
          id={`${id}-time`}
          type="datetime-local"
          required
          max="9999-12-31T23:59"
          step="60"
          className="mt-2"
          value={effectiveAt}
          disabled={busy || failed}
          onChange={(event) => {
            setEffectiveAt(event.target.value);
            setValidationTime(actionTime());
          }}
        />
        <p className="mt-2 text-caption text-muted">
          {t('policy.scheduleZone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
        </p>
        <label htmlFor={`${id}-reason`} className="mt-4 block text-caption font-semibold">
          {t('policyReschedule.reason')}
        </label>
        <Input
          id={`${id}-reason`}
          required
          maxLength={1000}
          className="mt-2"
          value={reason}
          disabled={busy || failed}
          onChange={(event) => setReason(event.target.value)}
        />
        {effectiveAt && !valid && (
          <p role="alert" className="mt-3 text-caption text-rose-strong">
            {t('policyReschedule.invalid')}
          </p>
        )}
        {failed && (
          <p role="alert" className="mt-3 text-caption text-rose-strong">
            {t('policyReschedule.error')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t('policyCancel.close')}
          </Button>
          {failed ? (
            <Button type="button" onClick={onReload}>
              {t('policyCancel.reload')}
            </Button>
          ) : (
            <Button type="submit" disabled={busy || !valid || !reason.trim()}>
              {t(busy ? 'policyReschedule.busy' : 'policyReschedule.confirm')}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
