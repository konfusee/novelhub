import { useRef, useState } from 'react';
import { useBackendDocument } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { Button, ButtonLink, Input, Modal } from '../../components/ui';

const emptySchedule = { target: {}, checks: [], ready: false };
function localTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function ChapterScheduleDialog({ storyId, chapterId, onClose, onSaved }) {
  const { t } = useLocale();
  const endpoint = `/author/stories/${storyId}/chapters/${chapterId}/schedule`;
  const resource = useBackendDocument(endpoint, emptySchedule);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open title={t('chapterSchedule.title')} onClose={() => !busy && onClose()}>
      {resource.status === 'ready' ? (
        <ScheduleForm
          key={`${resource.data.target.version}:${resource.data.target.storyVersion}`}
          data={resource.data}
          endpoint={endpoint}
          chapterId={chapterId}
          busy={busy}
          setBusy={setBusy}
          onClose={onClose}
          onSaved={onSaved}
          onReload={resource.retry}
        />
      ) : (
        <>
          <p
            className="text-sm text-muted"
            role={resource.status === 'loading' ? 'status' : 'alert'}
          >
            {resource.status === 'loading'
              ? t('authorDraftActions.loading')
              : resource.error?.message || t('chapterSchedule.failed')}
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('submissionData.cancel')}
            </Button>
            <Button
              variant="secondary"
              disabled={resource.status === 'loading'}
              onClick={resource.retry}
            >
              {t('storyRelease.checkAgain')}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ScheduleForm({ data, endpoint, chapterId, busy, setBusy, onClose, onSaved, onReload }) {
  const { t } = useLocale();
  const [value, setValue] = useState(() => localTime(data.requestedReleaseAt));
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const busyRef = useRef(false);
  const date = new Date(value);
  const valid = Boolean(value && Number.isFinite(date.getTime()) && localTime(date) === value);
  const ready = data.ready && data.target.revisionId && data.target.submissionId;
  const changed = value !== localTime(data.requestedReleaseAt);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const save = async (cancel) => {
    if (busyRef.current || stale || (cancel ? !data.canCancel : !ready || !valid || !changed))
      return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest(endpoint, {
        method: 'PUT',
        body: {
          revisionId: data.target.revisionId,
          submissionId: data.target.submissionId,
          expectedVersion: data.target.version,
          expectedStoryVersion: data.target.storyVersion,
          requestedReleaseAt: cancel ? null : date.toISOString(),
        },
      });
      if (
        result?.chapter?.id !== chapterId ||
        !(cancel
          ? result.chapter.status === 'approved' && result.chapter.requestedReleaseAt === null
          : ['scheduled', 'due'].includes(result.chapter.status) &&
            result.chapter.requestedReleaseAt &&
            new Date(result.chapter.requestedReleaseAt).getTime() === date.getTime())
      )
        throw new Error(t('chapterSchedule.failed'));
      onSaved(cancel);
    } catch (failure) {
      setError(failure.message || t('chapterSchedule.failed'));
      if (failure.status === 409) setStale(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <h3 className="break-words text-base font-semibold">{data.target.title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted">{t('chapterSchedule.hint')}</p>
      {data.status === 'due' && (
        <p role="status" className="mt-3 text-sm text-orange-strong">
          {t('chapterSchedule.due')}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {data.checks.map((check) => (
          <li key={check.code} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
            <span>{t(`chapterRelease.checks.${check.code}`)}</span>
            <strong className={check.ok ? 'text-brand-strong' : 'text-rose-strong'}>
              {t(check.ok ? 'submissionData.pass' : 'submissionData.fail')}
            </strong>
          </li>
        ))}
      </ul>
      {data.waiting?.length > 0 && (
        <p className="mt-3 text-sm leading-6 text-muted">{t('chapterSchedule.waiting')}</p>
      )}
      {data.target.submissionId && (
        <ButtonLink
          className="mt-4"
          variant="secondary"
          size="sm"
          to={`/author/submissions/${data.target.submissionId}/preview`}
        >
          {t('submissionPackage.title')}
        </ButtonLink>
      )}
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
      >
        <label htmlFor="chapter-release-time" className="mb-2 block text-sm font-semibold">
          {t('chapterSchedule.time')}
        </label>
        <Input
          id="chapter-release-time"
          type="datetime-local"
          value={value}
          step="60"
          required
          aria-describedby="chapter-release-zone"
          disabled={busy || stale || !ready}
          onChange={(event) => setValue(event.target.value)}
        />
        <p id="chapter-release-zone" className="mt-2 break-words text-xs text-muted">
          {t('chapterSchedule.zone', { zone })}
        </p>
        {valid && date <= new Date() && (
          <p className="mt-2 text-sm text-orange-strong">{t('chapterSchedule.elapsed')}</p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-strong">
            {error}
          </p>
        )}
        {stale && <p className="mt-2 text-sm text-muted">{t('chapterSchedule.stale')}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t('submissionData.cancel')}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onReload}>
            {t('storyRelease.checkAgain')}
          </Button>
          {data.canCancel && (
            <Button
              type="button"
              variant="danger"
              disabled={busy || stale}
              onClick={() => save(true)}
            >
              {t('chapterSchedule.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={busy || stale || !ready || !valid || !changed}>
            {t(busy ? 'chapterSchedule.saving' : 'chapterSchedule.save')}
          </Button>
        </div>
      </form>
    </>
  );
}
