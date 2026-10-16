import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlignJustify,
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  BellRing,
  Bookmark,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Flag,
  Focus,
  Highlighter,
  List,
  MessageSquareText,
  NotebookPen,
  Search,
  Settings2,
  Share2,
  Trash2,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
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
} from '../../components/ui';
import { ReaderRange, ReaderSettings } from '../../components/reader/ReaderSettings';
import { ChapterSegment } from '../../components/reader/ChapterSegment';
import { ChapterInlineText } from '../../components/reader/ChapterInlineText';
import { useChapterSwipe } from '../../components/reader/useChapterSwipe';
import { useBackendDocument } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import {
  DEFAULT_CHAPTER_MODE,
  DEFAULT_READER_FONT,
  READER_CHAPTER_MODES,
  READER_FONTS,
  READER_FONT_SIZES,
  READER_LINE_HEIGHTS,
  READER_WIDTH,
} from '../../components/reader/readerOptions';
import { ROUTES } from '../../app/routes';
import { useLocale } from '../../context/LocaleContext';
const emptyCatalog = { story: {}, chapters: [] };
const emptyFollow = { following: false };

const SETTINGS_KEY = 'novelhub.reader.settings.v2';
const BOOKMARK_KEY = 'novelhub.reader.bookmarks.v1';
const ANNOTATIONS_KEY = 'novelhub.reader.annotations.v1';
const emptyProgress = { position: 0, revisionId: null };
const SWIPE_HINT_KEY = 'novelhub.reader.swipe-hint.v1';
const CHAPTER_MODES = READER_CHAPTER_MODES.map((mode) => mode.value);
/* Continuous scroll: the chapter crossing this viewport line is "current"; ±1 stay rendered. */
const READING_LINE = 0.35;
const KEEP_AROUND = 1;
/* Reader highlight swatches are intrinsic content colours (AGENTS §7); text on them stays dark. */
const highlightColors = {
  yellow: ['#f4df8d', 'vàng'],
  green: ['#9fd8b9', 'xanh lá'],
  blue: ['#9ec9e8', 'xanh dương'],
  pink: ['#e9afc0', 'hồng'],
};
const HIGHLIGHT_INK = '#172033';
const SELECTION_TOOLBAR_WIDTH = 400;
/* The note text already carries the prose's own quotation marks; the UI adds one pair. */
const unquote = (text) => text.replace(/^[\s“”"‘’']+|[\s“”"‘’']+$/g, '');
const readStored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasTextSelection = () => Boolean(window.getSelection()?.toString().trim());
/*
 * Which chapters the canvas shows. `url` is the chapter in the address bar, `current` the one being
 * read; in continuous scroll `first..last` is the rendered stream started at `anchor`, and
 * `heights` keeps the size of unloaded far chapters. `jump` counts explicit chapter changes.
 */
const freshView = (number, direction = null, jump = 0) => ({
  url: number,
  current: number,
  anchor: number,
  first: number,
  last: number,
  heights: {},
  direction,
  jump,
});

function ToolButton({ active, label, children, onClick, disabled, className = '' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-11 ${active ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-ink/6 hover:text-ink'} ${className}`}
    >
      {children}
    </button>
  );
}

const Divider = ({ className = '' }) => (
  <span aria-hidden="true" className={`h-6 w-px shrink-0 bg-hairline ${className}`} />
);

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
  t,
}) {
  const fontIndex = READER_FONT_SIZES.indexOf(settings.fontSize);
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
    );
  return (
    <div
      data-reader-toolbar
      className="sticky top-[var(--app-header-h)] z-30 border-b border-hairline bg-reader/85 px-4 pb-2 pt-2.5 backdrop-blur-md sm:px-6 [@media(max-height:500px)]:static"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="flex items-center gap-3 px-1">
          <ProgressBar value={progress} size="sm" label="Tiến độ đọc chương" />
          <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-brand-strong">
            {progress}%
          </span>
        </div>
        <div
          role="toolbar"
          aria-label="Thanh công cụ đọc"
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
              onChange={(value) => update('width', value)}
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
            {READER_LINE_HEIGHTS.map((value) => (
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
  );
}

function StoryEndCard({ following, onFollow, story, total, followDisabled }) {
  return (
    <Card className="mx-4 mt-12 text-center sm:mx-6">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
        <BookOpenCheck size={24} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-h3">Bạn đã đọc đến chương mới nhất</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        {story.title} hiện có {total} chương. Theo dõi truyện để nhận thông báo ngay khi{' '}
        {story.author} đăng chương mới.
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button
          variant={following ? 'secondary' : 'primary'}
          aria-pressed={following}
          onClick={onFollow}
          disabled={followDisabled}
        >
          {following ? <Check size={16} aria-hidden="true" /> : <BellRing size={16} />}
          {following ? 'Đang theo dõi' : 'Theo dõi truyện'}
        </Button>
        <ButtonLink variant="secondary" to={ROUTES.library}>
          Về thư viện
        </ButtonLink>
      </div>
    </Card>
  );
}

export function FullChapterReaderPage() {
  const { storyId, chapterId } = useParams();
  const catalog = useBackendDocument(`/catalog/stories/${storyId}`, emptyCatalog);
  if (catalog.status !== 'ready')
    return (
      <ReaderLayout>
        <div className="page-reader py-10">
          <EmptyState
            title={
              catalog.status === 'loading'
                ? 'Đang tải truyện…'
                : catalog.status === 'error'
                  ? 'Không tải được truyện'
                  : 'Không tìm thấy truyện'
            }
            action={
              catalog.status === 'error' ? (
                <Button onClick={catalog.retry}>Thử lại</Button>
              ) : undefined
            }
          />
        </div>
      </ReaderLayout>
    );
  const index = catalog.data.chapters.findIndex(
    (item) => item.id === chapterId || `chapter-${item.orderKey}` === chapterId,
  );
  if (index < 0)
    return (
      <ReaderLayout>
        <div className="page-reader py-10">
          <EmptyState
            title="Không tìm thấy chương"
            description="Chọn một chương đã xuất bản trong danh sách truyện."
            action={<ButtonLink to={ROUTES.story(storyId)}>Về truyện</ButtonLink>}
          />
        </div>
      </ReaderLayout>
    );
  return (
    <LoadedChapterReader
      key={catalog.data.story.id}
      catalog={catalog.data}
      chapterNumber={index + 1}
    />
  );
}

function LoadedChapterReader({ catalog, chapterNumber }) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const storyId = catalog.story.id;
  const chapterTotal = catalog.chapters.length;
  const chapterFor = (number) => catalog.chapters[number - 1];
  const readerChapterTitle = (number) => chapterFor(number)?.title ?? '';
  const displayedNumber = (number) => chapterFor(number)?.orderKey ?? number;
  const pageRef = useRef(null);
  const swipeRef = useRef(null);
  const streamRef = useRef(null);
  const sentinelRef = useRef(null);
  const chapterListRef = useRef(null);
  const noteFieldRef = useRef(null);
  const [settings, setSettings] = useState(() => {
    const stored = { ...readStored(SETTINGS_KEY, {}) };
    delete stored.progress;
    const allowedFonts = READER_FONTS.map(([, value]) => value);
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
    };
  });
  const mode = settings.chapterMode;
  const continuous = mode === 'continuous';
  const [view, setView] = useState(() => freshView(chapterNumber));
  /*
   * Address-bar changes: in continuous scroll the URL follows the chapter in view (our own
   * replace); anything else (chapter list, prev/next, swipe, keys) is a jump to a new chapter.
   */
  if (chapterNumber !== view.url) {
    setView(
      continuous && chapterNumber === view.current
        ? { ...view, url: chapterNumber }
        : freshView(chapterNumber, chapterNumber > view.current ? 'next' : 'prev', view.jump + 1),
    );
  }
  const current = view.current;
  const chapterKey = `${storyId}-${current}`;
  const headerNumber = continuous ? view.first : current;
  const urlNumber = view.url;
  const [statuses, setStatuses] = useState({});
  const [revisionIds, setRevisionIds] = useState({});
  const [resumeChapterId] = useState(() => chapterFor(chapterNumber).id);
  const resume = useBackendDocument(`/reader/progress/${resumeChapterId}`, emptyProgress);
  const [progress, setProgress] = useState(0);
  const [bookmarks, setBookmarks] = useState(() => readStored(BOOKMARK_KEY, []));
  const [annotations, setAnnotations] = useState(() => readStored(ANNOTATIONS_KEY, []));
  const [selection, setSelection] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [toast, setToast] = useState('');
  const [chapterQuery, setChapterQuery] = useState('');
  const follow = useBackendDocument(`/reader/follows/${storyId}`, emptyFollow);
  const following = follow.data.following;
  const [followSaving, setFollowSaving] = useState(false);
  const [hintSeen, setHintSeen] = useState(() => localStorage.getItem(SWIPE_HINT_KEY) === '1');
  const [coarsePointer] = useState(() => window.matchMedia('(pointer: coarse)').matches);
  const [touchCapable] = useState(() => coarsePointer || navigator.maxTouchPoints > 0);
  const bookmarked = bookmarks.includes(chapterKey);
  const drawerOpen = settingsOpen || notesOpen || chaptersOpen;
  const panelOpen = drawerOpen || noteOpen;
  const showHint = mode === 'swipe' && !hintSeen;
  const chapterHref = (number) => ROUTES.read(storyId, chapterFor(number)?.id);

  /* Latest render values for listeners that live across renders. */
  const latest = useRef({ mode, current, storyId, noteOpen });
  const restoreRef = useRef({ pending: true, number: chapterNumber });
  const measureRef = useRef(() => {});
  const captureRef = useRef(() => {});
  useEffect(() => {
    latest.current = { mode, current, storyId, noteOpen };
  });

  const update = (key, value) => {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
    if (key === 'chapterMode') {
      setSelection(null);
      setView((previous) => ({
        ...freshView(previous.current, null, previous.jump),
        url: previous.url,
      }));
    }
  };
  const dismissHint = useCallback(() => {
    localStorage.setItem(SWIPE_HINT_KEY, '1');
    setHintSeen(true);
  }, []);
  const goToChapter = (number) => {
    if (number < 1 || number > chapterTotal || number === current) return;
    setSelection(null);
    if (mode === 'swipe') dismissHint();
    navigate(chapterHref(number));
  };

  /* Segments report their load state: gates the continuous stream and the resume position. */
  const handleStatus = useCallback(
    (number, status, revisionId) => {
      if (revisionId)
        setRevisionIds((previous) =>
          previous[number] === revisionId ? previous : { ...previous, [number]: revisionId },
        );
      setStatuses((previous) =>
        previous[number] === status ? previous : { ...previous, [number]: status },
      );
      const restore = restoreRef.current;
      if (
        !restore.pending ||
        number !== restore.number ||
        status === 'loading' ||
        resume.status !== 'ready'
      )
        return;
      restore.pending = false;
      if (status !== 'ready') return;
      requestAnimationFrame(() => {
        const segment = document.querySelector(`[data-chapter-segment="${number}"]`);
        if (resume.data.revisionId === revisionId && segment && resume.data.position > 0) {
          scrollTo({
            top:
              segment.getBoundingClientRect().top +
              scrollY +
              segment.offsetHeight * resume.data.position -
              innerHeight * READING_LINE,
            behavior: 'instant',
          });
        }
        measureRef.current();
      });
    },
    [resume.status, resume.data],
  );

  /* Reading progress of the current chapter + resume position, sampled once per frame. */
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const { current: number } = latest.current;
      const segment = document.querySelector(`[data-chapter-segment="${number}"]`);
      let ratio;
      if (segment) {
        const rect = segment.getBoundingClientRect();
        ratio = rect.height > 0 ? (innerHeight * READING_LINE - rect.top) / rect.height : 0;
      } else {
        const height = document.documentElement.scrollHeight - innerHeight;
        ratio = height > 0 ? scrollY / height : 0;
      }
      setProgress(Math.round(Math.min(1, Math.max(0, ratio)) * 100));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measureRef.current = schedule;
    schedule();
    addEventListener('scroll', schedule, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
    };
  }, []);
  useEffect(() => {
    measureRef.current();
  }, [current, mode, statuses]);

  useEffect(() => {
    if (statuses[current] !== 'ready' || !revisionIds[current] || restoreRef.current.pending)
      return undefined;
    const timer = setTimeout(() => {
      apiRequest(`/reader/progress/${catalog.chapters[current - 1].id}`, {
        method: 'PUT',
        body: { position: progress / 100, revisionId: revisionIds[current] },
      }).catch((error) => setToast(`Chưa lưu được tiến độ: ${error.message}`));
    }, 1000);
    return () => clearTimeout(timer);
  }, [current, progress, statuses, revisionIds, catalog.chapters]);

  /* Explicit chapter changes start at the top of the new chapter. */
  useEffect(() => {
    if (!view.jump) return;
    scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
  }, [view.jump]);
  /* Continuous scroll keeps the address bar on the chapter in view, without a remount or scroll. */
  useEffect(() => {
    if (current === urlNumber) return;
    navigate(ROUTES.read(storyId, catalog.chapters[current - 1]?.id), {
      replace: true,
      preventScrollReset: true,
    });
  }, [current, urlNumber, navigate, storyId, catalog.chapters]);

  /* Continuous scroll: the chapter crossing the reading line is current; far ones unload. */
  useEffect(() => {
    const root = streamRef.current;
    if (!continuous || !root) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((entry) => entry.isIntersecting);
        if (!hit) return;
        const number = Number(hit.target.dataset.chapterSegment);
        const heights = {};
        root.querySelectorAll('[data-chapter-segment]').forEach((node) => {
          const other = Number(node.dataset.chapterSegment);
          if (Math.abs(other - number) > KEEP_AROUND && node.dataset.placeholder !== 'true') {
            heights[other] = node.offsetHeight;
          }
        });
        setView((previous) =>
          previous.current === number && !Object.keys(heights).length
            ? previous
            : { ...previous, current: number, heights: { ...previous.heights, ...heights } },
        );
      },
      { rootMargin: `-${READING_LINE * 100}% 0px -${100 - READING_LINE * 100 - 1}% 0px` },
    );
    root.querySelectorAll('[data-chapter-segment]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [continuous, view.first, view.last]);
  /* …and the next chapter is fetched before the reader reaches the end of the last one. */
  const lastReady = statuses[view.last] === 'ready';
  useEffect(() => {
    const node = sentinelRef.current;
    if (!continuous || !node || !lastReady || view.last >= chapterTotal) return undefined;
    const last = view.last;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setView((previous) =>
          previous.last === last ? { ...previous, last: last + 1 } : previous,
        );
      },
      { rootMargin: '0px 0px 120% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [continuous, lastReady, view.last, chapterTotal]);
  const loadPrevious = () => {
    setSelection(null);
    setView((previous) =>
      previous.first > 1
        ? {
            ...previous,
            first: previous.first - 1,
            current: previous.first - 1,
            jump: previous.jump + 1,
          }
        : previous,
    );
  };

  useChapterSwipe(swipeRef, {
    enabled: mode === 'swipe',
    canPrev: current > 1,
    canNext: current < chapterTotal,
    onCommit: (direction) => goToChapter(direction === 'next' ? current + 1 : current - 1),
    resetKey: current,
  });
  useEffect(() => {
    if (!showHint) return undefined;
    const timer = setTimeout(dismissHint, 5200);
    return () => clearTimeout(timer);
  }, [showHint, dismissHint]);

  useEffect(() => {
    document.documentElement.dataset.readerFocus = String(focus);
    return () => {
      delete document.documentElement.dataset.readerFocus;
    };
  }, [focus]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (panelOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selection) setSelection(null);
        else if (focus) setFocus(false);
        return;
      }
      if (mode === 'continuous' || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (
        event.target.closest?.(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [role="listbox"]',
        ) ||
        hasTextSelection()
      ) {
        return;
      }
      const target = event.key === 'ArrowRight' ? current + 1 : current - 1;
      if (target < 1 || target > chapterTotal) return;
      event.preventDefault();
      setSelection(null);
      if (mode === 'swipe') dismissHint();
      navigate(ROUTES.read(storyId, catalog.chapters[target - 1]?.id));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    panelOpen,
    selection,
    focus,
    mode,
    current,
    navigate,
    storyId,
    dismissHint,
    chapterTotal,
    catalog.chapters,
  ]);
  useEffect(() => {
    const list = chapterListRef.current;
    const active = list?.querySelector('[aria-current="page"]');
    if (!chaptersOpen || !active) return;
    /* Scroll only the list so the drawer title, close button and search stay in view. */
    list.scrollTop =
      active.offsetTop - list.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2;
  }, [chaptersOpen]);
  /* The Modal focuses its panel first (child effects run first); then the note field. */
  useEffect(() => {
    if (noteOpen) noteFieldRef.current?.focus();
  }, [noteOpen]);

  const persistAnnotations = (next) => {
    setAnnotations(next);
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(next));
  };
  const annotationsFor = (key) =>
    annotations.filter((item) =>
      item.chapter ? item.chapter === key : key === `${storyId}-${chapterNumber}`,
    );
  const chapterAnnotations = annotationsFor(chapterKey);
  const toggleBookmark = () => {
    const next = bookmarked
      ? bookmarks.filter((id) => id !== chapterKey)
      : [...bookmarks, chapterKey];
    setBookmarks(next);
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
    setToast(t(bookmarked ? 'reader.unbookmarked' : 'reader.bookmarked'));
  };
  const captureSelection = () => {
    const selected = window.getSelection();
    const text = selected?.toString().trim();
    const anchor = selected?.anchorNode;
    const element = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const article = element?.closest('[data-chapter-article]');
    if (!text || !selected.rangeCount || !article || !pageRef.current) {
      /* A collapsed selection while the note dialog is open must not drop the note's target. */
      if (!latest.current.noteOpen) setSelection(null);
      return;
    }
    const paragraph = element.closest('[data-paragraph]');
    const rect = selected.getRangeAt(0).getBoundingClientRect();
    const page = pageRef.current.getBoundingClientRect();
    const toolbarWidth = Math.min(SELECTION_TOOLBAR_WIDTH, innerWidth - 24);
    const left = Math.min(
      innerWidth - toolbarWidth - 12,
      Math.max(12, rect.left + rect.width / 2 - toolbarWidth / 2),
    );
    /*
     * Above the selection unless that collides with the sticky chrome; then below it, never under
     * the chrome. Touch devices always go below: the native selection menu sits above the text.
     */
    const toolbar = document.querySelector('[data-reader-toolbar]')?.getBoundingClientRect();
    const chromeBottom = Math.max(0, toolbar?.bottom ?? 0) + 8;
    const placeBelow = coarsePointer || rect.top - 58 < chromeBottom;
    setSelection({
      text,
      chapter: article.dataset.chapterKey,
      index: Number(paragraph?.dataset.paragraph || 0),
      x: left - page.left,
      y: (placeBelow ? Math.max(chromeBottom, rect.bottom + 12) : rect.top - 58) - page.top,
    });
  };
  /* Phones select by long-press and handles (no mouseup): follow selectionchange, debounced. */
  useEffect(() => {
    captureRef.current = captureSelection;
  });
  useEffect(() => {
    let timer = 0;
    const onSelectionChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => captureRef.current(), 250);
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, []);
  const closeNote = () => {
    setNoteOpen(false);
    setEditingId(null);
    setNoteDraft('');
  };
  const addHighlight = (color = 'yellow', note = '') => {
    if (editingId) {
      persistAnnotations(
        annotations.map((item) => (item.id === editingId ? { ...item, note } : item)),
      );
    } else if (selection) {
      const { text, index } = selection;
      persistAnnotations([
        ...annotations,
        { id: Date.now(), chapter: selection.chapter || chapterKey, text, index, color, note },
      ]);
    } else return;
    setSelection(null);
    closeNote();
    window.getSelection()?.removeAllRanges();
    setToast(t(note ? 'reader.addNote' : 'reader.highlight'));
  };
  const copySelection = async () => {
    if (selection) await navigator.clipboard?.writeText(selection.text);
    setToast(t('reader.copy'));
    setSelection(null);
  };
  const shareSelection = async () => {
    try {
      if (selection && navigator.share)
        await navigator.share({ title: catalog.story.title, text: selection.text });
      else if (selection) await navigator.clipboard?.writeText(selection.text);
      setToast(t('reader.share'));
    } catch {
      /* The share sheet was dismissed; nothing to report. */
    }
    setSelection(null);
  };
  const removeAnnotation = (id) => persistAnnotations(annotations.filter((item) => item.id !== id));
  const renderParagraph = (paragraph, index, key, inlines) => {
    const renderText = (start, end) =>
      inlines ? (
        <ChapterInlineText inlines={inlines} start={start} end={end} />
      ) : (
        paragraph.slice(start, end)
      );
    const marks = annotationsFor(key)
      .filter((item) => item.index === index && paragraph.includes(item.text))
      .map((item) => ({ ...item, start: paragraph.indexOf(item.text) }))
      .sort((a, b) => a.start - b.start);
    if (!marks.length) return renderText(0, paragraph.length);
    const nodes = [];
    let cursor = 0;
    marks.forEach((mark) => {
      if (mark.start < cursor) return;
      nodes.push(<span key={`before-${mark.id}`}>{renderText(cursor, mark.start)}</span>);
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
          {renderText(mark.start, mark.start + mark.text.length)}
          {mark.note && (
            <MessageSquareText size={12} aria-hidden="true" className="ml-1 inline align-super" />
          )}
        </mark>,
      );
      cursor = mark.start + mark.text.length;
    });
    nodes.push(<span key="tail">{renderText(cursor, paragraph.length)}</span>);
    return nodes;
  };
  const chapters = useMemo(
    () =>
      Array.from({ length: chapterTotal }, (_, i) => i + 1).filter((number) =>
        `${catalog.chapters[number - 1].orderKey} ${catalog.chapters[number - 1].title}`
          .toLowerCase()
          .includes(chapterQuery.toLowerCase()),
      ),
    [chapterQuery, chapterTotal, catalog.chapters],
  );
  const toggleFollow = async () => {
    if (followSaving || follow.status !== 'ready') return;
    setFollowSaving(true);
    try {
      await apiRequest(`/reader/follows/${storyId}`, {
        method: 'PUT',
        body: { following: !following },
      });
      follow.retry();
      setToast(following ? 'Đã bỏ theo dõi truyện' : 'Đã theo dõi truyện');
    } catch (error) {
      setToast(error.message);
    } finally {
      setFollowSaving(false);
    }
  };
  const segmentProps = {
    storyId,
    chapters: catalog.chapters,
    settings,
    renderParagraph,
    onStatus: handleStatus,
    onSelect: captureSelection,
  };
  const stream = Array.from({ length: view.last - view.first + 1 }, (_, i) => view.first + i);
  const streamEnter = (number) =>
    number === view.anchor ? view.direction : number < view.anchor ? 'prev' : 'next';
  const headerEnter = continuous ? streamEnter(headerNumber) : view.direction;
  const atStoryEnd = current === chapterTotal && statuses[current] === 'ready';
  const toastPosition = drawerOpen
    ? 'top-[calc(var(--app-header-h)+1rem)]'
    : mode === 'button'
      ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]'
      : 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]';

  return (
    <ReaderLayout>
      <div
        ref={pageRef}
        className={`reader-page relative min-h-screen bg-reader pb-16 text-ink transition-[margin,padding] duration-300 motion-reduce:transition-none ${settingsOpen ? 'lg:mr-96' : ''} ${settings.toolbarLayout === 'vertical' ? 'pr-16 sm:pr-20' : ''} ${mode === 'button' ? 'max-sm:pb-32' : ''}`}
      >
        <p aria-live="polite" className="sr-only">
          Chương {displayedNumber(current)}: {readerChapterTitle(current)}
        </p>
        <header className="px-4 pb-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mx-auto max-w-[1100px] px-1">
            <Link
              to={ROUTES.library}
              className="inline-flex min-h-9 items-center gap-2 rounded-full text-sm text-ink/70 transition-colors hover:text-brand-strong"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {t('reader.back')}
            </Link>
            <div
              key={headerNumber}
              className={headerEnter ? `nh-chapter-enter-${headerEnter}` : undefined}
            >
              <p className="mt-4 text-xs font-semibold uppercase tracking-[.16em] text-brand-strong">
                {catalog.story.title} · Chương {displayedNumber(headerNumber)} / {chapterTotal}
              </p>
              <h1 className="mt-2 text-h2 sm:text-h1">
                Chương {displayedNumber(headerNumber)}: {readerChapterTitle(headerNumber)}
              </h1>
              <p className="mt-2 text-caption text-ink/70">
                {catalog.story.author} · {'Đọc theo nhịp của bạn'}
              </p>
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
          focus={focus}
          toggleFocus={() => setFocus((value) => !value)}
          t={t}
        />
        <div
          className="reading-container mx-auto mt-6 sm:mt-10"
          style={{ maxWidth: settings.width }}
        >
          {resume.status === 'error' && (
            <p role="alert" className="mx-4 mb-6 text-sm text-rose-strong">
              Chưa tải được tiến độ đã lưu.{' '}
              <Button variant="secondary" size="sm" onClick={resume.retry}>
                Thử lại
              </Button>
            </p>
          )}
          {continuous ? (
            <div ref={streamRef}>
              {view.first > 1 && (
                <div className="mx-4 mb-6 flex justify-center sm:mx-6 sm:mb-8">
                  <Button variant="secondary" onClick={loadPrevious}>
                    <ChevronUp size={16} aria-hidden="true" />
                    Đọc chương trước · Chương {displayedNumber(view.first - 1)}
                  </Button>
                </div>
              )}
              {stream.map((number) => (
                <ChapterSegment
                  key={number}
                  {...segmentProps}
                  number={number}
                  showFigure={!focus && number === view.first}
                  divider={number !== view.first}
                  enter={streamEnter(number)}
                  placeholderHeight={
                    Math.abs(number - current) > KEEP_AROUND ? view.heights[number] : undefined
                  }
                />
              ))}
              {view.last < chapterTotal ? (
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />
              ) : (
                statuses[view.last] === 'ready' && (
                  <StoryEndCard
                    following={following}
                    onFollow={toggleFollow}
                    story={catalog.story}
                    total={chapterTotal}
                    followDisabled={followSaving || follow.status !== 'ready'}
                  />
                )
              )}
            </div>
          ) : (
            <>
              <div ref={swipeRef} className={mode === 'swipe' ? 'touch-pan-y' : undefined}>
                <ChapterSegment
                  key={current}
                  {...segmentProps}
                  number={current}
                  showFigure={!focus}
                  enter={view.direction}
                />
              </div>
              <nav
                aria-label="Điều hướng chương"
                className="mx-4 mt-10 grid gap-3 border-t border-hairline pt-6 sm:mx-6 sm:flex sm:items-center sm:justify-between"
              >
                {current > 1 ? (
                  <ButtonLink
                    variant="secondary"
                    size="lg"
                    className="min-h-[3.125rem] py-1.5"
                    to={chapterHref(current - 1)}
                    onClick={() => setSelection(null)}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                    {t('reader.previous')}
                  </ButtonLink>
                ) : (
                  <span aria-hidden="true" />
                )}
                {current < chapterTotal && (
                  <ButtonLink
                    size="lg"
                    className="min-h-[3.125rem] py-1.5"
                    to={chapterHref(current + 1)}
                    trailingIcon={ArrowRight}
                    onClick={() => setSelection(null)}
                  >
                    {t('reader.next')}
                  </ButtonLink>
                )}
              </nav>
              {atStoryEnd && (
                <StoryEndCard
                  following={following}
                  onFollow={toggleFollow}
                  story={catalog.story}
                  total={chapterTotal}
                  followDisabled={followSaving || follow.status !== 'ready'}
                />
              )}
            </>
          )}
        </div>
        {mode === 'button' && (
          <nav
            aria-label="Thanh chuyển chương"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/85 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md sm:hidden"
          >
            <div className="flex items-center gap-2">
              <IconButton
                label={t('reader.previous')}
                shape="circle"
                disabled={current <= 1}
                onClick={() => goToChapter(current - 1)}
              >
                <ChevronLeft size={20} />
              </IconButton>
              <button
                type="button"
                onClick={() => setChaptersOpen(true)}
                aria-label={`Chương ${current} / ${chapterTotal}, đã đọc ${progress}%. Mở danh sách chương`}
                className="min-h-11 min-w-0 flex-1 rounded-full px-3 text-center transition-colors hover:bg-ink/5"
              >
                <span className="block text-xs font-semibold tabular-nums">
                  Chương {displayedNumber(current)} / {chapterTotal}
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
                label={t('reader.next')}
                shape="circle"
                tone="brand"
                disabled={current >= chapterTotal}
                onClick={() => goToChapter(current + 1)}
              >
                <ChevronRight size={20} />
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
            {touchCapable ? 'Vuốt để chuyển chương' : 'Dùng phím ← → để chuyển chương'}
            <ChevronRight size={14} aria-hidden="true" className="text-brand-strong" />
            <span className="sr-only">. Bấm để ẩn gợi ý</span>
          </button>
        )}
        {selection && !noteOpen && (
          <div
            role="toolbar"
            aria-label={t('reader.highlight')}
            onMouseDown={(event) => event.preventDefault()}
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
                  aria-label={`${t('reader.highlight')} màu ${label}`}
                  title={`${t('reader.highlight')} màu ${label}`}
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
                onClick={() => {
                  setToast(t('reader.report'));
                  setSelection(null);
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
              onSubmit={(event) => {
                event.preventDefault();
                addHighlight(selection.color || 'yellow', noteDraft.trim());
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
                onChange={(event) => setNoteDraft(event.target.value)}
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
              {chapterAnnotations.map((item) => (
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
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setNotesOpen(false);
                      }}
                    >
                      {t('reader.jump')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelection(item);
                        setEditingId(item.id);
                        setNoteDraft(item.note || '');
                        setNotesOpen(false);
                        setNoteOpen(true);
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
            inputMode="numeric"
            value={chapterQuery}
            onChange={(event) => setChapterQuery(event.target.value)}
          />
          {chapters.length ? (
            <ol
              ref={chapterListRef}
              className="-mx-2 mt-4 max-h-[calc(82dvh-11rem)] space-y-1 overflow-y-auto overscroll-contain px-2 sm:max-h-[calc(100dvh-11rem)]"
            >
              {chapters.map((number) => {
                const active = number === current;
                return (
                  <li key={number}>
                    <Link
                      to={chapterHref(number)}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => {
                        setChaptersOpen(false);
                        setSelection(null);
                      }}
                      className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-full px-4 text-sm transition-colors ${active ? 'bg-brand font-semibold text-on-brand' : 'text-ink hover:bg-ink/6'}`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="tabular-nums">
                          Chương {String(displayedNumber(number)).padStart(2, '0')}
                        </span>
                        <span className={active ? undefined : 'text-muted'}>
                          {' '}
                          · {readerChapterTitle(number)}
                        </span>
                      </span>
                      {active && (
                        <Bookmark size={14} aria-hidden="true" className="shrink-0 fill-current" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState
              icon={List}
              headingAs="h3"
              title="Không tìm thấy chương phù hợp"
              className="py-10"
            />
          )}
        </Drawer>
      </div>
    </ReaderLayout>
  );
}
