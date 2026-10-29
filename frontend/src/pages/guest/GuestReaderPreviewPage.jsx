import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  Moon,
  Sun,
} from '../../components/icons'
import { useBackendDocument } from '../../api/useBackendResource'
import { useStoryDetail } from '../../components/public/catalog'
import { ChapterInlineText } from '../../components/reader/ChapterInlineText'
import { PublishedChapterImage } from '../../components/story/PrivateChapterImage'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
} from '../../components/ui'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { useTheme } from '../../context/ThemeContext'

const segment =
  'inline-flex min-h-8 items-center justify-center rounded-full px-2.5 text-xs font-semibold transition-[background-color,color] duration-200 ease-spring hover:bg-surface disabled:opacity-40'
const SKELETON_LINES = [4, 4, 4, 1, 4]
const unwrapChapter = response => response?.chapter ?? null

/** Plain paragraphs (`blocks-v1`) carry `text`; rich blocks carry `inlines`. */
const inlinesOf = block => block.inlines ?? [{ text: block.text ?? '', marks: [] }]

function ChapterBlocks({ chapter, storyId }) {
  const target = { storyId, chapterId: chapter.id, revisionId: chapter.revisionId }
  return chapter.blocks.map((block, index) => {
    if (block.type === 'image')
      return <PublishedChapterImage key={index} block={block} target={target} />
    const inlines = inlinesOf(block)
    if (
      block.type === 'scene-break' ||
      (block.type === 'paragraph' &&
        inlines
          .map(item => item.text)
          .join('')
          .trim() === '*     *     *')
    )
      return <hr key={index} className="my-8 border-hairline" />
    const className = 'whitespace-pre-wrap break-words'
    const text = <ChapterInlineText inlines={inlines} />
    if (block.type === 'heading') {
      const Heading = block.level === 2 ? 'h2' : 'h3'
      return (
        <Heading key={index} className={`${className} font-bold`}>
          {text}
        </Heading>
      )
    }
    if (block.type === 'quote')
      return (
        <blockquote key={index} className={`${className} border-l-2 border-brand pl-4 italic`}>
          {text}
        </blockquote>
      )
    return (
      <p key={index} className={className}>
        {text}
      </p>
    )
  })
}

