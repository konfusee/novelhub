import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { AlertTriangle, BookOpen, LockKeyhole, UserRound } from '../icons'
import { Button, ButtonLink, EmptyState, ProgressBar, Skeleton } from '../ui'
import { PublishedChapterImage } from '../story/PrivateChapterImage'
import { apiRequest } from '../../api/client'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'
import { chapterLabel } from './chapterLabel'
import { ChapterUnlock } from './ChapterUnlock'
import { blockText } from './readingPoint'

/* Prose column of one chapter; the skeleton and error states reuse it so nothing shifts. */
const ARTICLE_CLASS =
  'mx-4 text-pretty sm:mx-6 sm:rounded-3xl sm:border sm:border-hairline sm:bg-surface sm:px-10 sm:py-12 sm:shadow-whisper lg:px-14'
/* Typical paragraph lengths (characters) and the average glyph width of Be Vietnam Pro (em). */
const SKELETON_PARAGRAPHS = [300, 380, 310, 290, 300]
const GLYPH_EM = 0.55
const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'quote'])
const SCENE_BREAK = '*     *     *'

/* API error → segment state. Locked previews never carry chapter text. */
const failureStatus = error =>
  error?.status === 401
    ? 'login'
    : error?.status === 403 && error.code === 'chapter_locked'
      ? 'locked'
      : error?.status === 404 || error?.status === 400
        ? 'missing'
        : 'error'

/*
 * Chapter-shaped placeholder: same column, font metrics, line box and paragraph rhythm. Line
 * counts follow the measured column width, so the swap to real prose barely moves anything.
 */
