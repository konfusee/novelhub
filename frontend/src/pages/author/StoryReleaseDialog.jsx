import { useRef, useState } from 'react';
import { useBackendDocument } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { Button, ButtonLink, Modal } from '../../components/ui';

const emptyRelease = { target: {}, checks: [], ready: false };
export function StoryReleaseDialog({ storyId, onClose, onReleased }) {
  return <ReleaseDialog storyId={storyId} onClose={onClose} onReleased={onReleased} />;
}
export function ChapterReleaseDialog({ storyId, chapterId, onClose, onReleased }) {
  return (
    <ReleaseDialog
      storyId={storyId}
      chapterId={chapterId}
      onClose={onClose}
      onReleased={onReleased}
    />
  );
}
function ReleaseDialog({ storyId, chapterId, onClose, onReleased }) {
  const { t } = useLocale();
  const chapter = Boolean(chapterId);
  const endpoint = `/author/stories/${storyId}${chapter ? `/chapters/${chapterId}` : ''}/release`;
  const label = chapter ? 'chapterRelease' : 'storyRelease';
  const resource = useBackendDocument(endpoint, emptyRelease);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const data = resource.data;
  const ready =
    resource.status === 'ready' && data.ready && data.target.revisionId && data.target.submissionId;
  const publish = async () => {
    if (!ready || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: {
          revisionId: data.target.revisionId,
          submissionId: data.target.submissionId,
          expectedVersion: data.target.version,
          ...(chapter ? { expectedStoryVersion: data.target.storyVersion } : {}),
        },
      });
      const released = result?.[chapter ? 'chapter' : 'story'];
      if (!released?.id || released.status !== 'published')
        throw new Error(t('storyRelease.failed'));
      onReleased();
    } catch (failure) {
      setError(failure.message || t('storyRelease.failed'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={t(!chapter && data.target.restoring ? 'storyRelease.restoreTitle' : `${label}.title`)}
      onClose={() => !busy && onClose()}
    >
      <p className="text-sm leading-6 text-muted">
        {t(!chapter && data.target.restoring ? 'storyRelease.restoreHint' : `${label}.hint`)}
      </p>
      {resource.status === 'loading' ? (
        <p role="status" className="mt-4 text-sm">
          {t('authorDraftActions.loading')}
        </p>
      ) : resource.status !== 'ready' ? (
        <p role="alert" className="mt-4 text-sm text-rose-strong">
          {resource.error?.message || t('storyRelease.failed')}
        </p>
      ) : (
        <>
          <h3 className="mt-4 break-words text-base font-semibold">{data.target.title}</h3>
          <ul className="mt-4 space-y-3">
            {data.checks.map((check) => (
              <li
                key={check.code}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-sm"
              >
                <span>{t(`${label}.checks.${check.code}`)}</span>
                <strong className={check.ok ? 'text-brand-strong' : 'text-rose-strong'}>
                  {t(check.ok ? 'submissionData.pass' : 'submissionData.fail')}
                </strong>
              </li>
            ))}
          </ul>
          {data.target.submissionId && (
            <ButtonLink
              className="mt-4"
              size="sm"
              variant="secondary"
              to={`/author/submissions/${data.target.submissionId}/preview`}
            >
              {t('submissionPackage.title')}
            </ButtonLink>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-strong">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {t('submissionData.cancel')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={resource.retry}>
          {t('storyRelease.checkAgain')}
        </Button>
        <Button disabled={!ready || busy} onClick={publish}>
          {t(busy ? 'storyRelease.publishing' : 'storyRelease.confirm')}
        </Button>
      </div>
    </Modal>
  );
}
