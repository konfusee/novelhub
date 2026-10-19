import { useParams } from 'react-router';
import { AuthorLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
import { Button, ButtonLink, Card } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
import { DraftReadingCanvas } from './DraftReadingCanvas';

const emptyWorkspace = { story: {}, chapters: [] };
const emptyChapter = { chapter: null };
export function AuthorPreviewPage() {
  const { storyId, chapterId } = useParams();
  const { t } = useLocale();
  const resource = useBackendDocument(`/author/stories/${storyId}/workspace`, emptyWorkspace);
  const chapters = [...resource.data.chapters]
    .filter((chapter) => chapter.status !== 'archived')
    .sort((a, b) => a.number - b.number);
  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{t('authorDraftActions.privatePreview')}</p>
          <ButtonLink to={`/author/stories/${storyId}`} variant="secondary">
            {t('editorData.backToManager')}
          </ButtonLink>
        </div>
        {resource.status === 'loading' ? (
          <p role="status">{t('authorDraftActions.loading')}</p>
        ) : resource.status === 'error' ? (
          <Card>
            <p role="alert">{resource.error?.message}</p>
            <Button onClick={resource.retry}>{t('chapterLifecycle.reload')}</Button>
          </Card>
        ) : !chapters.length ? (
          <Card>{t('authorDraftActions.noChapters')}</Card>
        ) : (
          <PreviewChapter
            key={chapterId ?? chapters[0].id}
            storyId={storyId}
            chapterId={chapterId ?? chapters[0].id}
            chapters={chapters}
          />
        )}
      </div>
    </AuthorLayout>
  );
}

function PreviewChapter({ storyId, chapterId, chapters }) {
  const { t } = useLocale();
  const resource = useBackendDocument(
    `/author/stories/${storyId}/chapters/${chapterId}?format=rich`,
    emptyChapter,
  );
  const chapter = resource.data.chapter;
  const index = chapters.findIndex((item) => item.id === chapterId);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {index > 0 && (
          <ButtonLink
            variant="secondary"
            to={`/author/stories/${storyId}/chapters/${chapters[index - 1].id}/preview`}
          >
            {t('authorDraftActions.previous')}
          </ButtonLink>
        )}
        {chapters[index + 1] && (
          <ButtonLink
            variant="secondary"
            to={`/author/stories/${storyId}/chapters/${chapters[index + 1].id}/preview`}
          >
            {t('authorDraftActions.next')}
          </ButtonLink>
        )}
        <ButtonLink
          variant="secondary"
          to={`/author/stories/${storyId}/chapters/${chapterId}/edit`}
        >
          {t('authorDraftActions.edit')}
        </ButtonLink>
        <Button variant="secondary" onClick={resource.retry}>
          {t('chapterLifecycle.reload')}
        </Button>
      </div>
      {resource.status === 'loading' ? (
        <p role="status">{t('authorDraftActions.loading')}</p>
      ) : resource.status === 'error' || resource.status === 'empty' ? (
        <Card>
          <p role="alert">{resource.error?.message || t('authorDraftActions.unavailable')}</p>
        </Card>
      ) : (
        chapter && (
          <DraftReadingCanvas document={chapter.document} storyTitle={chapter.storyTitle} />
        )
      )}
    </>
  );
}
