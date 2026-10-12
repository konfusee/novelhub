import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  AlignLeft,
  AtSign,
  Bold,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Heading2,
  Heading3,
  Image,
  Info,
  Italic,
  ListTree,
  MessageSquare,
  PanelLeft,
  PanelRight,
  PenLine,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Underline,
  X,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { useMockResource } from '../../context/MockDataContext';
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
} from '../../components/ui';

const STORY_ROUTE = '/author/stories/demo';
const EDITOR_ROUTE = `${STORY_ROUTE}/chapters/chapter-1/edit`;
const chapterRoute = (number) => `${STORY_ROUTE}/chapters/chapter-${number}/edit`;
const TARGET_WORDS = 2500;
const WORDS_PER_MINUTE = 250;
const SCENE_BREAK = '*     *     *';
const SUGGESTION =
  'Before the third ring could collapse, a sudden silence fell over the canopy—not even the wind dared disturb the surface.';

const initialText = `The mist clung to the forest floor like cold wool, muffling the sound of Kaelen’s boots against the moss-encrusted roots. Overhead, the Ironwood canopy arched into an unbroken cathedral of black bark and silver veins, filtering the late afternoon light into razor-thin shafts of emerald dust. He reached into his coat, his fingertips brushing against the cool, etched brass of the astrolabe. Its inner dials ticked with an irregular, organic rhythm—a cadence that matched the pulse of the ancient wood itself.

“You’re walking too fast,” Vrena murmured from behind him, her voice low enough to stay beneath the hum of the canopy spirits. She held her shortbow slack at her hip, her gaze tracking the twisting branches forty cubits up. “The wood doesn’t like to be hurried, Kaelen. Especially not now. Not when the sap has started to run blue.”

${SCENE_BREAK}

Kaelen halted before the clearing. Here, at the geographic fulcrum of the grove, stood the Mother Oak. Her trunk was broader than five galleons moored abreast, scarred with ancient carvings from civilizations that predated the Fall. Deep within the hollow formed by two converging roots, a pool of memory-clear water reflected stars that did not belong to the daylight sky above them.`;

const initialGroups = [
  {
    act: 'ACT I: ROOTS',
    count: 12,
    chapters: [
      [1, 'Ch. 1: The Whispering Grove'],
      [2, 'Ch. 2: Silver Sap'],
    ],
  },
  {
    act: 'ACT II: THE WHISPERING CANOPY',
    count: 4,
    chapters: [
      [14, 'Ch. 14: Elder Roots'],
      [15, 'Ch. 15: The Silent Forest'],
      [16, 'Ch. 16: Heart of the Ironwood'],
    ],
  },
];
/* The chapter document the editor loads: story context, chapter text and the story outline. */
const chapterDocument = {
  storyTitle: 'The Silent Forest',
  storyMeta: 'Kỳ ảo · Dài kỳ',
  title: 'Chapter 16: Heart of the Ironwood',
  body: initialText,
  groups: initialGroups,
  activeChapter: 16,
  nextChapter: 17,
};
const isBlankChapter = (chapter) => !chapter.body.trim();
const utilityTabs = [
  { value: 'outline', label: 'Dàn ý' },
  { value: 'notes', label: 'Ghi chú' },
  { value: 'ai', label: 'Trợ lý AI' },
  { value: 'checklist', label: 'Danh sách kiểm tra' },
];

