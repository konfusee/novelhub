import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { Button, ButtonLink, Card, Input } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'
import { DraftReadingCanvas } from './DraftReadingCanvas'

const emptyWorkspace = { story: {}, chapters: [] }
const emptyChapter = { chapter: null }
export function AuthorPreviewPage() {
  const { storyId, chapterId } = useParams()
  const [search] = useSearchParams()
  const { t } = useLocale()
  const source = search.get('source') === 'published' ? 'published' : 'current'
  const resource = useBackendDocument(`/author/stories/${storyId}/workspace`, emptyWorkspace)
  const chapters = [...resource.data.chapters]
    .filter(
      chapter =>
        chapter.status !== 'archived' &&
        (source !== 'published' || chapter.publishedRevisionId),
    )
    .sort((a, b) => a.number - b.number)
  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {t(
              source === 'published'
                ? 'authorDraftActions.publishedPreview'
                : 'authorDraftActions.privatePreview',
            )}
          </p>
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
          <Card>
            {t(
              source === 'published'
                ? 'authorDraftActions.noPublishedChapters'
                : 'authorDraftActions.noChapters',
            )}
          </Card>
        ) : (
          <PreviewChapter
            key={chapterId ?? chapters[0].id}
            storyId={storyId}
            chapterId={chapterId ?? chapters[0].id}
            chapters={chapters}
            source={source}
          />
        )}
      </div>
    </AuthorLayout>
  )
}

function PreviewChapter({ storyId, chapterId, chapters, source }) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const resource = useBackendDocument(
    `/author/stories/${storyId}/chapters/${chapterId}?format=rich&source=${source}`,
    emptyChapter,
  )
  const chapter = resource.data.chapter
  const index = chapters.findIndex(item => item.id === chapterId)
  const chapterPosition = index >= 0 ? `${index + 1}/${chapters.length}` : ''
  const [jumpChapter, setJumpChapter] = useState(index >= 0 ? String(index + 1) : '')
  const [jumpError, setJumpError] = useState(false)
  const previewPath = id =>
    `/author/stories/${storyId}/chapters/${id}/preview${
      source === 'published' ? '?source=published' : ''
    }`
  const submitJump = event => {
    event.preventDefault()
    const target = Number(jumpChapter)
    if (!Number.isInteger(target) || target < 1 || target > chapters.length) {
      setJumpError(true)
      return
    }
    setJumpError(false)
    navigate(previewPath(chapters[target - 1].id))
  }
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-line bg-elevated px-3 py-2 text-sm font-semibold text-ink">
          {t('authorDraftActions.chapterPosition', { position: chapterPosition })}
        </span>
        {index > 0 && (
          <ButtonLink
            variant="secondary"
            to={previewPath(chapters[index - 1].id)}
          >
            {t('authorDraftActions.previous')}
          </ButtonLink>
        )}
        {chapters[index + 1] && (
          <ButtonLink
            variant="secondary"
            to={previewPath(chapters[index + 1].id)}
          >
            {t('authorDraftActions.next')}
          </ButtonLink>
        )}
        <form className="flex items-center gap-2" onSubmit={submitJump}>
          <label htmlFor="author-preview-jump" className="text-sm font-semibold text-ink">
            {t('authorDraftActions.jumpToChapter')}
          </label>
          <Input
            id="author-preview-jump"
            type="number"
            min="1"
            max={chapters.length}
            inputMode="numeric"
            value={jumpChapter}
            onChange={event => {
              setJumpChapter(event.target.value)
              setJumpError(false)
            }}
            aria-invalid={jumpError || undefined}
            className="w-20 text-center"
          />
          <span className="text-sm text-muted">/ {chapters.length}</span>
          <Button type="submit" variant="secondary" size="sm">
            {t('authorDraftActions.jump')}
          </Button>
        </form>
        {jumpError && (
          <p role="alert" className="basis-full text-xs text-rose-strong">
            {t('authorDraftActions.invalidChapterPosition', { count: chapters.length })}
          </p>
        )}
        {source === 'current' ? (
          <ButtonLink
            variant="secondary"
            to={`/author/stories/${storyId}/chapters/${chapterId}/edit`}
          >
            {t('authorDraftActions.edit')}
          </ButtonLink>
        ) : (
          <span className="rounded-full border border-line bg-elevated px-3 py-2 text-sm text-muted">
            {t('authorDraftActions.publishedSnapshot')}
          </span>
        )}
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
  )
}
