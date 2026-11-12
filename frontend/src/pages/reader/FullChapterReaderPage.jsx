import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import {
  AlignJustify,
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Flag,
  Focus,
  Headphones,
  Highlighter,
  Info,
  List,
  LockKeyhole,
  MessageSquareText,
  NotebookPen,
  Search,
  Settings2,
  Share2,
  Trash2,
  X,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import {
  Button,
  ButtonLink,
  Card,
  Drawer,
  EmptyState,
  IconButton,
  Input,
  Modal,
  ProgressBar,
  Skeleton,
} from '../../components/ui'
import { ReaderRange, ReaderSettings } from '../../components/reader/ReaderSettings'
import { ChapterSegment } from '../../components/reader/ChapterSegment'
import { chapterLabel } from '../../components/reader/chapterLabel'
import { ChapterInlineText } from '../../components/reader/ChapterInlineText'
import { ReadListenSwitch } from '../../components/reader/ReadListenSwitch'
import { useChapterSwipe } from '../../components/reader/useChapterSwipe'
import {
  DEFAULT_CHAPTER_MODE,
  DEFAULT_READER_FONT,
  READER_CHAPTER_MODES,
  READER_FONTS,
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  READER_WIDTH,
} from '../../components/reader/readerOptions'
import { CommentThread } from '../../components/community/CommentThread'
import { FollowButton } from '../../components/community/FollowButton'
import { ReportDialog } from '../../components/community/ReportDialog'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const SETTINGS_KEY = 'novelhub.reader.settings.v2'
const BOOKMARK_KEY = 'novelhub.reader.bookmarks.v1'
const ANNOTATIONS_KEY = 'novelhub.reader.annotations.v1'
const SWIPE_HINT_KEY = 'novelhub.reader.swipe-hint.v1'
const CHAPTER_MODES = READER_CHAPTER_MODES.map(mode => mode.value)
const HEX_ID = /^[a-f\d]{24}$/i
const NO_CHAPTERS = Object.freeze([])
/* Reading progress is saved at most every few seconds while it changes, and on leave. */
const SAVE_INTERVAL = 5000
const COMPLETE_AT = 0.98
/* Continuous scroll: the chapter crossing this viewport line is "current"; ±1 stay rendered. */
const READING_LINE = 0.35
const KEEP_AROUND = 1
/* Reader highlight swatches are intrinsic content colours (AGENTS §7); text on them stays dark. */
const highlightColors = {
  yellow: ['#f4df8d', 'vàng'],
  green: ['#9fd8b9', 'xanh lá'],
  blue: ['#9ec9e8', 'xanh dương'],
  pink: ['#e9afc0', 'hồng'],
}
const HIGHLIGHT_INK = '#172033'
const SELECTION_TOOLBAR_WIDTH = 400
/* The note text already carries the prose's own quotation marks; the UI adds one pair. */
const unquote = text => text.replace(/^[\s“”"‘’']+|[\s“”"‘’']+$/g, '')
const readStored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const hasTextSelection = () => Boolean(window.getSelection()?.toString().trim())
const segmentNode = id => document.querySelector(`[data-chapter-segment="${id}"]`)
/*
 * Which chapters the canvas shows, by chapter id. `url` is the chapter in the address bar,
 * `current` the one being read; in continuous scroll `ids` is the rendered stream started at
 * `anchor`, and `heights` keeps the size of unloaded far chapters. `jump` counts explicit
 * chapter changes.
 */
const freshView = (id, direction = null, jump = 0) => ({
  url: id,
  current: id,
  anchor: id,
  ids: [id],
  heights: {},
  direction,
  jump,
})

const TOOL_CLASS =
  'grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11'

function ToolButton({ active, label, children, onClick, disabled, className = '' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={`${TOOL_CLASS} ${active ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-ink/6 hover:text-ink'} ${className}`}
    >
      {children}
    </button>
  )
}

/* Same chapter in the audio player: a link (navigation), styled like the toolbar buttons. */
function ListenToolLink({ to, t, className = '' }) {
  const label = t('reader.listenChapter')
  return (
    <Link
      to={to}
      title={label}
      aria-label={label}
      className={`${TOOL_CLASS} text-ink/70 hover:bg-ink/6 hover:text-ink ${className}`}
    >
      <Headphones size={16} aria-hidden="true" />
    </Link>
  )
}

const Divider = ({ className = '' }) => (
  <span aria-hidden="true" className={`h-6 w-px shrink-0 bg-hairline ${className}`} />
)

function ReaderToolbar({
  settings,
  update,
  progress,
  bookmarked,
  toggleBookmark,
  openNotes,
  openChapters,
  openSettings,
  focus,
  toggleFocus,
  settingsOpen,
  openComments,
  openReport,
  commentCount,
  interactive,
  listenTo,
  t,
}) {
  const fontIndex = READER_FONT_SIZES.indexOf(settings.fontSize)
  if (settings.toolbarLayout === 'vertical')
    return (
      <div
        data-reader-toolbar
        className="sticky top-[var(--app-header-h)] z-30 border-b border-hairline bg-reader/85 px-4 py-3"
      >
        <div className="mx-auto flex max-w-[1100px] items-center gap-3">
          <ProgressBar value={progress} size="sm" label={t('reader.progressLabel')} />
          <span className="text-xs font-semibold text-brand-strong">{progress}%</span>
        </div>
        <div
          role="toolbar"
          aria-label={t('reader.toolbarLabel')}
          aria-orientation="vertical"
          className={
            'fixed top-[calc(var(--app-header-h)+1rem)] right-3 flex max-h-[calc(100dvh-var(--app-header-h)-2rem)] flex-col items-center gap-1 overflow-y-auto rounded-full border border-line bg-surface p-1.5 shadow-soft ' +
            (settingsOpen ? 'lg:right-[25rem]' : '')
          }
        >
          <ToolButton
            label={t('reader.fontSize') + ' −'}
            disabled={fontIndex <= 0}
            onClick={() => update('fontSize', READER_FONT_SIZES[Math.max(0, fontIndex - 1)])}
          >
            A−
          </ToolButton>
          <span className="text-xs font-semibold">{settings.fontSize}</span>
          <ToolButton
            label={t('reader.fontSize') + ' +'}
            disabled={fontIndex >= READER_FONT_SIZES.length - 1}
            onClick={() =>
              update(
                'fontSize',
                READER_FONT_SIZES[Math.min(READER_FONT_SIZES.length - 1, fontIndex + 1)],
              )
            }
          >
            A+
          </ToolButton>
          <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />
          <ToolButton
            label={t('reader.left')}
            active={settings.align === 'left'}
            onClick={() => update('align', 'left')}
          >
            <AlignLeft size={16} />
          </ToolButton>
          <ToolButton
            label={t('reader.justify')}
            active={settings.align === 'justify'}
            onClick={() => update('align', 'justify')}
          >
            <AlignJustify size={16} />
          </ToolButton>
          <ToolButton active={bookmarked} label={t('reader.bookmark')} onClick={toggleBookmark}>
            <Bookmark size={16} />
          </ToolButton>
          <ToolButton label={t('reader.notes')} onClick={openNotes}>
            <NotebookPen size={16} />
          </ToolButton>
          <ToolButton label={t('reader.chapters')} onClick={openChapters}>
            <List size={17} />
          </ToolButton>
          <ListenToolLink to={listenTo} t={t} />
          <ToolButton
            label={t('reader.commentsCount', { count: commentCount })}
            onClick={openComments}
          >
            <MessageSquareText size={16} />
          </ToolButton>
          <ToolButton
            label={t('reader.reportChapter')}
            disabled={!interactive}
            onClick={openReport}
          >
            <Flag size={16} />
          </ToolButton>
          <ToolButton label={t('reader.settings')} onClick={openSettings}>
            <Settings2 size={16} />
          </ToolButton>
          <ToolButton
            active={focus}
            label={focus ? t('reader.exitFocus') : t('reader.focus')}
            onClick={toggleFocus}
          >
            <Focus size={16} />
          </ToolButton>
        </div>
      </div>
    )
  return (
    <div
      data-reader-toolbar
      className="sticky top-[var(--app-header-h)] z-30 border-b border-hairline bg-reader/85 px-4 pb-2 pt-2.5 backdrop-blur-md sm:px-6 [@media(max-height:500px)]:static"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-3 px-1">
          <ProgressBar value={progress} size="sm" label={t('reader.progressLabel')} />
          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-brand-strong">
            {progress}%
          </span>
        </div>
        <div
          role="toolbar"
          aria-label={t('reader.toolbarLabel')}
          className="mt-2 flex min-h-12 items-center gap-1 rounded-full border border-hairline bg-surface px-1.5 shadow-whisper sm:px-2"
        >
          {/* Below sm the font size lives in the settings sheet so the actions keep 44px targets. */}
          <div className="hidden items-center sm:flex">
            <ToolButton
              label={`${t('reader.fontSize')} −`}
              disabled={fontIndex <= 0}
              onClick={() => update('fontSize', READER_FONT_SIZES[Math.max(0, fontIndex - 1)])}
            >
              A−
            </ToolButton>
            <span
              aria-live="polite"
              className="w-6 text-center text-xs font-semibold tabular-nums text-ink"
            >
              {settings.fontSize}
            </span>
            <ToolButton
              label={`${t('reader.fontSize')} +`}
              disabled={fontIndex >= READER_FONT_SIZES.length - 1}
              onClick={() =>
                update(
                  'fontSize',
                  READER_FONT_SIZES[Math.min(READER_FONT_SIZES.length - 1, fontIndex + 1)],
                )
              }
            >
              A+
            </ToolButton>
          </div>
          <Divider className="mx-1 hidden md:block" />
          <div
            title={t('reader.contentWidth')}
            className={
              settingsOpen ? 'hidden' : 'hidden items-center gap-2 text-xs text-ink/70 md:flex'
            }
          >
            <span aria-hidden="true">↔</span>
            <ReaderRange
              label={t('reader.contentWidth')}
              min={READER_WIDTH.min}
              max={READER_WIDTH.max}
              step={READER_WIDTH.step}
              value={settings.width}
              valueText={`${settings.width}px`}
              onChange={value => update('width', value)}
              className="w-28"
            />
            <span className="w-8 tabular-nums">{settings.width}</span>
          </div>
          <Divider className="mx-1 hidden lg:block" />
          <div className={settingsOpen ? 'hidden' : 'hidden items-center gap-0.5 lg:flex'}>
            <ToolButton
              active={settings.align === 'left'}
              label={t('reader.left')}
              onClick={() => update('align', 'left')}
            >
              <AlignLeft size={15} />
            </ToolButton>
            <ToolButton
              active={settings.align === 'justify'}
              label={t('reader.justify')}
              onClick={() => update('align', 'justify')}
            >
              <AlignJustify size={15} />
            </ToolButton>
            <Divider className="mx-1" />
            {READER_LINE_HEIGHTS.map(value => (
              <ToolButton
                key={value}
                active={settings.lineHeight === value}
                label={`${t('reader.lineHeight')} ${value}`}
                onClick={() => update('lineHeight', value)}
              >
                <span className="text-xs tabular-nums">{value}</span>
              </ToolButton>
            ))}
          </div>
          <div className="flex flex-1 items-center justify-between gap-1 sm:ml-auto sm:flex-none sm:justify-end">
            <ToolButton active={bookmarked} label={t('reader.bookmark')} onClick={toggleBookmark}>
              <Bookmark size={16} className={bookmarked ? 'fill-current' : ''} />
            </ToolButton>
            <ToolButton label={t('reader.notes')} onClick={openNotes}>
              <NotebookPen size={16} />
            </ToolButton>
            <ToolButton label={t('reader.chapters')} onClick={openChapters}>
              <List size={17} />
            </ToolButton>
            {/* Phones switch to listening from the "Đọc | Nghe" control in the chapter header. */}
            <ListenToolLink to={listenTo} t={t} className="max-sm:hidden" />
            <ToolButton
              label={t('reader.commentsCount', { count: commentCount })}
              onClick={openComments}
            >
              <MessageSquareText size={16} />
            </ToolButton>
            <ToolButton
              label={t('reader.reportChapter')}
              disabled={!interactive}
              onClick={openReport}
            >
              <Flag size={16} />
            </ToolButton>
            <ToolButton label={t('reader.settings')} onClick={openSettings}>
              <Settings2 size={16} />
            </ToolButton>
            <ToolButton
              active={focus}
              label={focus ? t('reader.exitFocus') : t('reader.focus')}
              onClick={toggleFocus}
            >
              <Focus size={16} />
            </ToolButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function StoryEndCard({ story, viewer, total, onFollowChange, t }) {
  return (
    <Card className="mx-4 mt-12 text-center sm:mx-6">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
        <BookOpenCheck size={24} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-h3">{t('reader.endTitle')}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        {story
          ? t('reader.endDescription', { story: story.title, total, author: story.author })
          : t('reader.endFallback')}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {story && viewer && (
          <FollowButton
            storyId={story.id}
            following={viewer.following}
            followers={story.followers}
            onChange={onFollowChange}
          />
        )}
        <ButtonLink variant="secondary" to={ROUTES.library}>
          {t('reader.back')}
        </ButtonLink>
      </div>
    </Card>
  )
}

/* The next chapter is in early access and not unlocked by this Reader: open it to unlock. */
function LockedChapterCard({ link, storyId, t }) {
  return (
    <Card className="mx-4 mt-10 sm:mx-6">
      <EmptyState
        icon={LockKeyhole}
        headingAs="h3"
        title={t('reader.lockedTitle', { chapter: chapterLabel(t, link) })}
        description={t('reader.lockedDescription')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink size="sm" to={ROUTES.read(storyId, link.id)}>
              {t('reader.openToUnlock')}
            </ButtonLink>
            <ButtonLink variant="secondary" size="sm" to={ROUTES.story(storyId)}>
              {t('reader.backToStory')}
            </ButtonLink>
          </div>
        }
        className="py-8"
      />
    </Card>
  )
}

/* A locked neighbour still opens: its page shows the unlock prompt instead of the text. */
function NeighbourLink({ link, direction, storyId, onNavigate, t }) {
  if (!link) return <span aria-hidden="true" />
  const next = direction === 'next'
  return (
    <ButtonLink
      variant={next && !link.locked ? 'primary' : 'secondary'}
      size="lg"
      className="min-h-[3.125rem] py-1.5"
      to={ROUTES.read(storyId, link.id)}
      trailingIcon={next && !link.locked ? ArrowRight : undefined}
      onClick={onNavigate}
    >
      {!next && <ArrowLeft size={16} aria-hidden="true" />}
      {link.locked && <LockKeyhole size={15} aria-hidden="true" />}
      {t(
        link.locked
          ? next
            ? 'reader.nextLocked'
            : 'reader.previousLocked'
          : next
            ? 'reader.next'
            : 'reader.previous',
      )}
    </ButtonLink>
  )
}

export function FullChapterReaderPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { storyId, chapterId } = useParams()
  const [searchParams] = useSearchParams()
  const pageRef = useRef(null)
  const swipeRef = useRef(null)
  const streamRef = useRef(null)
  const sentinelRef = useRef(null)
  const chapterListRef = useRef(null)
  const noteFieldRef = useRef(null)
  const [settings, setSettings] = useState(() => {
    const stored = { ...readStored(SETTINGS_KEY, {}) }
    delete stored.progress
    const allowedFonts = READER_FONTS.map(([, value]) => value)
    return {
      fontSize: 18,
      width: 820,
      lineHeight: 1.8,
      paragraphGap: 22,
      align: 'left',
      ...stored,
      fontFamily: allowedFonts.includes(stored.fontFamily)
        ? stored.fontFamily
        : DEFAULT_READER_FONT,
      toolbarLayout: stored.toolbarLayout === 'vertical' ? 'vertical' : 'horizontal',
      chapterMode: CHAPTER_MODES.includes(stored.chapterMode)
        ? stored.chapterMode
        : DEFAULT_CHAPTER_MODE,
    }
  })
  const mode = settings.chapterMode
  const continuous = mode === 'continuous'
  /* Story context: title, Author, chapter list (with lock state) and the viewer's follow. */
  const detail = useBackendDocument(`/catalog/stories/${encodeURIComponent(storyId)}`, null)
  const story = detail.data?.story ?? null
  const storyChapters = detail.data?.chapters ?? NO_CHAPTERS
  const [followState, setFollowState] = useState(null)
  /* Per-chapter load state reported by the segments: { status, chapter }. */
  const [segments, setSegments] = useState({})
  /* Every chapter we know a label for: the story list, loaded chapters and their neighbours. */
  const known = useMemo(() => {
    const map = new Map(storyChapters.map(item => [item.id, item]))
    Object.entries(segments).forEach(([key, segment]) => {
      const chapter = segment.chapter
      if (!chapter) return
      for (const link of [chapter.prev, chapter.next])
        if (link && !map.has(link.id)) map.set(link.id, link)
      const info = { id: chapter.id, orderKey: chapter.orderKey, title: chapter.title }
      map.set(key, info)
      map.set(chapter.id, info)
    })
    return map
  }, [storyChapters, segments])
  const [view, setView] = useState(() => freshView(chapterId))
  /*
   * Address-bar changes: in continuous scroll the URL follows the chapter in view (our own
   * replace); anything else (chapter list, prev/next, swipe, keys) is a jump to a new chapter.
   */
  if (chapterId !== view.url) {
    const from = known.get(view.current)?.orderKey
    const to = known.get(chapterId)?.orderKey
    setView(
      continuous && chapterId === view.current
        ? { ...view, url: chapterId }
        : freshView(chapterId, from && to && to < from ? 'prev' : 'next', view.jump + 1),
    )
  }
  /* Prev/next come from the chapter payload; before it loads (or if locked) from the list. */
  const neighboursOf = id => {
    const chapter = segments[id]?.chapter
    if (chapter && 'next' in chapter)
      return { prev: chapter.prev ?? null, next: chapter.next ?? null }
    const index = storyChapters.findIndex(item => item.id === (known.get(id)?.id ?? id))
    if (index < 0) return { prev: null, next: null }
    return { prev: storyChapters[index - 1] ?? null, next: storyChapters[index + 1] ?? null }
  }
  const current = view.current
  const currentSegment = segments[current]
  const currentChapter = currentSegment?.status === 'ready' ? currentSegment.chapter : null
  const currentInfo = currentChapter ?? known.get(current)
  const headerId = continuous ? view.ids[0] : current
  const headerInfo = segments[headerId]?.chapter ?? known.get(headerId)
  const total = storyChapters.length || null
  const storyTitle = story?.title ?? currentChapter?.story?.title ?? ''
  const storyAuthor = story?.author ?? currentChapter?.story?.author ?? ''
  const canonicalStoryId =
    story?.id ?? currentChapter?.story?.id ?? (HEX_ID.test(storyId) ? storyId : null)
  const viewer = detail.data?.viewer ? { ...detail.data.viewer, ...followState } : null
  const endStory = story && followState ? { ...story, followers: followState.followers } : story
  const chapterKey = `${storyId}-${currentChapter?.id ?? current}`
  const { prev: prevLink, next: nextLink } = neighboursOf(current)
  const canPrev = Boolean(prevLink)
  const canNext = Boolean(nextLink)

  const [progress, setProgress] = useState(0)
  const [bookmarks, setBookmarks] = useState(() => readStored(BOOKMARK_KEY, []))
  const [annotations, setAnnotations] = useState(() => readStored(ANNOTATIONS_KEY, []))
  const [selection, setSelection] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [chaptersOpen, setChaptersOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)
  const [focus, setFocus] = useState(false)
  const [toast, setToast] = useState('')
  const [chapterQuery, setChapterQuery] = useState('')
  const [hintSeen, setHintSeen] = useState(() => localStorage.getItem(SWIPE_HINT_KEY) === '1')
  const [coarsePointer] = useState(() => window.matchMedia('(pointer: coarse)').matches)
  const [touchCapable] = useState(() => coarsePointer || navigator.maxTouchPoints > 0)
  /* "Content updated" notice for the chapter the reader arrived on. */
  const [initialId] = useState(chapterId)
  const [updatedFlag] = useState(() => searchParams.get('updated') === '1')
  const [updatedDismissed, setUpdatedDismissed] = useState(false)
  const [resume, setResume] = useState({ storyId: null, data: null })
  const resumeUpdated = Boolean(
    resume.data?.contentUpdated && resume.data.chapterId === segments[initialId]?.chapter?.id,
  )
  const showUpdated = !updatedDismissed && current === initialId && (updatedFlag || resumeUpdated)
  const bookmarked = bookmarks.includes(chapterKey)
  const drawerOpen = settingsOpen || notesOpen || chaptersOpen || commentsOpen
  const panelOpen = drawerOpen || noteOpen || Boolean(reportTarget)
  const showHint = mode === 'swipe' && !hintSeen

  /* Latest render values for listeners that live across renders. */
  const latest = useRef({ mode, current, noteOpen, chapter: currentChapter, storyId })
  const restoreRef = useRef({ pending: true, id: chapterId })
  const measureRef = useRef(() => {})
  const captureRef = useRef(() => {})
  const saverRef = useRef({ pending: null, sent: null, timer: 0 })
  useEffect(() => {
    latest.current = { mode, current, noteOpen, chapter: currentChapter, storyId }
  })

  /* Saved resume point of this story: restores the scroll position and flags updated content. */
  useEffect(() => {
    if (!canonicalStoryId) return undefined
    const controller = new AbortController()
    apiRequest(`/reader/progress/${encodeURIComponent(canonicalStoryId)}`, {
      signal: controller.signal,
    })
      .then(response => {
        if (!controller.signal.aborted)
          setResume({ storyId: canonicalStoryId, data: response?.resume ?? null })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResume({ storyId: canonicalStoryId, data: null })
      })
    return () => controller.abort()
  }, [canonicalStoryId])

  /* PUT /reader/progress: the first sample of a chapter immediately, then at most every 5s. */
  const flushProgress = useCallback(() => {
    const saver = saverRef.current
    clearTimeout(saver.timer)
    saver.timer = 0
    const entry = saver.pending
    saver.pending = null
    const sent = saver.sent
    if (
      !entry ||
      (sent?.chapterId === entry.chapterId &&
        sent.position === entry.position &&
        sent.completed === entry.completed)
    )
      return
    saver.sent = entry
    apiRequest('/reader/progress', {
      method: 'PUT',
      body: {
        storyId: entry.storyId,
        chapterId: entry.chapterId,
        position: entry.position,
        ...(entry.completed ? { completed: true } : {}),
      },
    }).catch(() => setToast(t('reader.progressError')))
  }, [t])
  const queueProgress = useCallback(
    entry => {
      const saver = saverRef.current
      if (saver.pending && saver.pending.chapterId !== entry.chapterId) flushProgress()
      const sent = saver.sent
      saver.pending = entry
      if (!sent || sent.chapterId !== entry.chapterId || (entry.completed && !sent.completed)) {
        flushProgress()
        return
      }
      if (!saver.timer) saver.timer = setTimeout(flushProgress, SAVE_INTERVAL)
    },
    [flushProgress],
  )
  useEffect(() => {
    const onPageHide = () => flushProgress()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushProgress()
    }
    addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      removeEventListener('pagehide', onPageHide)
      document.removeEventListener('visibilitychange', onVisibility)
      flushProgress()
    }
  }, [flushProgress])

  const update = (key, value) => {
    setSettings(previous => {
      const next = { ...previous, [key]: value }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
    if (key === 'chapterMode') {
      setSelection(null)
      setView(previous => ({
        ...freshView(previous.current, null, previous.jump),
        url: previous.url,
      }))
    }
  }
  const dismissHint = useCallback(() => {
    localStorage.setItem(SWIPE_HINT_KEY, '1')
    setHintSeen(true)
  }, [])
  const goToChapter = link => {
    if (!link || link.id === current) return
    setSelection(null)
    if (mode === 'swipe') dismissHint()
    navigate(ROUTES.read(storyId, link.id))
  }

  /* Segments report their load state: gates the continuous stream, header and progress. */
  const handleStatus = useCallback((id, status, chapter) => {
    setSegments(previous =>
      previous[id]?.status === status && previous[id]?.chapter === chapter
        ? previous
        : { ...previous, [id]: { status, chapter } },
    )
  }, [])

  /* Once the arrival chapter and the saved resume point are known, scroll to where they left. */
  useEffect(() => {
    const restore = restoreRef.current
    if (!restore.pending) return
    const segment = segments[restore.id]
    if (!segment || segment.status === 'loading') return
    if (segment.status === 'ready' && canonicalStoryId && resume.storyId !== canonicalStoryId)
      return
    restore.pending = false
    if (segment.status !== 'ready') return
    const saved = resume.data
    requestAnimationFrame(() => {
      const node = segmentNode(restore.id)
      if (
        node &&
        saved &&
        !saved.contentUpdated &&
        saved.chapterId === segment.chapter.id &&
        saved.position > 0
      ) {
        let top
        if (latest.current.mode === 'continuous') {
          const rect = node.getBoundingClientRect()
          top = scrollY + rect.top - (innerHeight * READING_LINE - saved.position * rect.height)
        } else {
          top = saved.position * (document.documentElement.scrollHeight - innerHeight)
        }
        scrollTo({ top: Math.max(0, top), behavior: 'instant' })
      }
      measureRef.current()
    })
  }, [segments, resume, canonicalStoryId])

  /* Reading progress of the current chapter, sampled once per frame and queued for saving. */
  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const { mode: activeMode, current: id, chapter, storyId: routeStory } = latest.current
      const segment = segmentNode(id)
      let ratio
      if (activeMode === 'continuous' && segment) {
        const rect = segment.getBoundingClientRect()
        ratio = rect.height > 0 ? (innerHeight * READING_LINE - rect.top) / rect.height : 0
      } else {
        const height = document.documentElement.scrollHeight - innerHeight
        ratio = height > 0 ? scrollY / height : 1
      }
      ratio = Math.min(1, Math.max(0, ratio))
      setProgress(Math.round(ratio * 100))
      if (restoreRef.current.pending || !chapter) return
      queueProgress({
        storyId: chapter.story?.id ?? routeStory,
        chapterId: chapter.id,
        position: Math.round(ratio * 1000) / 1000,
        completed: ratio >= COMPLETE_AT,
      })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measureRef.current = schedule
    schedule()
    addEventListener('scroll', schedule, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      removeEventListener('scroll', schedule)
    }
  }, [queueProgress])
  useEffect(() => {
    measureRef.current()
  }, [current, mode, segments])

  /* Explicit chapter changes start at the top of the new chapter. */
  useEffect(() => {
    if (!view.jump) return
    restoreRef.current.pending = false
    scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
  }, [view.jump])
  /* Continuous scroll keeps the address bar on the chapter in view, without a remount or scroll. */
  const urlId = view.url
  useEffect(() => {
    if (current === urlId) return
    navigate(ROUTES.read(storyId, current), { replace: true, preventScrollReset: true })
  }, [current, urlId, navigate, storyId])

  /* Continuous scroll: the chapter crossing the reading line is current; far ones unload. */
  const streamIds = view.ids
  useEffect(() => {
    const root = streamRef.current
    if (!continuous || !root) return undefined
    const observer = new IntersectionObserver(
      entries => {
        const hit = entries.find(entry => entry.isIntersecting)
        if (!hit) return
        const id = hit.target.dataset.chapterSegment
        const at = streamIds.indexOf(id)
        const heights = {}
        root.querySelectorAll('[data-chapter-segment]').forEach(node => {
          const other = node.dataset.chapterSegment
          if (
            Math.abs(streamIds.indexOf(other) - at) > KEEP_AROUND &&
            node.dataset.placeholder !== 'true'
          ) {
            heights[other] = node.offsetHeight
          }
        })
        setView(previous =>
          previous.current === id && !Object.keys(heights).length
            ? previous
            : { ...previous, current: id, heights: { ...previous.heights, ...heights } },
        )
      },
      { rootMargin: `-${READING_LINE * 100}% 0px -${100 - READING_LINE * 100 - 1}% 0px` },
    )
    root.querySelectorAll('[data-chapter-segment]').forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [continuous, streamIds])
  /* …and the next readable chapter is fetched before the reader reaches the end of the last. */
  const firstId = view.ids[0]
  const lastId = view.ids.at(-1)
  const lastReady = segments[lastId]?.status === 'ready'
  const tail = neighboursOf(lastId).next
  const head = neighboursOf(firstId).prev
  const appendId = lastReady && tail && !tail.locked ? tail.id : null
  useEffect(() => {
    const node = sentinelRef.current
    if (!continuous || !node || !appendId) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setView(previous =>
          previous.ids.at(-1) === lastId && !previous.ids.includes(appendId)
            ? { ...previous, ids: [...previous.ids, appendId] }
            : previous,
        )
      },
      { rootMargin: '0px 0px 120% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [continuous, appendId, lastId])
  const loadPrevious = () => {
    if (!head || head.locked) return
    setSelection(null)
    setView(previous =>
      previous.ids[0] === firstId && !previous.ids.includes(head.id)
        ? {
            ...previous,
            ids: [head.id, ...previous.ids],
            current: head.id,
            jump: previous.jump + 1,
          }
        : previous,
    )
  }

  useChapterSwipe(swipeRef, {
    enabled: mode === 'swipe',
    canPrev,
    canNext,
    onCommit: direction => goToChapter(direction === 'next' ? nextLink : prevLink),
    resetKey: current,
  })
  useEffect(() => {
    if (!showHint) return undefined
    const timer = setTimeout(dismissHint, 5200)
    return () => clearTimeout(timer)
  }, [showHint, dismissHint])

  useEffect(() => {
    document.documentElement.dataset.readerFocus = String(focus)
    return () => {
      delete document.documentElement.dataset.readerFocus
    }
  }, [focus])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2200)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (panelOpen) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') {
        if (selection) setSelection(null)
        else if (focus) setFocus(false)
        return
      }
      if (mode === 'continuous' || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (
        event.target.closest?.(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [role="listbox"]',
        ) ||
        hasTextSelection()
      ) {
        return
      }
      const target = event.key === 'ArrowRight' ? nextLink : prevLink
      if (!target) return
      event.preventDefault()
      setSelection(null)
      if (mode === 'swipe') dismissHint()
      navigate(ROUTES.read(storyId, target.id))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [panelOpen, selection, focus, mode, prevLink, nextLink, navigate, storyId, dismissHint])
  useEffect(() => {
    const list = chapterListRef.current
    const active = list?.querySelector('[aria-current="page"]')
    if (!chaptersOpen || !active) return
    /* Scroll only the list so the drawer title, close button and search stay in view. */
    list.scrollTop =
      active.offsetTop - list.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2
  }, [chaptersOpen])
  /* The Modal focuses its panel first (child effects run first); then the note field. */
  useEffect(() => {
    if (noteOpen) noteFieldRef.current?.focus()
  }, [noteOpen])

  const persistAnnotations = next => {
    setAnnotations(next)
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(next))
  }
  const annotationsFor = key => annotations.filter(item => item.chapter === key)
  const chapterAnnotations = annotationsFor(chapterKey)
  const toggleBookmark = () => {
    const next = bookmarked ? bookmarks.filter(id => id !== chapterKey) : [...bookmarks, chapterKey]
    setBookmarks(next)
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next))
    setToast(t(bookmarked ? 'reader.unbookmarked' : 'reader.bookmarked'))
  }
  const captureSelection = () => {
    const selected = window.getSelection()
    const text = selected?.toString().trim()
    const anchor = selected?.anchorNode
    const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement
    const article = element?.closest('[data-chapter-article]')
    if (!text || !selected.rangeCount || !article || !pageRef.current) {
      /* A collapsed selection while the note dialog is open must not drop the note's target. */
      if (!latest.current.noteOpen) setSelection(null)
      return
    }
    const paragraph = element.closest('[data-paragraph]')
    const rect = selected.getRangeAt(0).getBoundingClientRect()
    const page = pageRef.current.getBoundingClientRect()
    const toolbarWidth = Math.min(SELECTION_TOOLBAR_WIDTH, innerWidth - 24)
    const left = Math.min(
      innerWidth - toolbarWidth - 12,
      Math.max(12, rect.left + rect.width / 2 - toolbarWidth / 2),
    )
    /*
     * Above the selection unless that collides with the sticky chrome; then below it, never under
     * the chrome. Touch devices always go below: the native selection menu sits above the text.
     */
    const toolbar = document.querySelector('[data-reader-toolbar]')?.getBoundingClientRect()
    const chromeBottom = Math.max(0, toolbar?.bottom ?? 0) + 8
    const placeBelow = coarsePointer || rect.top - 58 < chromeBottom
    setSelection({
      text,
      chapter: article.dataset.chapterKey,
      chapterId: article.dataset.chapterId,
      index: Number(paragraph?.dataset.paragraph || 0),
      x: left - page.left,
      y: (placeBelow ? Math.max(chromeBottom, rect.bottom + 12) : rect.top - 58) - page.top,
    })
  }
  /* Phones select by long-press and handles (no mouseup): follow selectionchange, debounced. */
  useEffect(() => {
    captureRef.current = captureSelection
  })
  useEffect(() => {
    let timer = 0
    const onSelectionChange = () => {
      clearTimeout(timer)
      timer = setTimeout(() => captureRef.current(), 250)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }, [])
  const closeNote = () => {
    setNoteOpen(false)
    setEditingId(null)
    setNoteDraft('')
  }
  const addHighlight = (color = 'yellow', note = '') => {
    if (editingId) {
      persistAnnotations(
        annotations.map(item => (item.id === editingId ? { ...item, note } : item)),
      )
    } else if (selection) {
      const { text, index } = selection
      persistAnnotations([
        ...annotations,
        { id: Date.now(), chapter: selection.chapter || chapterKey, text, index, color, note },
      ])
    } else return
    setSelection(null)
    closeNote()
    window.getSelection()?.removeAllRanges()
    setToast(t(note ? 'reader.addNote' : 'reader.highlight'))
  }
  const copySelection = async () => {
    if (selection) await navigator.clipboard?.writeText(selection.text)
    setToast(t('reader.copy'))
    setSelection(null)
  }
  const shareSelection = async () => {
    try {
      if (selection && navigator.share)
        await navigator.share({ title: storyTitle, text: selection.text })
      else if (selection) await navigator.clipboard?.writeText(selection.text)
      setToast(t('reader.share'))
    } catch {
      /* The share sheet was dismissed; nothing to report. */
    }
    setSelection(null)
  }
  const removeAnnotation = id => persistAnnotations(annotations.filter(item => item.id !== id))
  /* Paragraph text with the reader's highlights; rich inline formatting is kept around marks. */
  const renderParagraph = ({ text, inlines }, index, key) => {
    const piece = (start, end, pieceKey) =>
      inlines ? (
        <ChapterInlineText key={pieceKey} inlines={inlines} start={start} end={end} />
      ) : (
        text.slice(start, end)
      )
    const marks = annotationsFor(key)
      .filter(item => item.index === index && text.includes(item.text))
      .map(item => ({ ...item, start: text.indexOf(item.text) }))
      .sort((a, b) => a.start - b.start)
    if (!marks.length) return piece(0, text.length)
    const nodes = []
    let cursor = 0
    marks.forEach(mark => {
      if (mark.start < cursor) return
      nodes.push(piece(cursor, mark.start, `before-${mark.id}`))
      nodes.push(
        <mark
          key={mark.id}
          id={`annotation-${mark.id}`}
          title={mark.note || t('reader.highlight')}
          className="rounded-sm px-0.5"
          style={{
            backgroundColor: (highlightColors[mark.color] || highlightColors.yellow)[0],
            color: HIGHLIGHT_INK,
          }}
        >
          {piece(mark.start, mark.start + mark.text.length, `text-${mark.id}`)}
          {mark.note && (
            <MessageSquareText size={12} aria-hidden="true" className="ml-1 inline align-super" />
          )}
        </mark>,
      )
      cursor = mark.start + mark.text.length
    })
    nodes.push(piece(cursor, text.length, 'rest'))
    return nodes
  }
  const chapterList = useMemo(() => {
    const query = chapterQuery.trim().toLowerCase()
    return query
      ? storyChapters.filter(
          item => String(item.orderKey).includes(query) || item.title.toLowerCase().includes(query),
        )
      : storyChapters
  }, [chapterQuery, storyChapters])
  const activeChapterId = currentChapter?.id ?? known.get(current)?.id ?? current
  const segmentProps = {
    storyId,
    total,
    settings,
    renderParagraph,
    onStatus: handleStatus,
    onSelect: captureSelection,
  }
  const currentIndex = view.ids.indexOf(current)
  const anchorIndex = view.ids.indexOf(view.anchor)
  const streamEnter = id => {
    const index = view.ids.indexOf(id)
    return index === anchorIndex ? view.direction : index < anchorIndex ? 'prev' : 'next'
  }
  const headerEnter = continuous ? streamEnter(headerId) : view.direction
  const atStoryEnd = Boolean(currentChapter) && !nextLink
  const endCard = (
    <StoryEndCard
      story={endStory}
      viewer={viewer}
      total={total}
      onFollowChange={setFollowState}
      t={t}
    />
  )
  const positionLabel =
    currentInfo?.orderKey && total
      ? t('reader.chapterOfTotal', { number: currentInfo.orderKey, total })
      : chapterLabel(t, currentInfo)
  const toastPosition = drawerOpen
    ? 'top-[calc(var(--app-header-h)+1rem)]'
    : mode === 'button'
      ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]'
      : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]'

  return (
    <ReaderLayout>
      <div
        ref={pageRef}
        className={`reader-page relative min-h-screen bg-reader pb-16 text-ink transition-[margin,padding] duration-300 motion-reduce:transition-none ${settingsOpen ? 'lg:mr-96' : ''} ${settings.toolbarLayout === 'vertical' ? 'pr-16 sm:pr-20' : ''} ${mode === 'button' ? 'max-sm:pb-32' : ''}`}
      >
        <p aria-live="polite" className="sr-only">
          {chapterLabel(t, currentInfo)}
        </p>
        <header className="px-4 pb-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto max-w-[1100px] px-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to={ROUTES.library}
                className="inline-flex min-h-9 items-center gap-2 rounded-full text-sm text-ink/70 transition-colors hover:text-brand-strong"
              >
                <ArrowLeft size={15} aria-hidden="true" />
                {t('reader.back')}
              </Link>
              <ReadListenSwitch storyId={storyId} chapterId={activeChapterId} mode="read" />
            </div>
            <div
              key={headerId}
              className={headerEnter ? `nh-chapter-enter-${headerEnter}` : undefined}
            >
              <p className="mt-4 text-xs font-semibold uppercase tracking-[.16em] text-brand-strong">
                {storyTitle ? (
                  <Link to={ROUTES.story(storyId)} className="hover:text-brand">
                    {storyTitle}
                  </Link>
                ) : (
                  detail.status === 'loading' && <Skeleton className="inline-block h-3 w-40" />
                )}
                {headerInfo?.orderKey && total
                  ? ` · ${t('reader.chapterOfTotal', { number: headerInfo.orderKey, total })}`
                  : ''}
              </p>
              <h1 className="mt-2 text-h2 sm:text-h1">{chapterLabel(t, headerInfo)}</h1>
              {storyAuthor && <p className="mt-2 text-caption text-ink/70">{storyAuthor}</p>}
            </div>
          </div>
        </header>
        <ReaderToolbar
          settings={settings}
          settingsOpen={settingsOpen}
          update={update}
          progress={progress}
          bookmarked={bookmarked}
          toggleBookmark={toggleBookmark}
          openNotes={() => setNotesOpen(true)}
          openChapters={() => setChaptersOpen(true)}
          openSettings={() => setSettingsOpen(true)}
          openComments={() => setCommentsOpen(true)}
          openReport={() => currentChapter && setReportTarget(currentChapter.id)}
          commentCount={currentChapter?.commentCount ?? 0}
          interactive={Boolean(currentChapter)}
          listenTo={ROUTES.listen(storyId, activeChapterId)}
          focus={focus}
          toggleFocus={() => setFocus(value => !value)}
          t={t}
        />
        <div
          className="reading-container mx-auto mt-6 sm:mt-10"
          style={{ maxWidth: settings.width }}
        >
          {showUpdated && (
            <div
              role="status"
              className="mx-4 mb-6 flex items-start gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink sm:mx-6"
            >
              <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-strong" />
              <p className="min-w-0 flex-1 leading-6">{t('reader.contentUpdated')}</p>
              <IconButton
                label={t('reader.dismiss')}
                shape="circle"
                size="sm"
                onClick={() => setUpdatedDismissed(true)}
              >
                <X size={14} />
              </IconButton>
            </div>
          )}
          {continuous ? (
            <div ref={streamRef}>
              {head && !head.locked && (
                <div className="mx-4 mb-6 flex justify-center sm:mx-6 sm:mb-8">
                  <Button variant="secondary" onClick={loadPrevious}>
                    <ChevronUp size={16} aria-hidden="true" />
                    {t('reader.loadPrevious', { chapter: chapterLabel(t, head) })}
                  </Button>
                </div>
              )}
              {view.ids.map((id, index) => (
                <ChapterSegment
                  key={id}
                  {...segmentProps}
                  chapterId={id}
                  info={known.get(id)}
                  divider={index !== 0}
                  enter={streamEnter(id)}
                  placeholderHeight={
                    Math.abs(index - currentIndex) > KEEP_AROUND ? view.heights[id] : undefined
                  }
                />
              ))}
              {appendId ? (
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />
              ) : (
                lastReady &&
                (tail ? <LockedChapterCard link={tail} storyId={storyId} t={t} /> : endCard)
              )}
            </div>
          ) : (
            <>
              <div ref={swipeRef} className={mode === 'swipe' ? 'touch-pan-y' : undefined}>
                <ChapterSegment
                  key={current}
                  {...segmentProps}
                  chapterId={current}
                  info={known.get(current)}
                  enter={view.direction}
                />
              </div>
              <nav
                aria-label={t('reader.chapterNavigation')}
                className="mx-4 mt-10 grid gap-3 border-t border-hairline pt-6 sm:mx-6 sm:flex sm:items-center sm:justify-between"
              >
                <NeighbourLink
                  link={prevLink}
                  direction="prev"
                  storyId={storyId}
                  onNavigate={() => setSelection(null)}
                  t={t}
                />
                <NeighbourLink
                  link={nextLink}
                  direction="next"
                  storyId={storyId}
                  onNavigate={() => setSelection(null)}
                  t={t}
                />
              </nav>
              {atStoryEnd && endCard}
            </>
          )}
        </div>
        {mode === 'button' && (
          <nav
            aria-label={t('reader.chapterBar')}
            className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/85 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md sm:hidden"
          >
            <div className="flex items-center gap-2">
              <IconButton
                label={t(prevLink?.locked ? 'reader.previousLocked' : 'reader.previous')}
                shape="circle"
                disabled={!canPrev}
                onClick={() => goToChapter(prevLink)}
              >
                <ChevronLeft size={20} />
              </IconButton>
              <button
                type="button"
                onClick={() => setChaptersOpen(true)}
                aria-label={t('reader.chapterBarLabel', { position: positionLabel, progress })}
                className="min-h-11 min-w-0 flex-1 rounded-full px-3 text-center transition-colors hover:bg-ink/5"
              >
                <span className="block truncate text-xs font-semibold tabular-nums">
                  {positionLabel}
                </span>
                <span
                  aria-hidden="true"
                  className="mx-auto mt-1.5 block h-1 max-w-40 overflow-hidden rounded-full bg-ink/8"
                >
                  <span
                    className="block h-full rounded-full bg-brand transition-transform duration-[800ms] ease-spring"
                    style={{ transform: `translateX(${progress - 100}%)` }}
                  />
                </span>
              </button>
              <IconButton
                label={t(nextLink?.locked ? 'reader.nextLocked' : 'reader.next')}
                shape="circle"
                tone="brand"
                disabled={!canNext}
                onClick={() => goToChapter(nextLink)}
              >
                {nextLink?.locked ? <LockKeyhole size={18} /> : <ChevronRight size={20} />}
              </IconButton>
            </div>
          </nav>
        )}
        {showHint && (
          <button
            type="button"
            onClick={dismissHint}
            className="nh-fade-enter fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-30 flex min-h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-surface/90 px-4 text-xs font-semibold text-ink shadow-float backdrop-blur-md"
          >
            <ChevronLeft size={14} aria-hidden="true" className="text-brand-strong" />
            {t(touchCapable ? 'reader.swipeHint' : 'reader.keyHint')}
            <ChevronRight size={14} aria-hidden="true" className="text-brand-strong" />
            <span className="sr-only">{t('reader.hideHint')}</span>
          </button>
        )}
        {selection && !noteOpen && (
          <div
            role="toolbar"
            aria-label={t('reader.highlight')}
            onMouseDown={event => event.preventDefault()}
            className="nh-dialog-enter absolute z-20 flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-1 rounded-3xl border border-line bg-elevated p-1 shadow-float"
            style={{ left: selection.x, top: selection.y }}
          >
            {/* Same action as the yellow swatch; dropped on narrow screens to keep one row. */}
            <ToolButton
              label={t('reader.highlight')}
              onClick={() => addHighlight('yellow')}
              className="max-[399px]:hidden"
            >
              <Highlighter size={15} />
            </ToolButton>
            <div className="flex gap-1">
              {Object.entries(highlightColors).map(([name, [color, label]]) => (
                <button
                  type="button"
                  key={name}
                  aria-label={t('reader.highlightColor', { color: label })}
                  title={t('reader.highlightColor', { color: label })}
                  onClick={() => addHighlight(name)}
                  className="grid size-9 place-items-center rounded-full transition-transform active:scale-[0.96] pointer-coarse:size-11"
                >
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-full ring-1 ring-ink/15"
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
            <Divider className="mx-0.5 max-[399px]:hidden" />
            {/* Actions stay together so narrow screens wrap into swatches / actions rows. */}
            <div className="flex gap-1">
              <ToolButton label={t('reader.addNote')} onClick={() => setNoteOpen(true)}>
                <MessageSquareText size={15} />
              </ToolButton>
              <ToolButton label={t('reader.copy')} onClick={copySelection}>
                <Copy size={15} />
              </ToolButton>
              <ToolButton label={t('reader.share')} onClick={shareSelection}>
                <Share2 size={15} />
              </ToolButton>
              <ToolButton
                label={t('reader.report')}
                disabled={!selection.chapterId}
                onClick={() => {
                  setReportTarget(selection.chapterId)
                  setSelection(null)
                }}
              >
                <Flag size={15} />
              </ToolButton>
            </div>
          </div>
        )}
        <Modal
          open={noteOpen && Boolean(selection)}
          title={editingId ? `${t('reader.edit')} · ${t('reader.notes')}` : t('reader.addNote')}
          onClose={closeNote}
        >
          {selection && (
            <form
              onSubmit={event => {
                event.preventDefault()
                addHighlight(selection.color || 'yellow', noteDraft.trim())
              }}
            >
              <blockquote className="line-clamp-3 rounded-2xl border-l-4 border-brand/60 bg-surface px-4 py-3 text-caption text-muted">
                “{unquote(selection.text)}”
              </blockquote>
              <label htmlFor="reader-note" className="mt-4 block text-sm font-semibold">
                {t('reader.notes')}
              </label>
              <textarea
                id="reader-note"
                ref={noteFieldRef}
                value={noteDraft}
                onChange={event => setNoteDraft(event.target.value)}
                placeholder={t('reader.notePlaceholder')}
                className="mt-2 min-h-28 w-full rounded-2xl border border-line bg-surface p-3 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm"
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeNote}>
                  {t('reader.cancel')}
                </Button>
                <Button type="submit">{t('reader.save')}</Button>
              </div>
            </form>
          )}
        </Modal>
        {toast && (
          <div
            role="status"
            className={`nh-fade-enter fixed left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-page shadow-float ${toastPosition}`}
          >
            <Check size={14} aria-hidden="true" className="shrink-0" />
            {toast}
          </div>
        )}
        <Drawer
          open={settingsOpen}
          docked
          title={t('reader.settings')}
          onClose={() => setSettingsOpen(false)}
        >
          <ReaderSettings settings={settings} update={update} t={t} />
        </Drawer>
        <Drawer open={notesOpen} title={t('reader.notes')} onClose={() => setNotesOpen(false)}>
          {chapterAnnotations.length ? (
            <ul className="space-y-3">
              {chapterAnnotations.map(item => (
                <Card as="li" key={item.id} className="p-4">
                  <p className="flex gap-2 text-caption text-muted">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-auto w-1 shrink-0 rounded-full"
                      style={{
                        backgroundColor: (highlightColors[item.color] || highlightColors.yellow)[0],
                      }}
                    />
                    <span className="line-clamp-3">“{unquote(item.text)}”</span>
                  </p>
                  {item.note && <p className="mt-3 text-sm text-ink">{item.note}</p>}
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        document
                          .getElementById(`annotation-${item.id}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        setNotesOpen(false)
                      }}
                    >
                      {t('reader.jump')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelection(item)
                        setEditingId(item.id)
                        setNoteDraft(item.note || '')
                        setNotesOpen(false)
                        setNoteOpen(true)
                      }}
                    >
                      {t('reader.edit')}
                    </Button>
                    <IconButton
                      label={t('reader.delete')}
                      tone="rose"
                      className="ml-auto"
                      onClick={() => removeAnnotation(item.id)}
                    >
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </Card>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={NotebookPen}
              headingAs="h3"
              title={t('reader.noNotes')}
              className="py-10"
            />
          )}
        </Drawer>
        <Drawer
          open={chaptersOpen}
          title={t('reader.chapters')}
          onClose={() => setChaptersOpen(false)}
        >
          <Input
            icon={Search}
            aria-label={t('reader.searchChapters')}
            placeholder={t('reader.searchChapters')}
            value={chapterQuery}
            onChange={event => setChapterQuery(event.target.value)}
          />
          {detail.status === 'loading' ? (
            <div aria-busy="true" className="mt-4 space-y-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="block h-11 w-full rounded-full" />
              ))}
            </div>
          ) : detail.status === 'error' ? (
            <EmptyState
              tone="rose"
              icon={List}
              headingAs="h3"
              title={t('reader.chaptersError')}
              action={
                <Button variant="secondary" size="sm" onClick={detail.retry}>
                  {t('reader.retry')}
                </Button>
              }
              className="py-10"
            />
          ) : chapterList.length ? (
            <ol
              ref={chapterListRef}
              className="-mx-2 mt-4 max-h-[calc(82dvh-11rem)] space-y-1 overflow-y-auto overscroll-contain px-2 sm:max-h-[calc(100dvh-11rem)]"
            >
              {chapterList.map(item => {
                const active = item.id === activeChapterId
                return (
                  <li key={item.id}>
                    <Link
                      to={ROUTES.read(storyId, item.id)}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        setChaptersOpen(false)
                        setSelection(null)
                      }}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-full px-4 text-sm transition-colors ${active ? 'bg-brand font-semibold text-on-brand' : 'text-ink hover:bg-ink/6'}`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="tabular-nums">
                          {t('reader.chapterNumber', {
                            number: String(item.orderKey).padStart(2, '0'),
                          })}
                        </span>
                        <span className={active ? undefined : 'text-muted'}> · {item.title}</span>
                      </span>
                      {item.locked ? (
                        <LockKeyhole
                          size={14}
                          aria-label={t('reader.lockedShort')}
                          className="shrink-0"
                        />
                      ) : (
                        active && (
                          <Bookmark
                            size={14}
                            aria-hidden="true"
                            className="shrink-0 fill-current"
                          />
                        )
                      )}
                    </Link>
                  </li>
                )
              })}
            </ol>
          ) : (
            <EmptyState
              icon={List}
              headingAs="h3"
              title={t('reader.noChapterMatch')}
              className="py-10"
            />
          )}
        </Drawer>
        <Drawer
          open={commentsOpen}
          title={t('reader.comments')}
          onClose={() => setCommentsOpen(false)}
        >
          {/* Public comments stay readable on a locked chapter; posting needs access. */}
          {activeChapterId && (
            <CommentThread
              targetType="chapter"
              targetId={activeChapterId}
              canComment={Boolean(currentChapter)}
              disabledReason={t('reader.commentLocked')}
            />
          )}
        </Drawer>
        <ReportDialog
          open={Boolean(reportTarget)}
          onClose={() => setReportTarget(null)}
          targetType="chapter"
          targetId={reportTarget}
        />
      </div>
    </ReaderLayout>
  )
}