/* [icon, label, edit] — edit(selectedText) returns [before, inner, after] markers. */
const tools = [
  [Bold, 'In đậm', (text) => ['**', text || 'chữ đậm', '**']],
  [Italic, 'In nghiêng', (text) => ['_', text || 'chữ nghiêng', '_']],
  [Underline, 'Gạch chân', (text) => ['<u>', text || 'gạch chân', '</u>']],
  [Heading2, 'Tiêu đề 2', (text) => ['\n## ', text || 'Tiêu đề', '\n']],
  [Heading3, 'Tiêu đề 3', (text) => ['\n### ', text || 'Tiêu đề nhỏ', '\n']],
  [Quote, 'Trích dẫn', (text) => ['\n> ', text || 'Trích dẫn', '\n']],
  [AlignLeft, 'Đường phân cách cảnh', () => [`\n\n${SCENE_BREAK}\n\n`, '', '']],
  [MessageSquare, 'Hội thoại', (text) => ['“', text || 'Lời thoại', '”']],
  [AtSign, 'Đề cập', (text) => ['@', text || 'nhân vật', '']],
  [Image, 'Hình ảnh', (text) => ['\n![', text || 'Mô tả hình ảnh', '](duong-dan-anh)\n']],
];

const countWords = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const paragraphsOf = (text) =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

