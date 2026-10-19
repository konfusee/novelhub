import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router'
import {
  AlertTriangle,
  AlignLeft,
  AtSign,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Heading2,
  Heading3,
  Image,
  Italic,
  MessageSquare,
  PanelLeft,
  PanelRight,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Send,
  Underline,
  X,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { chapterParagraphs, ChapterTextError } from './chapterParagraphs'
import { ChapterConflictDialog } from './ChapterConflictDialog'
import { DraftReadingCanvas } from './DraftReadingCanvas'
import { RichChapterInput } from './RichChapterInput'
import { ChapterImagePicker } from './ChapterImagePicker'
import { ChapterImageControls } from './ChapterImageControls'
import { richChapterBody } from './richChapterDom'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Modal,
  ProgressBar,
  Skeleton,
  SkeletonText,
  Tabs,
} from '../../components/ui'

const TARGET_WORDS = 2500 // Local reference for the self-check panel, not a publishing policy or saved goal.
const WORDS_PER_MINUTE = 250
const SCENE_BREAK = '*     *     *'
const emptyChapter = { chapter: null }
const utilityTabs = [
  { value: 'outline', label: 'Dàn ý' },
  { value: 'notes', label: 'Ghi chú' },
  { value: 'checklist', label: 'Danh sách kiểm tra' },
]

// Plain mode exposes only paragraph-safe tools. Rich mode uses the AST surface.
const tools = [
  [Bold, 'bold', null],
  [Italic, 'italic', null],
  [Underline, 'underline', null],
  [Heading2, 'heading2', null],
  [Heading3, 'heading3', null],
  [Quote, 'quote', null],
  [AlignLeft, 'sceneBreak', () => [`\n\n${SCENE_BREAK}\n\n`, '', '']],
  [MessageSquare, 'dialogue', text => ['“', text, '”']],
  [AtSign, 'mention', text => ['@', text, '']],
  [Image, 'image', null],
]

const countWords = text => text.trim().split(/\s+/).filter(Boolean).length
const paragraphsOf = text =>
  text
    .split(/\n\s*\n/)
    .map(part => part.trim())
    .filter(Boolean)