/** Locked preview: chapter title plus the sign-in / unlock prompt, never chapter text. */
function LockedPrompt({ title, reason, readHref, isAuthenticated }) {
  const { t } = useLocale()
  const locked = reason === 'chapter_locked'
  return (
    <Card bezel innerClassName="overflow-hidden p-0">
      <div className="bg-elevated p-6 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
          <Lock size={22} aria-hidden="true" />
        </span>
        {title && <h1 className="mt-5 text-h3 sm:text-h2">{title}</h1>}
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-ink/70">
          {t(locked ? 'storyDetail.previewLockedEarly' : 'storyDetail.previewLoginRequired')}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <ButtonLink to={readHref} size="lg" trailingIcon={ArrowRight}>
              {t('story.unlock')}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink
                to={ROUTES.login}
                state={{ from: readHref }}
                size="lg"
                trailingIcon={ArrowRight}
              >
                {t('auth.signIn')}
              </ButtonLink>
              <ButtonLink to={ROUTES.register} size="lg" variant="secondary">
                {t('home.createAccount')}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

export function GuestReaderPreviewPage() {
  const { t } = useLocale()
  const { isAuthenticated } = useAuth()
  const { storyId, chapterId } = useParams()
  const { resolvedTheme, setTheme } = useTheme()
  const [fontSize, setFontSize] = useState(18)
  const story = useStoryDetail(storyId)
  const chapter = useBackendDocument(
    `/catalog/stories/${encodeURIComponent(storyId)}/chapters/${encodeURIComponent(chapterId)}`,
    null,
  )
  const loaded = chapter.status === 'ready' ? unwrapChapter(chapter.data) : null
  const listed = story.data?.chapters ?? []
  const listIndex = listed.findIndex(item => item.id === chapterId)
  const listedTitle = listIndex >= 0 ? listed[listIndex].title : ''
  const storyTitle = loaded?.story?.title ?? story.data?.story?.title ?? ''
  const storyAuthor = loaded?.story?.author ?? story.data?.story?.author ?? ''
  const number = listIndex >= 0 ? listIndex + 1 : null
  const readHref = ROUTES.read(storyId, chapterId)
  const lockCode =
    chapter.status === 'error' && [401, 403].includes(chapter.error?.status)
      ? chapter.error.code
      : null
  const neighbourHref = neighbour =>
    !isAuthenticated && listed[0]?.id !== neighbour.id
      ? { to: ROUTES.login, state: { from: ROUTES.read(storyId, neighbour.id) } }
      : {
          to: isAuthenticated
            ? ROUTES.read(storyId, neighbour.id)
            : `/stories/${storyId}/preview/${neighbour.id}`,
        }
  return (
    <div className="min-h-screen bg-reader text-ink">
      <header className="sticky top-0 z-30 border-b border-hairline bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-2 px-4 sm:gap-3 md:px-8">
          <Link
            to={ROUTES.story(storyId)}
            aria-label={t('storyDetail.backToStory', { title: storyTitle })}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink lg:justify-start lg:pr-2"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="hidden max-w-xs truncate lg:inline">{storyTitle}</span>
          </Link>
          <div className="ml-auto hidden items-center rounded-full border border-hairline bg-elevated p-1 sm:flex">
            <button
              type="button"
              aria-label={`${t('reader.fontSize')} −`}
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
              aria-label={`${t('reader.fontSize')} +`}
              disabled={fontSize >= 22}
              onClick={() => setFontSize(Math.min(22, fontSize + 1))}
              className={segment}
            >
              Aa+
            </button>
          </div>
          <IconButton
            label={t('storyDetail.toggleTheme')}
            shape="circle"
            size="sm"
            className="ml-auto sm:ml-0"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconButton>
          {!isAuthenticated && (
            <ButtonLink to={ROUTES.login} state={{ from: readHref }} size="sm" className="shrink-0">
              {t('auth.signIn')}
            </ButtonLink>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[760px] px-5 pb-24 pt-12 sm:px-6">
        {chapter.status === 'loading' && (
          <div aria-busy="true" className="space-y-6" style={{ fontSize, lineHeight: 2 }}>
            <span className="sr-only" role="status">
              {t('storyDetail.previewLoading')}
            </span>
            {SKELETON_LINES.map((lines, paragraph) => (
              <span key={paragraph} aria-hidden="true" className="block">
                {Array.from({ length: lines }, (_, line) => (
                  <span key={line} className="flex items-center" style={{ height: '1lh' }}>
                    <Skeleton className={`h-[0.62em] ${line === lines - 1 ? 'w-3/5' : 'w-full'}`} />
                  </span>
                ))}
              </span>
            ))}
          </div>
        )}
        {lockCode && (
          <LockedPrompt
            title={listedTitle}
            reason={lockCode}
            readHref={readHref}
            isAuthenticated={isAuthenticated}
          />
        )}
        {chapter.status === 'error' && !lockCode && (
          <EmptyState
            tone="rose"
            icon={AlertTriangle}
            title={t('storyDetail.previewFailed')}
            description={chapter.error?.message}
            action={
              <Button variant="secondary" onClick={chapter.retry}>
                {t('search.retry')}
              </Button>
            }
          />
        )}
        {chapter.status === 'empty' && (
          <EmptyState
            icon={Lock}
            title={t('storyDetail.previewMissing')}
            action={
              <ButtonLink to={ROUTES.story(storyId)} variant="secondary">
                {t('storyDetail.backToStory', { title: storyTitle })}
              </ButtonLink>
            }
          />
        )}
        {loaded && (
          <article>
            <header className="mb-10 border-b border-hairline pb-8 text-center">
              {!isAuthenticated && <Badge tone="green">{t('story.freePreview')}</Badge>}
              {(storyTitle || storyAuthor) && (
                <p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-ink/70">
                  {[storyTitle, storyAuthor].filter(Boolean).join(' · ')}
                </p>
              )}
              <h1 className="mt-3 text-h1 text-balance md:text-4xl">
                {number ? `${t('story.chapterNumber', { number })}: ` : ''}
                {loaded.title}
              </h1>
            </header>
            <div className="space-y-6" style={{ fontSize, lineHeight: 2 }}>
              <ChapterBlocks chapter={loaded} storyId={storyId} />
            </div>
            <nav
              aria-label={t('storyDetail.chapterNavigation')}
              className="mt-16 flex items-center justify-between gap-3"
            >
              {loaded.prev ? (
                <Link
                  {...neighbourHref(loaded.prev)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand"
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                  {t('storyDetail.previousChapter')}
                </Link>
              ) : (
                <span />
              )}
              {loaded.next && (
                <Link
                  {...neighbourHref(loaded.next)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-brand"
                >
                  {t('storyDetail.nextChapter')}
                  {(loaded.next.locked || !isAuthenticated) && (
                    <Lock size={12} aria-hidden="true" />
                  )}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              )}
            </nav>
            {!isAuthenticated && loaded.next && (
              <div className="mt-10">
                <LockedPrompt
                  title={loaded.next.title}
                  readHref={ROUTES.read(storyId, loaded.next.id)}
                />
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  )
}
