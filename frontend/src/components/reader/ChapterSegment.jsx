import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BookOpen } from '../icons'
import { Button, EmptyState, ProgressBar, Skeleton } from '../ui'
import { useMockResource } from '../../context/MockDataContext'
import { READER_CHAPTER_TOTAL, readerChapter, readerChapterTitle } from './readerChapters'

/* Prose column of one chapter; the skeleton and error states reuse it so nothing shifts. */
const ARTICLE_CLASS =
  'mx-4 text-pretty sm:mx-6 sm:rounded-3xl sm:border sm:border-hairline sm:bg-surface sm:px-10 sm:py-12 sm:shadow-whisper lg:px-14'
/* Typical paragraph lengths (characters) and the average glyph width of Be Vietnam Pro (em). */
const SKELETON_PARAGRAPHS = [300, 380, 310, 290, 300]
const GLYPH_EM = 0.55
const hasNoProse = chapter => !chapter?.paragraphs?.length

/*
 * Chapter-shaped placeholder: same column, font metrics, line box and paragraph rhythm. Line
 * counts follow the measured column width, so the swap to real prose barely moves anything.
 */
export function ChapterSkeleton({ number, settings }) {
  const [columnWidth, setColumnWidth] = useState(0)
  const measure = useCallback(node => {
    if (!node) return
    const style = getComputedStyle(node)
    setColumnWidth(
      node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    )
  }, [])
  const lineBox = `${settings.fontSize * settings.lineHeight}px`
  const charsPerLine = columnWidth ? columnWidth / (settings.fontSize * GLYPH_EM) : 64
  return (
    <div
      ref={measure}
      aria-busy="true"
      className={ARTICLE_CLASS}
      style={{ fontFamily: settings.fontFamily, fontSize: `${settings.fontSize}px` }}
    >
      <span className="sr-only" role="status">
        Đang tải chương {number}…
      </span>
      {SKELETON_PARAGRAPHS.map((chars, paragraph) => {
        const lines = Math.max(1, Math.round(chars / charsPerLine))
        return (
          <span
            key={paragraph}
            aria-hidden="true"
            className="block"
            style={{
              marginBottom:
                paragraph === SKELETON_PARAGRAPHS.length - 1 ? 0 : `${settings.paragraphGap}px`,
            }}
          >
            {Array.from({ length: lines }, (_, line) => (
              <span key={line} className="flex items-center" style={{ height: lineBox }}>
                <Skeleton
                  className={`h-[0.62em] ${line === lines - 1 ? 'w-2/5' : line % 2 ? 'w-[94%]' : 'w-full'}`}
                />
              </span>
            ))}
          </span>
        )
      })}
    </div>
  )
}

/* Chapter heading inside the continuous stream: number, title and position in the story. */
function ChapterDivider({ number, headingId }) {
  const storyProgress = Math.round((number / READER_CHAPTER_TOTAL) * 100)
  return (
    <header className="mx-4 mb-6 pt-14 sm:mx-6 sm:mb-8 sm:pt-20">
      <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.16em] text-brand-strong">
        <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
        Chương {number} / {READER_CHAPTER_TOTAL}
        <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
      </p>
      <h2 id={headingId} className="mt-3 text-balance text-center text-h3 sm:text-h2">
        Chương {number}: {readerChapterTitle(number)}
      </h2>
      <div className="mx-auto mt-3 flex max-w-56 items-center gap-2">
        <ProgressBar value={storyProgress} size="sm" label={`Đã đi qua ${storyProgress}% truyện`} />
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink/70">
          {storyProgress}%
        </span>
      </div>
    </header>
  )
}

