import { useId, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, RotateCcw } from '../../components/icons';
import { AdminLayout } from '../../layouts';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
  Input,
} from '../../components/ui';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

export function AuthorAgreementPage() {
  const { userId } = useParams();
  const { t, formatDate, formatNumber } = useLocale();
  const resource = useBackendDocument(`/admin/authors/${userId}/agreement`, null);
  const [saved, setSaved] = useState(null);
  const current = resource.status === 'ready' ? resource.data : null;
  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <ButtonLink to="/admin/users" variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft size={16} />
          {t('agreement.back')}
        </ButtonLink>
        <p className="mt-4 text-caption text-ink/70">{t('agreement.breadcrumb')}</p>
        <h1 className="mt-1 text-h2 sm:text-h1">
          {current ? `${current.author.name} · ` : ''}
          {t('agreement.title')}
        </h1>
        {resource.status === 'loading' ? (
          <Card className="mt-6" aria-busy="true">
            <span className="sr-only">{t('agreement.loading')}</span>
            <Skeleton className="h-6 w-48" />
            <div className="nh-grid-12 mt-5 grid gap-5 nh-sm-cols-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="mt-5 h-3 w-full" />
          </Card>
        ) : !current ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={AlertTriangle}
              tone="rose"
              title={t(resource.status === 'empty' ? 'agreement.missing' : 'agreement.error')}
              description={t('agreement.noFallback')}
              action={
                <Button variant="secondary" size="sm" onClick={resource.retry}>
                  <RotateCcw size={15} />
                  {t('agreement.retry')}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-ink/70">
              <Badge tone="green">{t(`agreement.source.${current.source}`)}</Badge>
              <span>
                #{current.author.id}
                {current.effectiveAt ? ` · ${formatDate(current.effectiveAt)}` : ''}
              </span>
            </p>
            {saved?.authorId === userId && (
              <p role="status" className="mt-4 text-sm text-brand-strong">
                {t('agreement.saved', { percentage: saved.rate.percentage })}
              </p>
            )}
            <AgreementForm
              key={`${userId}:${current.accountVersion}:${current.latestRateId}`}
              data={current}
              onReload={resource.retry}
              onSaved={(result) => {
                setSaved(result);
                resource.retry();
              }}
            />
            <Card className="mt-6">
              <h2 className="text-h3">{t('agreement.history')}</h2>
              <p className="mt-1 text-caption text-muted">{t('agreement.historyHint')}</p>
              {current.history.length ? (
                <ul className="mt-4 divide-y divide-hairline">
                  {current.history.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                    >
                      <span>
                        {formatDate(item.effectiveAt)} · {formatNumber(item.percentage)}%
                      </span>
                      <Badge tone={item.scheduled ? 'neutral' : 'green'}>
                        {t(item.scheduled ? 'agreement.scheduled' : 'agreement.recorded')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">{t('agreement.noHistory')}</p>
              )}
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function AgreementForm({ data, onReload, onSaved }) {
  const { t, formatNumber } = useLocale();
  const id = useId();
  const [share, setShare] = useState(String(data.authorShare));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const busyRef = useRef(false);
  const percentage = Number(share);
  const valid =
    share.trim() !== '' && Number.isInteger(percentage) && percentage >= 0 && percentage <= 100;
  const dirty = valid && percentage !== data.authorShare;
  const editable = data.canEdit === true && Number.isInteger(data.accountVersion);
  const save = async (event) => {
    event.preventDefault();
    if (busyRef.current || stale || !editable || !dirty || !reason.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest(`/admin/authors/${data.author.id}/agreement`, {
        method: 'POST',
        body: {
          percentage,
          reason: reason.trim(),
          expectedAccountVersion: data.accountVersion,
          expectedLatestRateId: data.latestRateId,
        },
      });
      if (
        result?.authorId !== data.author.id ||
        result?.rate?.percentage !== percentage ||
        !result.rate.id ||
        !Number.isFinite(new Date(result.rate.effectiveAt).getTime())
      )
        throw new Error(t('agreement.failed'));
      onSaved(result);
    } catch (failure) {
      setError(failure.message || t('agreement.failed'));
      // A lost response can follow a committed write: reload before another attempt.
      setStale(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <Card className="mt-6">
      <form onSubmit={save} aria-busy={busy}>
        <h2 className="text-h3">{t('agreement.split')}</h2>
        <p className="mt-1 text-caption text-muted">
          {t(editable ? 'agreement.editHint' : 'agreement.readOnly')}
        </p>
        <div className="nh-grid-12 mt-5 grid gap-5 nh-sm-cols-2">
          <div>
            <label
              id={`${id}-author-label`}
              htmlFor={`${id}-author`}
              className="text-sm font-semibold"
            >
              {t('agreement.author')}
            </label>
            {editable ? (
              <Input
                id={`${id}-author`}
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                step="1"
                value={share}
                disabled={busy || stale}
                aria-invalid={!valid}
                aria-describedby={`${id}-hint`}
                className="mt-2"
                onChange={(event) => setShare(event.target.value)}
              />
            ) : (
              <output
                aria-labelledby={`${id}-author-label`}
                className="mt-2 flex min-h-11 items-center rounded-full border border-hairline bg-elevated px-4 text-sm text-ink/80"
              >
                {formatNumber(data.authorShare)}%
              </output>
            )}
          </div>
          <div>
            <p id={`${id}-platform`} className="text-sm font-semibold">
              {t('agreement.platform')}
            </p>
            <output
              aria-labelledby={`${id}-platform`}
              className="mt-2 flex min-h-11 items-center rounded-full border border-hairline bg-elevated px-4 text-sm text-ink/80"
            >
              {valid ? `${formatNumber(100 - percentage)}%` : '—'}
            </output>
          </div>
        </div>
        <ProgressBar
          value={valid ? percentage : 0}
          size="lg"
          label={t('agreement.author')}
          className="mt-5"
        />
        <p
          id={`${id}-hint`}
          className={`mt-4 text-caption ${valid ? 'text-ink/70' : 'text-rose-strong'}`}
        >
          {t(valid ? 'agreement.total' : 'agreement.invalid')}
        </p>
        {editable && (
          <div className="mt-5">
            <label htmlFor={`${id}-reason`} className="text-sm font-semibold">
              {t('agreement.reason')}
            </label>
            <Input
              id={`${id}-reason`}
              value={reason}
              maxLength={1000}
              disabled={busy || stale}
              className="mt-2"
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="mt-2 text-caption text-muted">{t('agreement.futureHint')}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-strong">
            {error} {t('agreement.reloadRequired')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onReload}>
            <RotateCcw size={16} />
            {t('agreement.reload')}
          </Button>
          {editable && (share !== String(data.authorShare) || reason !== '') && (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || stale}
                onClick={() => {
                  setShare(String(data.authorShare));
                  setReason('');
                }}
              >
                {t('agreement.discard')}
              </Button>
              <Button type="submit" disabled={!dirty || !reason.trim() || busy || stale}>
                {t(busy ? 'agreement.saving' : 'agreement.save')}
              </Button>
            </>
          )}
        </div>
      </form>
    </Card>
  );
}
