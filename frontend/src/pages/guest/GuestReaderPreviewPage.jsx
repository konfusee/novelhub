import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  AlignJustify,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageCircle,
  Moon,
  Sun,
} from '../../components/icons';
import { Link, useNavigate, useParams } from 'react-router';
import { useTheme } from '../../context/ThemeContext';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Select,
  Skeleton,
} from '../../components/ui';
import { chapterPreview, previewParagraphs } from '../../data/mock/reader';

const segment =
  'inline-flex min-h-8 items-center justify-center rounded-full px-2.5 text-xs font-semibold transition-[background-color,color] duration-200 ease-spring hover:bg-surface disabled:opacity-40';
const chromeLink =
  'grid size-11 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-spring hover:bg-elevated active:scale-[0.96]';
/* Guests may read the free chapters only; any other chapter id falls back to chapter 1. */
const previewNumberFrom = (chapterId) => {
  const parsed = Number(chapterId?.match(/\d+/)?.[0]);
  return chapterPreview.some((item) => item.number === parsed && item.free) ? parsed : 1;
};
const SKELETON_LINES = [4, 4, 4, 1, 4];

export function GuestReaderPreviewPage() {
  const navigate = useNavigate();
  const { storyId = 'demo', chapterId } = useParams();
  const number = previewNumberFrom(chapterId);
  const chapter = chapterPreview.find((item) => item.number === number);
  const nextChapter = chapterPreview.find((item) => item.number === number + 1);
  const { resolvedTheme, setTheme } = useTheme();
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(2);
  const [contentWidth, setContentWidth] = useState(760);
  const [bookmarked, setBookmarked] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  /* Direction of the last chapter switch drives the enter animation. */
  const [shown, setShown] = useState({ number, direction: null });
  if (shown.number !== number) {
    setShown({ number, direction: number > shown.number ? 'next' : 'prev' });
  }
  const {
    status,
    data: paragraphs,
    retry,
  } = useMockResource(`preview:${storyId}:${number}`, previewParagraphs);
  const endRef = useRef(null);
  useEffect(() => {
    const node = endRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setAtEnd(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const previewHref = (target) => `/stories/${storyId}/preview/chapter-${target}`;
  const readHref = (target) => `/read/${storyId}/chapter-${target}`;
  const openChapter = (value) => {
    const target = chapterPreview.find((item) => item.number === Number(value));
    if (!target || target.number === number) return;
    if (target.free) navigate(previewHref(target.number));
    else navigate('/login', { state: { from: readHref(target.number) } });
  };
  const enter = shown.direction ? `nh-chapter-enter-${shown.direction}` : undefined;
  return (
    <div className="min-h-screen bg-reader text-ink">
      <div className="fixed inset-x-0 top-0 z-40 h-1 bg-orange" />
      <header className="sticky top-1 z-30 border-b border-hairline bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-2 px-4 sm:gap-3 md:px-8">
          <Link
            to="/stories/demo"
            aria-label="Quay lại The Silent Forest"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink lg:justify-start lg:pr-2"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="hidden lg:inline">The Silent Forest</span>
          </Link>
          <div className="mx-auto min-w-0 max-w-sm flex-1">
            <Select
              aria-label="Chọn chương"
              value={String(number)}
              onChange={(event) => openChapter(event.target.value)}
              className="w-full text-sm"
            >
              {chapterPreview.map((item) => (
                <option key={item.number} value={item.number}>
                  Chương {item.number}: {item.title}
                  {item.free ? '' : ' (đã khóa)'}
                </option>
              ))}
            </Select>
          </div>
          <div className="hidden items-center rounded-full border border-hairline bg-elevated p-1 sm:flex">
            <button
              type="button"
              aria-label="Giảm cỡ chữ"
              disabled={fontSize <= 14}
              onClick={() => setFontSize(Math.max(14, fontSize - 1))}
              className={segment}
            >
              Aa−
            </button>
            <span className="min-w-7 text-center text-xs font-semibold tabular-nums text-brand-strong">
              {fontSize}
            </span>
            <button
              type="button"
              aria-label="Tăng cỡ chữ"
              disabled={fontSize >= 22}
              onClick={() => setFontSize(Math.min(22, fontSize + 1))}
              className={segment}
            >
              Aa+
            </button>
          </div>
          <label className="hidden items-center gap-2 rounded-full border border-hairline bg-elevated px-3 py-2 xl:flex">
            <span className="text-xs font-semibold text-ink/70">Độ rộng</span>
            <input
              aria-label="Độ rộng cột đọc"
              type="range"
              min="600"
              max="960"
              step="20"
              value={contentWidth}
              onChange={(event) => setContentWidth(Number(event.target.value))}
              className="w-24 accent-[var(--primary)]"
            />
            <span className="w-8 text-right text-xs font-semibold tabular-nums text-brand-strong">
              {contentWidth}
            </span>
          </label>
          <span className="hidden lg:contents">
            <IconButton
              label="Giãn dòng"
              shape="circle"
              size="sm"
              aria-pressed={lineHeight !== 2}
              onClick={() => setLineHeight(lineHeight === 2 ? 2.3 : 2)}
            >
              <AlignJustify size={16} />
            </IconButton>
          </span>
          <span className="hidden sm:contents">
            <IconButton
              label="Chuyển giao diện"
              shape="circle"
              size="sm"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </IconButton>
          </span>
          <Link
            to="/login"
            className="hidden shrink-0 rounded-full px-2 py-2 text-sm font-semibold transition-colors duration-200 hover:text-brand-strong md:block"
          >
            Đăng nhập
          </Link>
          <ButtonLink to="/register" size="sm" className="shrink-0 gap-0">
            Tham gia<span className="hidden sm:inline">&nbsp;miễn phí</span>
          </ButtonLink>
        </div>
      </header>
      <main className="mx-auto w-full px-5 pb-36 pt-12 sm:px-6" style={{ maxWidth: contentWidth }}>
        <article key={number} className={enter}>
          <header className="mb-10 border-b border-hairline pb-8 text-center">
            <Badge tone="green">Đọc thử miễn phí</Badge>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-ink/70">
              The Silent Forest · Mira Lane
            </p>
            <h1 className="mt-3 text-h1 text-balance md:text-4xl">
              Chương {number}: {chapter.title}
            </h1>
            <p className="mt-3 text-sm text-ink/70">
              Phát hành 12 thg 9, 2026 ·{' '}
              {chapter.meta.match(/([\d,]+) words/)?.[1].replace(',', '.')} từ · đọc trong{' '}
              {chapter.meta.match(/(\d+) min/)?.[1]} phút
            </p>
          </header>
          {status === 'loading' && (
            <div aria-busy="true" className="space-y-6" style={{ fontSize, lineHeight }}>
              <span className="sr-only" role="status">
                Đang tải chương {number}…
              </span>
              {SKELETON_LINES.map((lines, paragraph) => (
                <span key={paragraph} aria-hidden="true" className="block">
                  {Array.from({ length: lines }, (_, line) => (
                    <span key={line} className="flex items-center" style={{ height: '1lh' }}>
                      <Skeleton
                        className={`h-[0.62em] ${line === lines - 1 ? 'w-3/5' : 'w-full'} ${lines === 1 ? 'mx-auto' : ''}`}
                      />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          )}
          {status === 'error' && (
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={`Không tải được chương ${number}`}
              description="Kết nối đang chập chờn. Hãy thử tải lại chương đọc thử."
              action={
                <Button variant="secondary" onClick={retry}>
                  Thử lại
                </Button>
              }
            />
          )}
          {status === 'empty' && (
            <EmptyState
              icon={Lock}
              title={`Chương ${number} chưa có bản đọc thử`}
              description="Đăng nhập để đọc toàn bộ truyện trong thư viện của bạn."
            />
          )}
          {status === 'ready' && (
            <div className="space-y-6" style={{ fontSize, lineHeight }}>
              {paragraphs.map((paragraph, index) => (
                <p
                  className={
                    index === 3
                      ? 'border-y border-hairline py-6 text-center font-medium italic text-brand-strong'
                      : ''
                  }
                  key={paragraph}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </article>
        <Card bezel className="mt-16" innerClassName="overflow-hidden p-0">
          <div className="border-b border-hairline bg-elevated p-6 text-center sm:p-10">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
              <Lock size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-h3 sm:text-h2">Câu chuyện tiếp tục ở Chương {number + 1}</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink/70">
              Tham gia cùng hơn 3.000.000 độc giả NovelHub. Tạo tài khoản miễn phí trong 30 giây để
              tiếp tục đọc và mở khóa thư viện cá nhân.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink to="/register" size="lg" trailingIcon={ArrowRight}>
                Tạo tài khoản miễn phí
              </ButtonLink>
              <ButtonLink
                to="/login"
                state={{ from: readHref(number + 1) }}
                size="lg"
                variant="secondary"
              >
                Đăng nhập
              </ButtonLink>
            </div>
          </div>
          <ul className="nh-grid-12 grid gap-3 p-5 text-sm sm:px-8 nh-sm-cols-3">
            {['Đồng bộ tiến độ đọc', 'Đánh dấu yêu thích', 'Tham gia thảo luận'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/12 text-brand-strong">
                  <Check size={12} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
        <div ref={endRef} aria-hidden="true" className="h-px" />
      </main>
      <nav
        aria-label="Điều hướng chương"
        inert={atEnd}
        className={`fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center justify-between gap-1.5 rounded-full border border-hairline bg-surface/85 px-2 py-2 shadow-float backdrop-blur-md transition-[transform,opacity] duration-[420ms] ease-spring sm:gap-2 ${atEnd ? 'pointer-events-none translate-y-6 opacity-0' : ''}`}
      >
        <IconButton
          label="Chương trước"
          shape="circle"
          size="sm"
          disabled={number <= 1}
          onClick={() => openChapter(number - 1)}
        >
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton
          label="Đánh dấu chương"
          tone="purple"
          shape="circle"
          size="sm"
          aria-pressed={bookmarked}
          onClick={() => setBookmarked(!bookmarked)}
        >
          <Bookmark size={16} className={bookmarked ? 'fill-current' : ''} />
        </IconButton>
        {/* Below 360px the header Select already names the chapter; the label would squeeze the targets. */}
        <div className="shrink-0 text-center max-[359px]:hidden">
          <span className="block whitespace-nowrap text-xs font-semibold">Chương {number}</span>
          <span className="hidden whitespace-nowrap text-xs text-brand-strong sm:block">
            Đã hoàn thành 100%
          </span>
        </div>
        <Link
          to="/login"
          state={{ from: readHref(number) }}
          aria-label="Bình luận (cần đăng nhập)"
          className={chromeLink}
        >
          <MessageCircle size={17} aria-hidden="true" />
        </Link>
        {nextChapter?.free ? (
          <Link
            to={previewHref(nextChapter.number)}
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold transition-[border-color,transform] duration-200 ease-spring hover:border-brand active:scale-[0.98]"
          >
            Chương {nextChapter.number}
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        ) : (
          <Link
            to="/login"
            state={{ from: readHref(number + 1) }}
            aria-label={`Chương ${number + 1} (cần đăng nhập)`}
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold transition-[border-color,transform] duration-200 ease-spring hover:border-brand active:scale-[0.98]"
          >
            Chương {number + 1} <Lock size={12} aria-hidden="true" />
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </div>
  );
}