function ChapterFigure() {
  return (
    <figure className="mx-4 mb-6 overflow-hidden rounded-3xl border border-hairline bg-surface shadow-whisper sm:mx-6 sm:mb-8">
      <div
        className="grid aspect-[16/6] place-items-center bg-brand-soft"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 55% 70% at 50% 60%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 75%), radial-gradient(circle at 85% 18%, color-mix(in oklab, var(--accent-orange) 16%, transparent), transparent 40%), radial-gradient(circle at 12% 90%, color-mix(in oklab, var(--accent-purple) 10%, transparent), transparent 38%)',
        }}
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-surface/70 text-brand-strong shadow-whisper">
          <BookOpen size={30} aria-hidden="true" />
        </span>
      </div>
      <figcaption className="px-4 py-3 text-center text-caption text-muted">
        The sun filtering through the silvered elder canopy at dawn.
      </figcaption>
    </figure>
  )
}

/*
 * One chapter of the reading canvas: loads `chapter:<story>:<n>` through useMockResource and
 * renders skeleton / error / empty / prose. `placeholderHeight` unloads the prose of a far
 * chapter in the continuous stream while keeping its height, so the scroll position never jumps.
 */
export function ChapterSegment({
  storyId,
  number,
  settings,
  showFigure = false,
  divider = false,
  enter = null,
  placeholderHeight,
  renderParagraph,
  onStatus,
  onSelect,
}) {
  const chapterKey = `${storyId}-${number}`
  const headingId = `chapter-heading-${number}`
  const { status, data, retry } = useMockResource(
    `chapter:${storyId}:${number}`,
    readerChapter(number),
    { isEmpty: hasNoProse },
  )
  useEffect(() => {
    onStatus?.(number, status)
  }, [number, status, onStatus])

  if (placeholderHeight !== undefined) {
    return (
      <section
        data-chapter-segment={number}
        data-placeholder="true"
        aria-hidden="true"
        style={{ height: placeholderHeight }}
      />
    )
  }

  const title = readerChapterTitle(number)
  return (
    <section
      data-chapter-segment={number}
      aria-labelledby={divider ? headingId : undefined}
      aria-label={divider ? undefined : `Chương ${number}: ${title}`}
      className="scroll-mt-40"
    >
      {divider && <ChapterDivider number={number} headingId={headingId} />}
      {showFigure && <ChapterFigure />}
      {status === 'loading' && <ChapterSkeleton number={number} settings={settings} />}
      {status === 'error' && (
        <div className={ARTICLE_CLASS}>
          <EmptyState
            tone="rose"
            icon={AlertTriangle}
            headingAs="h3"
            title={`Không tải được chương ${number}`}
            description="Kết nối đang chập chờn. Nội dung chương vẫn an toàn, hãy thử tải lại."
            action={
              <Button variant="secondary" onClick={retry}>
                Thử lại
              </Button>
            }
          />
        </div>
      )}
      {status === 'empty' && (
        <div className={ARTICLE_CLASS}>
          <EmptyState
            icon={BookOpen}
            headingAs="h3"
            title={`Chương ${number} chưa có nội dung`}
            description="Tác giả đang hoàn thiện chương này. Bạn có thể đọc chương khác trong danh sách."
          />
        </div>
      )}
      {status === 'ready' && (
        <article
          data-chapter-article
          data-chapter-key={chapterKey}
          aria-label={`Chương ${number}: ${data.title}`}
          onMouseUp={onSelect}
          onKeyUp={onSelect}
          className={`${ARTICLE_CLASS} ${enter ? `nh-chapter-enter-${enter}` : ''}`}
          style={{
            fontFamily: settings.fontFamily,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            textAlign: settings.align,
          }}
        >
          {data.paragraphs.map((paragraph, index) => (
            <p
              data-paragraph={index}
              key={paragraph.slice(0, 24)}
              style={{
                marginBottom:
                  index === data.paragraphs.length - 1 ? 0 : `${settings.paragraphGap}px`,
              }}
              className={
                index === 0
                  ? 'first-letter:float-left first-letter:mr-2.5 first-letter:mt-1 first-letter:text-[3.4em] first-letter:font-semibold first-letter:leading-[.8] first-letter:text-brand'
                  : ''
              }
            >
              {renderParagraph(paragraph, index, chapterKey)}
            </p>
          ))}
        </article>
      )}
    </section>
  )
}
