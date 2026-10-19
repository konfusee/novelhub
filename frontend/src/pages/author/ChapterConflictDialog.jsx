import { useRef, useState } from 'react'
import { Button, Input, Modal } from '../../components/ui'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { RichChapterInput } from './RichChapterInput'
import { DraftReadingCanvas } from './DraftReadingCanvas'
import { richChapterBody } from './richChapterDom'

const empty = Object.freeze({ chapter: null })
export function ChapterConflictDialog({ chapter, title, body, richDocument, onClose, onApply }) {
  const rich = Boolean(richDocument)
  const richRef = useRef(null)
  const [mergedDocument, setMergedDocument] = useState(richDocument)
  const { t } = useLocale()
  const resource = useBackendDocument(
    `/author/stories/${chapter.storyId}/chapters/${chapter.id}${rich ? '?format=rich' : ''}`,
    empty,
  )
  const [mergedTitle, setMergedTitle] = useState(title)
  const [mergedBody, setMergedBody] = useState(body)
  const [checked, setChecked] = useState(false)
  const latest = resource.data.chapter
  const valid =
    resource.status === 'ready' &&
    latest?.id === chapter.id &&
    latest.storyId === chapter.storyId &&
    Number.isSafeInteger(latest.version) &&
    latest.version >= 0 &&
    (rich
      ? Array.isArray(latest.document?.blocks)
      : Array.isArray(latest.paragraphs) &&
        latest.paragraphs.every(text => typeof text === 'string')) &&
    typeof latest.title === 'string'
  const canApply = valid && latest.canEdit && checked && Boolean(mergedTitle.trim())
  function refresh() {
    setChecked(false)
    resource.retry()
  }
  return (
    <Modal open title={t('chapterConflict.title')} className="max-w-4xl" onClose={onClose}>
      <p className="text-sm leading-6 text-muted">{t('chapterConflict.hint')}</p>
      {resource.status === 'loading' ? (
        <p role="status" className="mt-4 text-sm text-muted">
          {t('chapterConflict.loading')}
        </p>
      ) : (
        <>
          {!valid && (
            <p role="alert" className="mt-4 text-sm text-rose-strong">
              {t('chapterConflict.loadError')}
            </p>
          )}
          {valid && (
            <div className="mt-4 grid min-w-0 gap-5 sm:grid-cols-2">
              <section className="min-w-0 space-y-3" aria-label={t('chapterConflict.latest')}>
                <h3 className="text-sm font-semibold">{t('chapterConflict.latest')}</h3>
                <label className="block text-xs text-muted" htmlFor="conflict-latest-title">
                  {t('chapterConflict.latestTitle')}
                </label>
                <Input id="conflict-latest-title" readOnly value={latest.title} />
                <label className="block text-xs text-muted" htmlFor="conflict-latest-body">
                  {t('chapterConflict.latestBody')}
                </label>
                {rich ? (
                  <DraftReadingCanvas document={latest.document} storyTitle={chapter.storyTitle} />
                ) : (
                  <textarea
                    id="conflict-latest-body"
                    readOnly
                    value={latest.paragraphs.join('\n\n')}
                    className="h-56 w-full resize-y rounded-2xl border border-line bg-elevated p-3 text-sm leading-6 text-ink"
                  />
                )}
              </section>
              <section className="min-w-0 space-y-3" aria-label={t('chapterConflict.merged')}>
                <h3 className="text-sm font-semibold">{t('chapterConflict.merged')}</h3>
                <label className="block text-xs text-muted" htmlFor="conflict-merged-title">
                  {t('chapterConflict.mergedTitle')}
                </label>
                <Input
                  id="conflict-merged-title"
                  maxLength={200}
                  value={mergedTitle}
                  onChange={event => {
                    setMergedTitle(event.target.value)
                    setChecked(false)
                  }}
                />
                <label className="block text-xs text-muted" htmlFor="conflict-merged-body">
                  {t('chapterConflict.mergedBody')}
                </label>
                {rich ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMergedTitle(latest.document.title)
                        setMergedDocument(latest.document)
                        richRef.current?.replace(latest.document)
                        setChecked(false)
                      }}
                    >
                      {t('richEditor.useServer')}
                    </Button>
                    <RichChapterInput
                      ref={richRef}
                      initialDocument={richDocument}
                      label={t('chapterConflict.mergedBody')}
                      onChange={document => {
                        setMergedDocument(document)
                        setChecked(false)
                      }}
                      onSave={() => {}}
                      onError={() => setChecked(false)}
                    />
                  </>
                ) : (
                  <textarea
                    id="conflict-merged-body"
                    value={mergedBody}
                    onChange={event => {
                      setMergedBody(event.target.value)
                      setChecked(false)
                    }}
                    className="h-56 w-full resize-y rounded-2xl border border-line bg-surface p-3 text-sm leading-6 text-ink"
                  />
                )}
              </section>
            </div>
          )}
          {valid && !latest.canEdit && (
            <p role="alert" className="mt-4 text-sm text-rose-strong">
              {t('chapterConflict.locked')}
            </p>
          )}
          {valid && latest.canEdit && (
            <label className="mt-4 flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                checked={checked}
                onChange={event => setChecked(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-brand"
              />
              <span>{t('chapterConflict.confirm')}</span>
            </label>
          )}
        </>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          {t('chapterConflict.cancel')}
        </Button>
        <Button variant="secondary" disabled={resource.status === 'loading'} onClick={refresh}>
          {t('chapterConflict.refresh')}
        </Button>
        <Button
          disabled={!canApply}
          onClick={() => {
            if (canApply)
              onApply(
                rich
                  ? {
                      title: mergedTitle,
                      body: richChapterBody(mergedDocument),
                      document: { ...mergedDocument, title: mergedTitle },
                      version: latest.version,
                    }
                  : { title: mergedTitle, body: mergedBody, version: latest.version },
              )
          }}
        >
          {t('chapterConflict.apply')}
        </Button>
      </div>
    </Modal>
  )
}