export function ChapterEditorPage() {
  const { storyId = 'demo', chapterId = 'chapter-1' } = useParams();
  const resourceKey = `chapter:${storyId}:${chapterId}`;
  const chapter = useMockResource(resourceKey, chapterDocument, { isEmpty: isBlankChapter });
  const [blankKey, setBlankKey] = useState(null);
  const writingBlank = chapter.status === 'empty' && blankKey === resourceKey;
  const loading = chapter.status === 'loading';

  return (
    <AuthorLayout>
      {chapter.status === 'ready' || writingBlank ? (
        <ChapterEditor
          key={writingBlank ? `${resourceKey}:blank` : resourceKey}
          chapter={writingBlank ? { ...chapter.data, title: '', body: '' } : chapter.data}
        />
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
                    title="Không tải được chương"
                    description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                    action={<RetryButton onClick={chapter.retry} />}
                  />
                ) : (
                  <EmptyState
                    icon={PenLine}
                    title="Chương chưa có nội dung"
                    description="Chương này chưa có tiêu đề hay đoạn văn nào. Bắt đầu viết ngay hoặc quay lại trang quản lý truyện."
                    action={
                      <>
                        <Button size="sm" onClick={() => setBlankKey(resourceKey)}>
                          <PenLine size={14} aria-hidden="true" />
                          Bắt đầu viết
                        </Button>
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
  );
}

function ChapterEditor({ chapter }) {
  const bodyRef = useRef(null);
  const [title, setTitle] = useState(chapter.title);
  const [body, setBody] = useState(chapter.body);
  const [saved, setSaved] = useState(true);
  const [caret, setCaret] = useState(0);
  const [utility, setUtility] = useState('ai');
  const [notes, setNotes] = useState('');
  const [groups, setGroups] = useState(chapter.groups);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submit, setSubmit] = useState('idle');
  const [suggested, setSuggested] = useState(false);
  const words = useMemo(() => countWords(body), [body]);
  const minutes = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  const paragraph = paragraphsOf(body.slice(0, caret)).length || 1;
  const line = body.slice(0, caret).split('\n').length;

  const updateBody = (value) => {
    setBody(value);
    setSaved(false);
  };
  const applyTool = (edit) => {
    const field = bodyRef.current;
    if (!field) return;
    const { selectionStart: start, selectionEnd: end } = field;
    const [before, inner, after] = edit(body.slice(start, end));
    updateBody(`${body.slice(0, start)}${before}${inner}${after}${body.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + inner.length);
      setCaret(start + before.length + inner.length);
    });
  };
  const addChapter = () =>
    setGroups((current) => {
      const last = current[current.length - 1];
      const number = Math.max(...last.chapters.map(([value]) => value)) + 1;
      return [
        ...current.slice(0, -1),
        {
          ...last,
          count: last.count + 1,
          chapters: [...last.chapters, [number, `Ch. ${number}: Chương chưa đặt tên`]],
        },
      ];
    });
  const sendForReview = () => {
    setSubmit('sending');
    window.setTimeout(() => {
      setSubmit('sent');
      setSaved(true);
    }, 900);
  };

  const tree = (
    <ChapterTree
      storyTitle={chapter.storyTitle}
      storyMeta={chapter.storyMeta}
      active={chapter.activeChapter}
      groups={groups}
      onAdd={addChapter}
    />
  );
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
      suggested={suggested}
      onSuggest={() => setSuggested(true)}
      onInsert={() => {
        updateBody(`${body}\n\n${SUGGESTION}`);
        setSuggested(false);
      }}
    />
  );

  return (
    <div className="flex min-h-[calc(100dvh-var(--app-header-h))] flex-col bg-reader">
      <EditorHeader
        story={
          <Link to={STORY_ROUTE} className="hover:text-brand-strong">
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
                  ? 'Đã lưu cục bộ'
                  : 'Có thay đổi chưa lưu'}
            </Badge>
            <Badge className="tabular-nums">{words.toLocaleString('vi-VN')} từ</Badge>
            <Badge className="hidden md:inline-flex">Đọc trong {minutes} phút</Badge>
          </>
        }
        onOpenLeft={() => setLeftOpen(true)}
        onOpenRight={() => setRightOpen(true)}
        onPreview={() => setPreviewOpen(true)}
        onSubmit={() => setSubmit('confirm')}
        submitDisabled={submit === 'sent'}
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
              {tools.map(([Icon, label, edit]) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyTool(edit)}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-ink/75 transition-[background-color,color,transform] duration-200 hover:bg-elevated hover:text-brand-strong active:scale-[0.96] pointer-coarse:size-11"
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
            <span className="hidden shrink-0 text-xs text-ink/70 tabular-nums lg:inline">
              Đoạn {paragraph} · Dòng {line}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSaved(true)}
              disabled={saved}
              className="shrink-0"
            >
              <Save size={14} aria-hidden="true" />
              Lưu
            </Button>
          </div>
          <article className="mx-auto max-w-[760px] px-5 py-10 sm:px-10 lg:py-14">
            <label htmlFor="chapter-title" className="sr-only">
              Tiêu đề chương
            </label>
            <textarea
              id="chapter-title"
              rows={1}
              value={title}
              maxLength={140}
              onChange={(event) => {
                setTitle(event.target.value.replace(/\n/g, ' '));
                setSaved(false);
              }}
              placeholder="Tiêu đề chương"
              className="w-full resize-none border-b border-transparent bg-transparent pb-3 text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink outline-none transition-colors [field-sizing:content] placeholder:text-muted hover:border-line focus:border-brand sm:text-4xl"
            />
            <label htmlFor="chapter-body" className="sr-only">
              Nội dung chương
            </label>
            <textarea
              id="chapter-body"
              ref={bodyRef}
              value={body}
              onChange={(event) => {
                updateBody(event.target.value);
                setCaret(event.target.selectionStart);
              }}
              onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
                  event.preventDefault();
                  setSaved(true);
                }
              }}
              placeholder="Bắt đầu viết chương của bạn…"
              className="mt-6 min-h-[60dvh] w-full resize-none rounded-2xl bg-transparent text-base leading-8 text-ink outline-none [field-sizing:content] placeholder:text-muted sm:text-lg sm:leading-9"
            />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5 text-sm text-muted">
              <span role="status" className="flex items-center gap-2">
                <Save size={14} aria-hidden="true" />
                {saved ? 'Bản nháp đã được lưu cục bộ và đồng bộ.' : 'Các thay đổi đang chờ lưu.'}
              </span>
              <ButtonLink
                to={chapterRoute(chapter.nextChapter)}
                variant="ghost"
                size="sm"
                trailingIcon={ChevronRight}
                className="text-brand-strong"
              >
                Tiếp tục đến Chương {chapter.nextChapter}
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

      <Modal
        open={previewOpen}
        title="Xem trước cho độc giả"
        onClose={() => setPreviewOpen(false)}
        className="max-w-2xl"
      >
        <article className="sm:rounded-2xl sm:bg-reader sm:p-8">
          <h3 className="text-h2">{title.trim() || 'Chương chưa đặt tên'}</h3>
          <div className="mt-5 space-y-5 text-base leading-8 text-ink">
            {paragraphsOf(body).map((part, index) =>
              part === SCENE_BREAK ? (
                <p key={index} aria-hidden="true" className="text-center tracking-[1em] text-muted">
                  ***
                </p>
              ) : (
                <p key={index}>{part}</p>
              ),
            )}
          </div>
        </article>
      </Modal>

      <Modal
        open={submit === 'confirm' || submit === 'sending'}
        title="Gửi chương"
        onClose={() => submit !== 'sending' && setSubmit('idle')}
      >
        <p className="text-sm leading-6 text-muted">
          <strong className="text-ink">{title.trim() || 'Chương chưa đặt tên'}</strong> (
          {words.toLocaleString('vi-VN')} từ) sẽ được thêm vào hàng đợi biên tập. Đây là bản xem
          trước giao diện; không có dữ liệu nào được gửi đi.
        </p>
        {words < TARGET_WORDS && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-orange/12 p-3 text-xs leading-5 text-ink">
            <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-strong" />
            Chương mới có {words.toLocaleString('vi-VN')} / {TARGET_WORDS.toLocaleString('vi-VN')}{' '}
            từ mục tiêu. Bạn vẫn có thể gửi để nhận góp ý sớm.
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => setSubmit('idle')}
            disabled={submit === 'sending'}
            className="w-full sm:w-auto"
          >
            Tiếp tục chỉnh sửa
          </Button>
          <Button
            onClick={sendForReview}
            disabled={submit === 'sending' || !title.trim()}
            className="w-full sm:w-auto"
          >
            <Check size={16} aria-hidden="true" />
            {submit === 'sending' ? 'Đang gửi...' : 'Gửi xét duyệt'}
          </Button>
        </div>
      </Modal>
    </div>
  );
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
}) {
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
        <div className="ml-auto flex items-center gap-2">
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
  );
}

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
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
  );
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
  );
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
  );
}

function WriterUtilitySkeleton() {
  return (
    <div className="space-y-5 p-5">
      {/* The tab rail is chrome: render it inert so its wrapped rows keep their real height. */}
      <div inert>
        <Tabs label="Tiện ích sáng tác" value="ai" onChange={() => {}} items={utilityTabs} />
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
  );
}

function EditorSheet({ open, side, title, onClose, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  const left = side === 'left';
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
  );
}

function ChapterTree({ storyTitle, storyMeta, active: activeChapter, groups, onAdd }) {
  return (
    <>
      <div className="border-b border-hairline pb-4">
        <strong className="text-base">{storyTitle}</strong>
        <p className="text-xs text-muted">{storyMeta}</p>
      </div>
      <div className="mt-5 space-y-6">
        {groups.map((group) => (
          <section key={group.act} aria-label={group.act}>
            <div className="flex items-start gap-2">
              <ChevronDown size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
              <strong className="flex-1 text-xs tracking-[.08em] text-brand-strong">
                {group.act}
              </strong>
              <span className="shrink-0 text-xs text-muted">{group.count} chương</span>
            </div>
            <ul className="mt-2 space-y-1 border-l border-hairline pl-3">
              {group.chapters.map(([number, label]) => {
                const active = number === activeChapter;
                return (
                  <li key={number}>
                    <Link
                      to={active ? EDITOR_ROUTE : chapterRoute(number)}
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
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <Button variant="outline" onClick={onAdd} className="mt-8 w-full">
        <Plus size={16} aria-hidden="true" />
        Thêm chương
      </Button>
    </>
  );
}

function WriterUtility({
  tab,
  setTab,
  body,
  title,
  words,
  saved,
  notes,
  setNotes,
  suggested,
  onSuggest,
  onInsert,
}) {
  return (
    <div className="space-y-5 p-5">
      <Tabs label="Tiện ích sáng tác" value={tab} onChange={setTab} items={utilityTabs} />
      {tab === 'ai' && (
        <>
          <Card className="bg-elevated p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="flex items-center gap-2 text-sm">
                <ListTree size={16} aria-hidden="true" className="text-purple" />
                Phân tích nhịp độ
              </strong>
              <Badge tone="green">Cân bằng tốt</Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Hình ảnh cảm giác (62%) và hội thoại (38%) được cân bằng tốt. Sức căng của cảnh tăng
              đều về phía thời điểm phát hiện dòng suối.
            </p>
          </Card>
          <Card className="border-purple/40 bg-purple/8 p-4">
            <strong className="flex items-center gap-2 text-sm text-purple-strong">
              <Sparkles size={16} aria-hidden="true" />
              Chuyển đoạn tiếp theo theo ngữ cảnh
            </strong>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              Gợi ý một nhịp nối không khí liền mạch khi Kaelen chuẩn bị giải mã các ký tự nước đang
              co lại.
            </p>
            <Button variant="tertiary" onClick={onSuggest} className="mt-4 w-full">
              <Sparkles size={16} aria-hidden="true" />
              Gợi ý đoạn tiếp theo
            </Button>
            {suggested && (
              <div className="nh-dialog-enter mt-4 rounded-2xl bg-surface p-4" role="status">
                <p className="text-xs text-muted">Phương án gợi ý:</p>
                <p className="mt-1 text-sm italic leading-6">“{SUGGESTION}”</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onInsert}
                  className="-ml-3 mt-2 px-3 text-purple-strong"
                >
                  <Plus size={14} aria-hidden="true" />
                  Chèn vào trình soạn thảo
                </Button>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <strong className="text-sm">Theo dõi tính nhất quán</strong>
            <p className="mt-3 flex items-baseline justify-between gap-2 text-sm font-semibold">
              Kaelen <span className="text-xs font-normal text-muted">Nhân vật chính</span>
            </p>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-muted">
              <li className="flex gap-2">
                <CheckCircle2 size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
                Vật phẩm hiện tại: la bàn thiên văn bằng đồng được theo dõi chính xác từ Chương 15.
              </li>
              <li className="flex gap-2">
                <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-orange-strong" />
                Tay phải bị thương ở Chương 12; hiện đang cầm dụng cụ.
              </li>
            </ul>
          </Card>
        </>
      )}
      {tab === 'outline' && <Outline body={body} />}
      {tab === 'notes' && (
        <div>
          <label htmlFor="chapter-notes" className="text-sm font-semibold">
            Ghi chú cho chương này
          </label>
          <textarea
            id="chapter-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ý tưởng, chi tiết cần nhớ, câu thoại muốn giữ lại..."
            className="mt-2 min-h-48 w-full resize-y rounded-3xl border border-line bg-surface p-4 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm"
          />
          <p className="mt-2 text-xs text-muted">
            Ghi chú chỉ hiển thị với bạn và được lưu cùng bản nháp.
          </p>
        </div>
      )}
      {tab === 'checklist' && <Checklist title={title} body={body} words={words} saved={saved} />}
    </div>
  );
}

function Outline({ body }) {
  const scenes = body
    .split(SCENE_BREAK)
    .map((part) => part.trim())
    .filter(Boolean);
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
  );
}

function Checklist({ title, body, words, saved }) {
  const checks = [
    ['Có tiêu đề chương', Boolean(title.trim())],
    ['Có ít nhất một dấu ngắt cảnh', body.includes(SCENE_BREAK)],
    [`Đạt ${TARGET_WORDS.toLocaleString('vi-VN')} từ mục tiêu`, words >= TARGET_WORDS],
    ['Mọi thay đổi đã được lưu', saved],
  ];
  return (
    <div>
      <p className="flex justify-between text-sm">
        <span>Tiến độ số từ</span>
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
  );
}