export function ChapterEditorPage() {
  const [search] = useSearchParams()
  const rich = search.get('mode') === 'rich'
  const { storyId, chapterId } = useParams()
  const { t } = useLocale()
  const resourceKey = `${storyId}:${chapterId}:${rich}`
  const resource = useBackendDocument(
    `/author/stories/${storyId}/chapters/${chapterId}${rich ? '?format=rich' : ''}`,
    emptyChapter,
  )
  const loading = resource.status === 'loading'
  const value = resource.data.chapter
  const chapter = {
    ...resource,
    data: value
      ? {
          ...value,
          body: value.document ? richChapterBody(value.document) : value.paragraphs.join('\n\n'),
          storyMeta: t('editorData.chapterCount', { count: value.outline.length }),
          activeChapter: value.number,
          nextChapter: value.outline.find(item => item.number > value.number),
          groups: [
            {
              act: t('editorData.chapterList'),
              count: value.outline.length,
              chapters: value.outline.map(item => [
                item.number,
                `Chương ${item.number}: ${item.title}`,
                item.id,
              ]),
            },
          ],
        }
      : null,
  }
  const STORY_ROUTE = `/author/stories/${storyId}`
  return (
    <AuthorLayout>
      {chapter.status === 'ready' && chapter.data ? (
        <ChapterEditor key={resourceKey} chapter={chapter.data} />
      ) : (
        <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-reader">
          <EditorHeader
            story={
              loading && (
                <span className="inline-flex h-3 w-28 align-middle">
                  <Skeleton className="h-3 w-full" />
                </span>
              )
            }
            title={
              loading ? (
                <>
                  <span className="sr-only">Đang tải chương</span>
                  <Skeleton className="my-0.5 h-4 w-48 max-w-full" />
                </>
              ) : (
                'Trình soạn thảo chương'
              )
            }
            badges={
              loading && (
                <>
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="hidden h-6 w-32 md:block" />
                </>
              )
            }
          />
          {loading ? (
            <EditorSkeleton />
          ) : (
            <div className="flex-1 px-4 py-8 sm:px-6 lg:py-12">
              <Card className="mx-auto max-w-2xl p-0">
                {chapter.status === 'error' ? (
                  <EmptyState
                    tone="rose"
                    icon={AlertTriangle}
                    title={
                      chapter.error?.code === 'unsupported_editor_format'
                        ? t('editorData.unsupportedTitle')
                        : t('editorData.loadErrorTitle')
                    }
                    description={
                      chapter.error?.code === 'unsupported_editor_format'
                        ? t('editorData.unsupportedFormat')
                        : t('editorData.loadError')
                    }
                    action={
                      <>
                        <RetryButton onClick={chapter.retry} />
                        <ButtonLink to={STORY_ROUTE} variant="secondary" size="sm">
                          {t('editorData.backToManager')}
                        </ButtonLink>
                        {!rich && (
                          <ButtonLink
                            to={`${STORY_ROUTE}/chapters/${chapterId}/edit?mode=rich`}
                            size="sm"
                          >
                            {t('richEditor.open')}
                          </ButtonLink>
                        )}
                      </>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={PenLine}
                    title={t('editorData.notFound')}
                    description={t('editorData.notFoundHint')}
                    action={
                      <>
                        <ButtonLink to={STORY_ROUTE} variant="secondary" size="sm">
                          Về trang quản lý truyện
                        </ButtonLink>
                      </>
                    }
                  />
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </AuthorLayout>
  )
}

function ChapterEditor({ chapter }) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const STORY_ROUTE = `/author/stories/${chapter.storyId}`
  const chapterRoute = id =>
    `${STORY_ROUTE}/chapters/${id}/edit${chapter.document ? '?mode=rich' : ''}`
  const [version, setVersion] = useState(chapter.version)
  const [saveBusy, setSaveBusy] = useState(false)
  const busyRef = useRef(false)
  const [saveError, setSaveError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const bodyRef = useRef(null)
  const rich = Boolean(chapter.document)
  const [richDocument, setRichDocument] = useState(chapter.document)
  const [title, setTitle] = useState(chapter.title)
  const [body, setBody] = useState(chapter.body)
  const [saved, setSaved] = useState(true)
  const [caret, setCaret] = useState(0)
  const [utility, setUtility] = useState('outline')
  const [notes, setNotes] = useState('')
  const groups = chapter.groups
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [imagePicker, setImagePicker] = useState(false)
  const [submit, setSubmit] = useState('idle')
  const words = useMemo(() => countWords(body), [body])
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE))
  const paragraph = paragraphsOf(body.slice(0, caret)).length || 1
  const line = body.slice(0, caret).split('\n').length

  const updateBody = value => {
    setBody(value)
    setSaved(false)
  }
  const applyTool = (edit, key) => {
    if (rich) {
      if (saveBusy || !chapter.canEdit) return
      if (key === 'image') {
        setImagePicker(true)
        return
      }
      if (!bodyRef.current?.format(key)) setSaveError(t('richEditor.selectText'))
      return
    }
    if (!edit || busyRef.current || !chapter.canEdit) return
    const field = bodyRef.current
    if (!field) return
    const { selectionStart: start, selectionEnd: end } = field
    const [before, inner, after] = edit(body.slice(start, end))
    updateBody(`${body.slice(0, start)}${before}${inner}${after}${body.slice(end)}`)
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(start + before.length, start + before.length + inner.length)
      setCaret(start + before.length + inner.length)
    })
  }
  const saveChapter = async () => {
    if (busyRef.current) return false
    if (conflict) return false
    if (saved) return true
    if (!chapter.canEdit) return false
    if (!title.trim()) {
      setSaveError(t('editorData.titleRequired'))
      return false
    }
    busyRef.current = true
    setSaveBusy(true)
    setSaveError('')
    try {
      const paragraphs = rich ? [] : chapterParagraphs(body)
      const result = await apiRequest(`/author/stories/${chapter.storyId}/chapters/${chapter.id}`, {
        method: 'PUT',
        body: {
          ...(rich
            ? { document: { ...richDocument, title: title.trim() } }
            : { title: title.trim(), paragraphs: paragraphs.length ? paragraphs : [''] }),
          expectedVersion: version,
        },
      })
      setVersion(result.chapter.version)
      setSaved(true)
      return true
    } catch (error) {
      if (error.status === 409 && error.code === 'stale_content') {
        setConflict(true)
        setSubmit('idle')
      }
      setSaveError(
        error instanceof ChapterTextError
          ? t(`chapterText.${error.code}`)
          : error.message || t('editorData.saveError'),
      )
      return false
    } finally {
      busyRef.current = false
      setSaveBusy(false)
    }
  }
  const addChapter = async () => {
    if (!chapter.canCreate || busyRef.current) return
    if (!saved && !(await saveChapter())) return
    busyRef.current = true
    setSaveBusy(true)
    setSaveError('')
    try {
      const result = await apiRequest(`/author/stories/${chapter.storyId}/chapters`, {
        method: 'POST',
        body: { title: t('editorData.untitled'), paragraphs: [''] },
      })
      navigate(chapterRoute(result.chapter.id))
    } catch (error) {
      setSaveError(error.message || t('editorData.saveError'))
    } finally {
      busyRef.current = false
      setSaveBusy(false)
    }
  }
  const leave = event => {
    if (!saved && !window.confirm(t('editorData.discard'))) event.preventDefault()
  }
  useEffect(() => {
    if (saved) return
    const warn = event => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved])
  const tree = (
    <ChapterTree
      storyTitle={chapter.storyTitle}
      storyMeta={chapter.storyMeta}
      active={chapter.activeChapter}
      groups={groups}
      onAdd={addChapter}
      storyId={chapter.storyId}
      addDisabled={saveBusy || conflict || !chapter.canCreate}
      onLeave={leave}
      rich={rich}
    />
  )
  const utilityPanel = (
    <WriterUtility
      tab={utility}
      setTab={setUtility}
      body={body}
      title={title}
      words={words}
      saved={saved}
      notes={notes}
      setNotes={setNotes}
    />
  )

  return (
    <div className="flex min-h-[calc(100dvh-var(--app-header-h))] flex-col bg-reader">
      <EditorHeader
        story={
          <Link to={STORY_ROUTE} onClick={leave} className="hover:text-brand-strong">
            {chapter.storyTitle}
          </Link>
        }
        title={title.trim() || 'Chương chưa đặt tên'}
        badges={
          <>
            <Badge tone={submit === 'sent' ? 'purple' : saved ? 'green' : 'orange'}>
              {submit === 'sent'
                ? 'Đã gửi xét duyệt'
                : saved
                  ? t(chapter.canEdit ? 'editorData.saved' : 'editorData.readOnly')
                  : 'Có thay đổi chưa lưu'}
            </Badge>
            <Badge className="tabular-nums">{words.toLocaleString('vi-VN')} từ</Badge>
            <Badge className="hidden md:inline-flex">Đọc trong {minutes} phút</Badge>
          </>
        }
        onOpenLeft={() => setLeftOpen(true)}
        onOpenRight={() => setRightOpen(true)}
        onPreview={() => setPreviewOpen(true)}
        importTo={chapter.canEdit ? `/author/import?storyId=${chapter.storyId}` : null}
        onLeave={leave}
        richTo={!rich ? `${chapterRoute(chapter.id)}?mode=rich` : null}
        onSubmit={() => setSubmit('confirm')}
        submitDisabled={saveBusy || conflict || !chapter.canEdit}
      />

      <div className="nh-grid-12 nh-fade-enter grid min-h-0 flex-1 nh-layout-xl-3-6-3">
        <aside
          aria-label="Dàn ý truyện"
          className="hidden overflow-y-auto border-r border-hairline bg-surface p-5 xl:block"
        >
          {tree}
        </aside>
        <div className="min-w-0">
          <div
            role="toolbar"
            aria-label="Định dạng văn bản"
            className="sticky top-[var(--app-header-h)] z-20 flex items-center gap-2 border-b border-hairline bg-surface/90 px-3 py-2 backdrop-blur"
          >
            <div className="nh-tab-rail flex min-w-0 flex-1 gap-0.5 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] lg:pr-0 lg:[mask-image:none]">
              {tools.map(([Icon, key, edit]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={t(`editorTools.${key}`)}
                  aria-describedby={!edit && !rich ? 'editor-format-support' : undefined}
                  title={
                    edit || rich
                      ? t(`editorTools.${key}`)
                      : t('editorTools.unavailable', { tool: t(`editorTools.${key}`) })
                  }
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => applyTool(edit, key)}
                  disabled={(!edit && !rich) || saveBusy || !chapter.canEdit}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-ink/75 transition-[background-color,color,transform] duration-200 hover:bg-elevated hover:text-brand-strong active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-11"
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            {!rich && (
              <span className="hidden shrink-0 text-xs text-ink/70 tabular-nums lg:inline">
                Đoạn {paragraph} · Dòng {line}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={saveChapter}
              disabled={saved || saveBusy || conflict || !chapter.canEdit}
              className="shrink-0"
            >
              <Save size={14} aria-hidden="true" />
              Lưu
            </Button>
          </div>
          <p
            id="editor-format-support"
            className="border-b border-hairline px-5 py-3 text-xs leading-5 text-muted"
          >
            {t(rich ? 'richEditor.hint' : 'editorTools.plainTextHint')}
          </p>
          {saveError && (
            <p role="alert" className="px-5 pt-4 text-sm text-rose-strong">
              {saveError}
            </p>
          )}
          {conflict && (
            <div className="px-5 pt-3">
              <p className="text-sm leading-6 text-muted">{t('chapterConflict.notice')}</p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => setCompareOpen(true)}
              >
                {t('chapterConflict.open')}
              </Button>
            </div>
          )}
          <article className="mx-auto max-w-[760px] px-5 py-10 sm:px-10 lg:py-14">
            <label htmlFor="chapter-title" className="sr-only">
              Tiêu đề chương
            </label>
            <textarea
              id="chapter-title"
              rows={1}
              value={title}
              disabled={saveBusy || !chapter.canEdit}
              maxLength={200}
              onChange={event => {
                setTitle(event.target.value.replace(/\n/g, ' '))
                setSaved(false)
              }}
              placeholder="Tiêu đề chương"
              className="w-full resize-none border-b border-transparent bg-transparent pb-3 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink outline-none transition-colors [field-sizing:content] placeholder:text-muted hover:border-line focus:border-brand sm:text-4xl"
            />
            <label htmlFor="chapter-body" className="sr-only">
              Nội dung chương
            </label>
            {rich ? (
              <RichChapterInput
                ref={bodyRef}
                initialDocument={chapter.document}
                disabled={saveBusy || !chapter.canEdit}
                label={t('richEditor.body')}
                onChange={document => {
                  setRichDocument(document)
                  updateBody(richChapterBody(document))
                }}
                onSave={saveChapter}
                onError={() => setSaveError(t('richEditor.pasteHint'))}
              />
            ) : (
              <textarea
                id="chapter-body"
                ref={bodyRef}
                value={body}
                disabled={saveBusy || !chapter.canEdit}
                onChange={event => {
                  updateBody(event.target.value)
                  setCaret(event.target.selectionStart)
                }}
                onSelect={event => setCaret(event.currentTarget.selectionStart)}
                onKeyDown={event => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                    event.preventDefault()
                    void saveChapter()
                  }
                }}
                placeholder="Bắt đầu viết chương của bạn…"
                className="mt-6 min-h-[60dvh] w-full resize-none rounded-2xl bg-transparent text-base leading-8 text-ink outline-none [field-sizing:content] placeholder:text-muted sm:text-lg sm:leading-9"
              />
            )}
            {rich && (
              <ChapterImageControls
                document={richDocument}
                disabled={saveBusy || !chapter.canEdit}
                onChange={(index, changes) => bodyRef.current?.changeImage(index, changes)}
              />
            )}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5 text-sm text-muted">
              <span role="status" className="flex items-center gap-2">
                <Save size={14} aria-hidden="true" />
                {saveBusy
                  ? t('editorData.saving')
                  : saved
                    ? t(chapter.canEdit ? 'editorData.saved' : 'editorData.readOnly')
                    : t('editorData.unsaved')}
              </span>
              <ButtonLink
                to={chapter.nextChapter ? chapterRoute(chapter.nextChapter.id) : STORY_ROUTE}
                onClick={leave}
                variant="ghost"
                size="sm"
                trailingIcon={ChevronRight}
                className="text-brand-strong"
              >
                {chapter.nextChapter
                  ? t('editorData.next', { count: chapter.nextChapter.number })
                  : t('editorData.back')}
              </ButtonLink>
            </div>
          </article>
        </div>
        <aside
          aria-label="Trợ lý sáng tác"
          className="hidden overflow-y-auto border-l border-hairline bg-surface xl:block"
        >
          {utilityPanel}
        </aside>
      </div>

      <EditorSheet
        open={leftOpen}
        side="left"
        title="Dàn ý truyện"
        onClose={() => setLeftOpen(false)}
      >
        <div className="p-5">{tree}</div>
      </EditorSheet>
      <EditorSheet
        open={rightOpen}
        side="right"
        title="Trợ lý sáng tác"
        onClose={() => setRightOpen(false)}
      >
        {utilityPanel}
      </EditorSheet>

      {compareOpen && (
        <ChapterConflictDialog
          chapter={chapter}
          title={title}
          body={body}
          richDocument={richDocument}
          onClose={() => setCompareOpen(false)}
          onApply={merged => {
            setTitle(merged.title)
            setBody(merged.body)
            if (merged.document) {
              setRichDocument(merged.document)
              bodyRef.current?.replace(merged.document)
            }
            setVersion(merged.version)
            setSaved(false)
            setConflict(false)
            setSaveError('')
            setCompareOpen(false)
          }}
        />
      )}
      {imagePicker && (
        <ChapterImagePicker
          storyId={chapter.storyId}
          onClose={() => setImagePicker(false)}
          onAdd={block => {
            const added = bodyRef.current?.changeImage(null, block)
            if (added) setImagePicker(false)
            return added
          }}
        />
      )}
      <Modal
        open={previewOpen}
        title="Xem trước cho độc giả"
        onClose={() => setPreviewOpen(false)}
        className="max-w-5xl"
      >
        <p className="mb-4 text-sm text-muted">{t('authorDraftActions.localPreview')}</p>
        <DraftReadingCanvas
          storyTitle={chapter.storyTitle}
          document={
            rich
              ? { ...richDocument, title: title.trim() || t('editorData.untitled') }
              : {
                  title: title.trim() || t('editorData.untitled'),
                  blocks: paragraphsOf(body).map(text =>
                    text === SCENE_BREAK
                      ? { type: 'scene-break' }
                      : { type: 'paragraph', inlines: [{ text, marks: [] }] },
                  ),
                }
          }
        />
      </Modal>

      <Modal
        open={submit === 'confirm' || submit === 'sending'}
        title="Gửi chương"
        onClose={() => submit !== 'sending' && setSubmit('idle')}
      >
        <p className="text-sm leading-6 text-muted">{t('submissionData.editorHint')}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => setSubmit('idle')}

            className="w-full sm:w-auto"
          >
            Tiếp tục chỉnh sửa
          </Button>
          <Button
            disabled={saveBusy}
            className="w-full sm:w-auto"
            onClick={async () => {
              if (!saved && !(await saveChapter())) return
              navigate(`/author/submissions?storyId=${chapter.storyId}&chapterId=${chapter.id}`)
            }}
          >
            <Check size={16} aria-hidden="true" />
            {t('submissionData.editorContinue')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function EditorHeader({
  story,
  title,
  badges,
  onOpenLeft,
  onOpenRight,
  onPreview,
  onSubmit,
  submitDisabled = !onSubmit,
  importTo,
  onLeave,
  richTo,
}) {
  const { t } = useLocale()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-surface px-4 py-3">
      <IconButton
        label="Mở dàn ý chương"
        shape="circle"
        size="sm"
        onClick={onOpenLeft}
        disabled={!onOpenLeft}
        className="xl:hidden"
      >
        <PanelLeft size={18} />
      </IconButton>
      <div className="min-w-0 flex-1">
        <nav aria-label="Đường dẫn" className="-my-1 truncate py-1 text-xs text-ink/70">
          <Link to="/author" className="-my-1 inline-block py-1 hover:text-brand-strong">
            Tác phẩm của tôi
          </Link>
          {story && (
            <>
              <span aria-hidden="true"> / </span>
              {story}
            </>
          )}
        </nav>
        <h1 className="line-clamp-2 text-sm font-semibold text-brand-strong">{title}</h1>
      </div>
      <IconButton
        label="Mở bảng trợ lý sáng tác"
        shape="circle"
        size="sm"
        onClick={onOpenRight}
        disabled={!onOpenRight}
        className="xl:hidden"
      >
        <PanelRight size={18} />
      </IconButton>
      <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
        {badges}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {richTo && (
            <ButtonLink to={richTo} variant="secondary" size="sm" onClick={onLeave}>
              {t('richEditor.open')}
            </ButtonLink>
          )}
          {importTo && (
            <ButtonLink to={importTo} variant="secondary" size="sm" onClick={onLeave}>
              {t('authorDraftActions.import')}
            </ButtonLink>
          )}
          <Button variant="secondary" size="sm" onClick={onPreview} disabled={!onPreview}>
            <Eye size={14} aria-hidden="true" />
            Xem trước
          </Button>
          <Button size="sm" trailingIcon={Send} onClick={onSubmit} disabled={submitDisabled}>
            Gửi chương
          </Button>
        </div>
      </div>
    </div>
  )
}

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  )
}

/* Mirrors the ready editor: outline rail, toolbar + manuscript surface, writer utility panel. */
function EditorSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải chương"
      className="nh-grid-12 grid min-h-0 flex-1 nh-layout-xl-3-6-3"
    >
      <aside
        aria-hidden="true"
        className="hidden overflow-y-auto border-r border-hairline bg-surface p-5 xl:block"
      >
        <ChapterTreeSkeleton />
      </aside>
      <div className="min-w-0">
        <div className="sticky top-[var(--app-header-h)] z-20 flex items-center gap-2 border-b border-hairline bg-surface/90 px-3 py-2 backdrop-blur">
          <div className="nh-tab-rail flex min-w-0 flex-1 gap-0.5 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] lg:pr-0 lg:[mask-image:none]">
            {tools.map(([, label]) => (
              <Skeleton key={label} className="size-9 shrink-0 pointer-coarse:size-11" />
            ))}
          </div>
          <Skeleton className="hidden h-3 w-24 shrink-0 lg:block" />
          <Button variant="secondary" size="sm" disabled className="shrink-0">
            <Save size={14} aria-hidden="true" />
            Lưu
          </Button>
        </div>
        <div className="mx-auto max-w-[760px] px-5 py-10 sm:px-10 lg:py-14">
          <div className="border-b border-transparent pb-3">
            <div className="flex h-[2.1875rem] items-center sm:h-[2.8125rem]">
              <Skeleton className="h-6 w-full rounded-xl sm:h-8" />
            </div>
            <div className="flex h-[2.1875rem] items-center sm:h-[2.8125rem]">
              <Skeleton className="h-6 w-2/3 rounded-xl sm:h-8" />
            </div>
          </div>
          <div className="mt-6 min-h-[60dvh] space-y-8 py-2.5">
            <SkeletonText lines={6} />
            <SkeletonText lines={4} />
            <Skeleton className="mx-auto h-3 w-24" />
            <SkeletonText lines={5} />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
            <Skeleton className="my-0.5 h-4 w-72 max-w-full" />
            <Skeleton className="h-9 w-52" />
          </div>
        </div>
      </div>
      <aside className="hidden overflow-y-auto border-l border-hairline bg-surface xl:block">
        <WriterUtilitySkeleton />
      </aside>
    </div>
  )
}

function ChapterTreeSkeleton() {
  return (
    <>
      <div className="border-b border-hairline pb-4">
        <Skeleton className="my-1 h-4 w-36" />
        <Skeleton className="my-0.5 h-3 w-24" />
      </div>
      <div className="mt-5 space-y-6">
        {[2, 3].map((count, group) => (
          <div key={group}>
            <div className="flex items-start gap-2">
              <Skeleton className="my-0.5 h-3 w-3/5" />
              <Skeleton className="my-0.5 ml-auto h-3 w-14 shrink-0" />
            </div>
            <div className="mt-2 space-y-1 border-l border-hairline pl-3">
              {Array.from({ length: count }, (_, index) => (
                <div key={index} className="flex h-9 items-center px-3 pointer-coarse:h-11">
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-8 h-11 w-full" />
    </>
  )
}

/* Text lines on the line-box pitch of the copy they stand in for: 24px (leading-6) or 20px (leading-5). */
function SkeletonLines({ lines, tight = false, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`block ${tight ? 'space-y-2 py-1' : 'space-y-3 py-1.5'} ${className}`}
    >
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-3 ${index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full'}`}
        />
      ))}
    </span>
  )
}

function WriterUtilitySkeleton() {
  return (
    <div className="space-y-5 p-5">
      {/* The tab rail is chrome: render it inert so its wrapped rows keep their real height. */}
      <div inert>
        <Tabs label="Tiện ích sáng tác" value="outline" onChange={() => {}} items={utilityTabs} />
      </div>
      <Card as="div" aria-hidden="true" className="bg-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-24" />
        </div>
        <SkeletonLines lines={4} className="mt-2" />
      </Card>
      <Card as="div" aria-hidden="true" className="p-4">
        <Skeleton className="my-0.5 h-4 w-48 max-w-full" />
        <SkeletonLines lines={3} className="mt-2" />
        <Skeleton className="mt-4 h-11 w-full" />
      </Card>
      <Card as="div" aria-hidden="true" className="p-4">
        <Skeleton className="my-0.5 h-4 w-40" />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Skeleton className="my-[3px] h-3.5 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mt-2 space-y-2">
          <SkeletonLines lines={2} tight />
          <SkeletonLines lines={2} tight />
        </div>
      </Card>
    </div>
  )
}

function EditorSheet({ open, side, title, onClose, children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    panelRef.current?.focus({ preventScroll: true })
    const onKeyDown = event => {
      if (event.key === 'Escape') closeRef.current?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [open])
  const left = side === 'left'
  return (
    <div className="xl:hidden" inert={!open}>
      {open && (
        <button
          type="button"
          aria-label="Đóng bảng"
          tabIndex={-1}
          onClick={onClose}
          className="nh-fade-enter fixed inset-0 z-50 bg-scrim backdrop-blur-sm"
        />
      )}
      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-label={title}
        aria-hidden={!open}
        className={`fixed inset-y-0 z-50 flex w-[min(88vw,22rem)] flex-col border-hairline bg-surface shadow-float outline-none transition-transform duration-[420ms] ease-spring ${left ? 'left-0 border-r sm:rounded-r-3xl' : 'right-0 border-l sm:rounded-l-3xl'} ${open ? 'translate-x-0' : left ? '-translate-x-full' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton label="Đóng" shape="circle" size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
      </aside>
    </div>
  )
}

function ChapterTree({
  storyTitle,
  storyMeta,
  active: activeChapter,
  groups,
  onAdd,
  storyId,
  addDisabled,
  onLeave,
  rich,
}) {
  return (
    <>
      <div className="border-b border-hairline pb-4">
        <strong className="text-base">{storyTitle}</strong>
        <p className="text-xs text-muted">{storyMeta}</p>
      </div>
      <div className="mt-5 space-y-6">
        {groups.map(group => (
          <section key={group.act} aria-label={group.act}>
            <div className="flex items-start gap-2">
              <ChevronDown size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
              <strong className="flex-1 text-xs tracking-[.08em] text-brand-strong">
                {group.act}
              </strong>
              <span className="shrink-0 text-xs text-muted">{group.count} chương</span>
            </div>
            <ul className="mt-2 space-y-1 border-l border-hairline pl-3">
              {group.chapters.map(([number, label, id]) => {
                const active = number === activeChapter
                return (
                  <li key={number}>
                    <Link
                      to={`/author/stories/${storyId}/chapters/${id}/edit${rich ? '?mode=rich' : ''}`}
                      onClick={onLeave}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors duration-200 pointer-coarse:min-h-11 ${active ? 'bg-brand/12 font-semibold text-brand-strong' : 'text-ink/70 hover:bg-elevated hover:text-ink'}`}
                    >
                      <span className="truncate" title={label}>
                        {label}
                      </span>
                      {active && (
                        <PenLine size={14} aria-hidden="true" className="ml-auto shrink-0" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <Button variant="outline" disabled={addDisabled} onClick={onAdd} className="mt-8 w-full">
        <Plus size={16} aria-hidden="true" />
        Thêm chương
      </Button>
    </>
  )
}

function WriterUtility({ tab, setTab, body, title, words, saved, notes, setNotes }) {
  const { t } = useLocale()
  return (
    <div className="space-y-5 p-5">
      <Tabs label="Tiện ích sáng tác" value={tab} onChange={setTab} items={utilityTabs} />
      {tab === 'outline' && <Outline body={body} />}
      {tab === 'notes' && (
        <div>
          <label htmlFor="chapter-notes" className="text-sm font-semibold">
            Ghi chú cho chương này
          </label>
          <textarea
            id="chapter-notes"
            value={notes}
            disabled
            onChange={event => setNotes(event.target.value)}
            placeholder="Ý tưởng, chi tiết cần nhớ, câu thoại muốn giữ lại..."
            className="mt-2 min-h-48 w-full resize-y rounded-3xl border border-line bg-surface p-4 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm"
          />
          <p className="mt-2 text-xs text-muted">{t('editorData.noNotes')}</p>
        </div>
      )}
      {tab === 'checklist' && <Checklist title={title} body={body} words={words} saved={saved} />}
    </div>
  )
}

function Outline({ body }) {
  const scenes = body
    .split(SCENE_BREAK)
    .map(part => part.trim())
    .filter(Boolean)
  return (
    <ol className="space-y-3">
      {scenes.map((scene, index) => (
        <li key={index} className="rounded-2xl border border-hairline bg-elevated p-4">
          <div className="flex items-center justify-between gap-2 text-xs text-ink/70">
            <strong className="text-brand-strong">Cảnh {index + 1}</strong>
            <span className="tabular-nums">{countWords(scene).toLocaleString('vi-VN')} từ</span>
          </div>
          <p className="mt-1.5 line-clamp-3 text-sm leading-6">{scene}</p>
        </li>
      ))}
    </ol>
  )
}

function Checklist({ title, body, words, saved }) {
  const checks = [
    ['Có tiêu đề chương', Boolean(title.trim())],
    ['Có ít nhất một dấu ngắt cảnh', body.includes(SCENE_BREAK)],
    [`Mốc tham khảo ${TARGET_WORDS.toLocaleString('vi-VN')} từ`, words >= TARGET_WORDS],
    ['Mọi thay đổi đã được lưu', saved],
  ]
  return (
    <div>
      <p className="flex justify-between text-sm">
        <span>Mốc tham khảo số từ</span>
        <strong className="tabular-nums">
          {words.toLocaleString('vi-VN')} / {TARGET_WORDS.toLocaleString('vi-VN')}
        </strong>
      </p>
      <ProgressBar
        value={Math.min(words, TARGET_WORDS)}
        max={TARGET_WORDS}
        size="sm"
        label="Tiến độ số từ của chương"
        className="mt-2"
      />
      <ul className="mt-5 space-y-3">
        {checks.map(([label, done]) => (
          <li key={label} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${done ? 'border-brand bg-brand text-on-brand' : 'border-line'}`}
            >
              {done && <Check size={12} aria-hidden="true" />}
            </span>
            <span className={done ? '' : 'text-muted'}>
              {label}
              <span className="sr-only">{done ? ' (đã đạt)' : ' (chưa đạt)'}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-5 flex items-start gap-2 rounded-2xl bg-elevated p-3 text-xs leading-5 text-ink/70">
        <BookOpen size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
        Hoàn thành danh sách trước khi gửi chương để rút ngắn thời gian xét duyệt.
      </p>
    </div>
  )
}
