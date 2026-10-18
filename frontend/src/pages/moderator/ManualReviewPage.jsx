import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import { apiRequest } from '../../api/client';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { ROUTES } from '../../app/routes';
import { ModeratorLayout } from '../../layouts';
import { Button, ButtonLink, Card, Input, Modal } from '../../components/ui';
export function ManualReviewPage() {
  const { submissionId } = useParams();
  const feed = useBackendDocument(`/moderator/manual-reviews/${submissionId}`, null);
  const { t } = useLocale();
  const m = (key) => t(`manualReview.${key}`);
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-h2 sm:text-h1">{m('title')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">{m('description')}</p>
          </div>
          <ButtonLink to={`${ROUTES.moderatorClaims}?view=intake`} variant="secondary">
            {m('queue')}
          </ButtonLink>
        </div>
        {feed.status !== 'ready' ? (
          <Card className="mt-6">
            <p role={feed.status === 'loading' ? 'status' : 'alert'}>
              {feed.status === 'loading' ? m('loading') : feed.error?.message || m('error')}
            </p>
            <Button
              className="mt-4"
              variant="secondary"
              disabled={feed.status === 'loading'}
              onClick={feed.retry}
            >
              {m('reload')}
            </Button>
          </Card>
        ) : (
          <LoadedManualReview key={submissionId} data={feed.data} reload={feed.retry} />
        )}
      </div>
    </ModeratorLayout>
  );
}
function LoadedManualReview({ data, reload }) {
  const { t } = useLocale();
  const m = (key) => t(`manualReview.${key}`);
  const [outcome, setOutcome] = useState('approved'),
    [reason, setReason] = useState(''),
    [acknowledged, setAcknowledged] = useState(false);
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current || error) return;
    lock.current = true;
    setBusy(true);
    const admission = data.canAdmit;
    try {
      const response = await apiRequest(
        `/moderator/manual-reviews/${data.submission.id}/${admission ? 'admit' : 'decision'}`,
        {
          method: 'POST',
          body: {
            expectedVersion: data.submission.version,
            revisionId: data.revision.id,
            expectedEvidenceVersion: data.evidence.version,
            confirmedManualReview: acknowledged,
            reason: reason.trim(),
            ...(!admission
              ? {
                  expectedClaimVersion: data.submission.claimVersion,
                  expectedRevisionVersion: data.revision.version,
                  evidenceBatchId: data.evidence.id,
                  outcome,
                }
              : {}),
          },
        },
      );
      if (
        admission
          ? response?.claim?.id !== data.submission.id || response.status !== 'pending-review'
          : response?.id !== data.submission.id || response.status !== outcome
      )
        throw new Error(m('invalidResponse'));
      setConfirm(false);
      reload();
    } catch (e) {
      setError(e.message || m('invalidResponse'));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="nh-grid-12 mt-6 grid gap-6 nh-layout-xl-8-4">
      <div className="min-w-0 space-y-6">
        <Card>
          <p className="break-all text-xs text-muted">
            {data.submission.id} · {data.revision.id}
          </p>
          <h2 className="mt-3 text-h3">{data.title}</h2>
          <p className="mt-2 text-sm text-muted">
            {m('status')}: {m(`statuses.${data.submission.status}`)}
          </p>
          {data.metadata && (
            <p className="mt-5 whitespace-pre-wrap break-words leading-7 text-ink">
              {data.metadata.description}
            </p>
          )}
          {data.paragraphs.map((text, index) => (
            <p key={index} className="mt-5 whitespace-pre-wrap break-words leading-8 text-ink">
              {text}
            </p>
          ))}
        </Card>
        <Card>
          <h2 className="text-h3">{m('rights')}</h2>
          <p className="mt-3 text-sm">
            {m(data.rights.basis === 'licensed' ? 'licensed' : 'original')}
          </p>
          {data.rights.sourceLicenceNote && (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
              {data.rights.sourceLicenceNote}
            </p>
          )}
          <p className="mt-4 break-all text-xs text-muted">
            {m('digest')}: {data.revision.packageDigest}
          </p>
        </Card>
        <Card>
          <h2 className="text-h3">{m('history')}</h2>
          <ul className="mt-4 space-y-4">
            {data.history.map((item) => (
              <li key={item.id} className="border-t border-line pt-3 text-sm">
                <p>
                  {new Date(item.occurredAt).toLocaleString('vi-VN')} ·{' '}
                  {item.outcome ? m(`statuses.${item.outcome}`) : '—'}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-muted">{item.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="min-w-0 self-start">
        <h2 className="text-h3">{m(data.canAdmit ? 'admit' : 'decision')}</h2>
        <p className="mt-3 text-sm text-muted">{m('aiDeferred')}</p>
        {data.canAdmit || data.canDecide ? (
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setConfirm(true);
            }}
          >
            {data.canDecide && (
              <fieldset className="space-y-3">
                <legend className="mb-3 text-sm font-semibold">{m('outcome')}</legend>
                {['approved', 'rejected', 'revision-requested'].map((value) => (
                  <label className="flex items-start gap-3 text-sm" key={value}>
                    <input
                      type="radio"
                      name="review-outcome"
                      value={value}
                      checked={outcome === value}
                      onChange={() => setOutcome(value)}
                    />
                    <span>{m(`statuses.${value}`)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <div>
              <label htmlFor="manual-review-reason" className="mb-2 block text-sm font-semibold">
                {m('reason')}
              </label>
              <Input
                id="manual-review-reason"
                minLength={10}
                maxLength={1000}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>{m('acknowledgement')}</span>
            </label>
            <Button type="submit" disabled={!acknowledged || reason.trim().length < 10}>
              {m(data.canAdmit ? 'admit' : 'decision')}
            </Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted">{m('claimRequired')}</p>
        )}
        <ButtonLink to={ROUTES.moderatorClaims} variant="secondary" className="mt-4">
          {m('claims')}
        </ButtonLink>
        <Button variant="ghost" className="mt-4" onClick={reload}>
          {m('reload')}
        </Button>
      </Card>
      {confirm && (
        <Modal
          open
          title={m('confirmTitle')}
          onClose={() => {
            if (!busy) setConfirm(false);
          }}
        >
          <p className="text-sm">{m(data.canAdmit ? 'admitNote' : 'decisionNote')}</p>
          {!data.canAdmit && <p className="mt-3 font-semibold">{m(`statuses.${outcome}`)}</p>}
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">{reason}</p>
          {error && (
            <div className="mt-3 space-y-2 text-sm text-rose-strong" role="alert">
              <p>{error}</p>
              <p>{m('reloadRequired')}</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>
              {m('close')}
            </Button>
            <Button disabled={busy || !!error} onClick={submit}>
              {m(busy ? 'saving' : 'confirm')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
