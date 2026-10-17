import { PolicyHistory } from './PolicyHistory';
import { useState } from 'react';
import { PolicySettingsForm } from './PolicySettingsForm';
import { Button, Card, Skeleton } from '../../components/ui';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

export function PolicySettingsPanel() {
  const { t, formatNumber, formatDate } = useLocale();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const resource = useBackendDocument('/admin/policy', null);
  const policy = resource.status === 'ready' ? resource.data.policy : null;
  return (
    <Card className="mt-6" aria-busy={resource.status === 'loading'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h3">{t('policy.title')}</h2>
          <p className="mt-1 text-caption text-muted">{t('policy.description')}</p>
        </div>
        <Button
          variant="secondary"
          disabled={busy || resource.status === 'loading'}
          onClick={resource.retry}
        >
          {t('policy.reload')}
        </Button>
      </div>
      {resource.status === 'loading' ? (
        <div className="mt-6" role="status">
          <span className="sr-only">{t('policy.loading')}</span>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : resource.status === 'error' ? (
        <p role="alert" className="mt-6 text-rose-strong">
          {t('policy.error')}
        </p>
      ) : !policy ? (
        <p role="status" className="mt-6 text-muted">
          {t('policy.empty')}
        </p>
      ) : (
        <>
          <p className="mt-6 text-caption text-muted">
            {t('policy.effective')} {formatDate(policy.effectiveAt)}
          </p>
          <dl className="nh-grid-12 mt-4 grid gap-5 nh-sm-cols-2">
            {[
              'priceMinCoins',
              'priceMaxCoins',
              'durationMinDays',
              'durationMaxDays',
              'authorSharePercent',
              'platformSharePercent',
              'withdrawalThresholdCoins',
              'orderExpiryHours',
              'claimExpiryHours',
            ].map((key) => (
              <div key={key} className="rounded-2xl bg-elevated p-4">
                <dt className="text-caption text-muted">{t(`policy.${key}`)}</dt>
                <dd className="mt-1 font-semibold">{formatNumber(policy[key])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-caption text-muted">{t('policy.agreement')}</p>
        </>
      )}
      {saved && (
        <p role="status" className="mt-4 text-brand-strong">
          {t('policy.saved')}
        </p>
      )}
      {resource.status === 'ready' && (
        <>
          <PolicySettingsForm
            key={`${policy?.id ?? 'initial'}:${policy?.version ?? 0}`}
            policy={policy}
            onBusy={setBusy}
            onSaved={() => {
              setSaved(true);
              resource.retry();
            }}
          />
          <PolicyHistory />
        </>
      )}
    </Card>
  );
}