export function ChapterSkeleton({ settings }) {
  const { t } = useLocale()
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
        {t('reader.loadingChapter')}
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
function ChapterDivider({ info, total, headingId }) {
  const { t } = useLocale()
  const storyProgress =
    total && info?.orderKey ? Math.min(100, Math.round((info.orderKey / total) * 100)) : null
  return (
    <header className="mx-4 mb-6 pt-14 sm:mx-6 sm:mb-8 sm:pt-20">
      {info?.orderKey && total ? (
        <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[.16em] text-brand-strong">
          <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
          {t('reader.chapterOfTotal', { number: info.orderKey, total })}
          <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
        </p>
      ) : (
        <span aria-hidden="true" className="block h-px bg-hairline" />
      )}
      <h2 id={headingId} className="mt-3 text-balance text-center text-h3 sm:text-h2">
        {chapterLabel(t, info)}
      </h2>
      {storyProgress !== null && (
        <div className="mx-auto mt-3 flex max-w-56 items-center gap-2">
          <ProgressBar
            value={storyProgress}
            size="sm"
            label={t('reader.storyProgress', { percent: storyProgress })}
          />
          <span className="shrink-0 text-xs font-semibold tabular-nums text-ink/70">
            {storyProgress}%
          </span>
        </div>
      )}
    </header>
  )
}

/* Locked, signed-out and missing chapters: a title plus what the reader can do next. */
function ChapterNotice({ status, info, storyId, onRetry, chapterId }) {
  const { t } = useLocale()
  const location = useLocation()
  const storyLink = (
    <ButtonLink variant="secondary" size="sm" to={ROUTES.story(storyId)}>
      {t('reader.backToStory')}
    </ButtonLink>
  )
  const notices = {
    locked: {
      icon: LockKeyhole,
      title: t('reader.lockedTitle', { chapter: chapterLabel(t, info) }),
      description: t('reader.lockedDescription'),
      action: (
        <ChapterUnlock
          key={`${storyId}:${chapterId}`}
          storyId={storyId}
          chapterId={chapterId}
          onUnlocked={onRetry}
        />
      ),
    },
    login: {
      icon: UserRound,
      title: t('reader.loginTitle'),
      description: t('reader.loginDescription'),
      action: (
        <ButtonLink
          size="sm"
          to={ROUTES.login}
          state={{ from: location.pathname + location.search }}
        >
          {t('reader.login')}
        </ButtonLink>
      ),
    },
    missing: {
      icon: BookOpen,
      title: t('reader.missingTitle'),
      description: t('reader.missingDescription'),
      action: storyLink,
    },
    empty: {
      icon: BookOpen,
      title: t('reader.emptyTitle'),
      description: t('reader.emptyDescription'),
      action: storyLink,
    },
    error: {
      icon: AlertTriangle,
      tone: 'rose',
      title: t('reader.errorTitle'),
      description: t('reader.errorDescription'),
      action: (
        <Button variant="secondary" onClick={onRetry}>
          {t('reader.retry')}
        </Button>
      ),
    },
  }
  const notice = notices[status]
  return (
    <div className={ARTICLE_CLASS} data-chapter-notice={status}>
      <EmptyState
        tone={notice.tone}
        icon={notice.icon}
        headingAs="h3"
        title={notice.title}
        description={notice.description}
        action={notice.action}
      />
    </div>
  )
}

/*
 * One chapter of the reading canvas: loads `GET /catalog/stories/:story/chapters/:chapter` and
 * renders skeleton / locked / login / missing / error / prose. `placeholderHeight` unloads the
 * prose of a far chapter in the continuous stream while keeping its height, so the scroll
 * position never jumps. `info` ({ orderKey, title }) labels the chapter before it loads.
 */
export function ChapterSegment({
  storyId,
  chapterId,
  info,
  total,
  settings,
  divider = false,
  enter = null,
  placeholderHeight,
  renderParagraph,
  onStatus,
  onSelect,
}) {
  const { t } = useLocale()
  const headingId = `chapter-heading-${chapterId}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ attempt: -1, status: 'loading', chapter: null })
  useEffect(() => {
    const controller = new AbortController()
    apiRequest(
      `/catalog/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}`,
      { signal: controller.signal },
    )
      .then(({ chapter }) => {
        if (controller.signal.aborted) return
        setState({ attempt, status: chapter.blocks?.length ? 'ready' : 'empty', chapter })
      })
      .catch(error => {
        if (!controller.signal.aborted)
          setState({ attempt, status: failureStatus(error), chapter: null })
      })
    return () => controller.abort()
  }, [storyId, chapterId, attempt])
  const { status, chapter } = state.attempt === attempt ? state : { status: 'loading' }
  useEffect(() => {
    onStatus?.(chapterId, status, chapter ?? null)
  }, [chapterId, status, chapter, onStatus])

  if (placeholderHeight !== undefined) {
    return (
      <section
        data-chapter-segment={chapterId}
        data-placeholder="true"
        aria-hidden="true"
        style={{ height: placeholderHeight }}
      />
    )
  }

  const label = chapterLabel(t, chapter ? { ...info, ...chapter } : info)
  const chapterKey = `${storyId}-${chapter?.id ?? chapterId}`
  const target = chapter && {
    storyId: chapter.story?.id ?? storyId,
    chapterId: chapter.id,
    revisionId: chapter.revisionId,
  }
  const firstText = chapter?.blocks.findIndex(block => block.type === 'paragraph')
  return (
    <section
      data-chapter-segment={chapterId}
      aria-labelledby={divider ? headingId : undefined}
      aria-label={divider ? undefined : label}
      className="scroll-mt-40"
    >
      {divider && (
        <ChapterDivider
          info={chapter ? { ...info, ...chapter } : info}
          total={total}
          headingId={headingId}
        />
      )}
      {status === 'loading' && <ChapterSkeleton settings={settings} />}
      {status !== 'loading' && status !== 'ready' && (
        <ChapterNotice
          status={status}
          info={info}
          storyId={storyId}
          chapterId={chapterId}
          onRetry={() => setAttempt(value => value + 1)}
        />
      )}
      {status === 'ready' && (
        <article
          data-chapter-article
          data-chapter-key={chapterKey}
          data-chapter-id={chapter.id}
          aria-label={label}
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
          {chapter.blocks.map((block, index) => {
            const gap = {
              marginBottom: index === chapter.blocks.length - 1 ? 0 : `${settings.paragraphGap}px`,
            }
            if (block.type === 'image')
              return <PublishedChapterImage key={index} block={block} target={target} />
            const text = blockText(block)
            if (block.type === 'scene-break' || text.trim() === SCENE_BREAK)
              return <hr key={index} className="my-8 border-hairline" />
            if (!TEXT_BLOCKS.has(block.type)) return null
            const content = renderParagraph({ text, inlines: block.inlines }, index, chapterKey)
            if (block.type === 'heading') {
              const Heading = block.level === 2 ? 'h3' : 'h4'
              return (
                <Heading key={index} data-paragraph={index} style={gap} className="font-bold">
                  {content}
                </Heading>
              )
            }
            if (block.type === 'quote')
              return (
                <blockquote
                  key={index}
                  data-paragraph={index}
                  style={gap}
                  className="border-l-2 border-brand pl-4 italic"
                >
                  {content}
                </blockquote>
              )
            return (
              <p
                key={index}
                data-paragraph={index}
                style={gap}
                className={`whitespace-pre-wrap break-words ${
                  index === firstText
                    ? 'first-letter:float-left first-letter:mr-2.5 first-letter:mt-1 first-letter:text-[3.4em] first-letter:font-semibold first-letter:leading-[.8] first-letter:text-brand'
                    : ''
                }`}
              >
                {content}
              </p>
            )
          })}
        </article>
      )}
    </section>
  )
}
