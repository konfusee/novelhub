import { useParams } from 'react-router';
import { AuthorLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { Badge, Button, ButtonLink, Card } from '../../components/ui';
import { DraftReadingCanvas } from './DraftReadingCanvas';

export function SubmittedPackagePage() {
  const { submissionId } = useParams();
  const { t, formatDate, formatNumber } = useLocale();
  const resource = useBackendDocument(`/author/submissions/${submissionId}/package`, null);
  const data = resource.data;
  const back = data
    ? `/author/submissions?${new URLSearchParams({ storyId: data.story.id, ...(data.chapter ? { chapterId: data.chapter.id } : {}) })}`
    : '/author/submissions';
  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-h2">{t('submissionPackage.title')}</h1>
            <p className="mt-2 text-sm leading-6 text-muted">{t('submissionPackage.hint')}</p>
          </div>
          <ButtonLink to={back} variant="secondary">
            {t('submissionPackage.back')}
          </ButtonLink>
        </div>
        {resource.status === 'loading' ? (
          <p role="status">{t('authorDraftActions.loading')}</p>
        ) : resource.status !== 'ready' || !data ? (
          <Card>
            <p role="alert">{resource.error?.message || t('submissionPackage.unavailable')}</p>
            <Button className="mt-3" variant="secondary" onClick={resource.retry}>
              {t('chapterLifecycle.reload')}
            </Button>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{t(`submissionData.status.${data.submission.status}`)}</Badge>
                <span className="text-sm text-muted">
                  {t('submissionData.revision')} {formatNumber(data.revision.number)}
                </span>
                <span className="text-sm text-muted">
                  {formatDate(data.submission.submittedAt)}
                </span>
              </div>
              <h2 className="mt-4 text-h3">{t('submissionData.rights')}</h2>
              <p className="mt-2 text-sm">
                {t(
                  data.rights.basis === 'licensed'
                    ? 'submissionData.licensed'
                    : 'submissionData.original',
                )}
              </p>
              <p className="mt-2 text-sm text-muted">{t('submissionPackage.declarationHint')}</p>
              {data.rights.sourceLicenceNote && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {data.rights.sourceLicenceNote}
                </p>
              )}
              <p className="mt-3 text-sm text-muted">
                {t('submissionPackage.images', { count: data.media.length })}
              </p>
            </Card>
            {data.chapter ? (
              <DraftReadingCanvas
                document={data.chapter.document}
                storyTitle={data.story.title}
                submissionId={data.submission.id}
                headingLevel={2}
              />
            ) : (
              <Card>
                <h2 className="text-h2">{data.metadata.title}</h2>
                <p className="mt-4 whitespace-pre-wrap break-words leading-7">
                  {data.metadata.description}
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </AuthorLayout>
  );
}
