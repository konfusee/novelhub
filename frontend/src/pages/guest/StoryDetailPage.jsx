import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Flag,
  Headphones,
  RefreshCw,
  Search,
  Share2,
  Star,
} from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { ChapterList } from '../../components/public/ChapterList'
import { useStoryDetail } from '../../components/public/catalog'
import { API_BASE } from '../../api/client'
import { FollowButton } from '../../components/community/FollowButton'
import { ReportDialog } from '../../components/community/ReportDialog'
import { Pagination } from '../../components/ui/Pagination'
import { StoryCommunity } from '../../components/story/StoryCommunity'
import { StoryCover } from '../../components/story/StoryCover'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  Reveal,
  Skeleton,
  SkeletonText,
  Tabs,
} from '../../components/ui'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'

const tabs = [
  ['chapters', 'storyDetail.chapters'],
  ['synopsis', 'storyDetail.synopsis'],
  ['reviews', 'storyDetail.reviews'],
]
const CHAPTER_PAGE_SIZE = 10
const initials = name =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')

function RetryButton({ onClick }) {
  const { t } = useLocale()
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      {t('search.retry')}
    </Button>
  )
}

/* Hero placeholder on the same bezel grid: 2:3 cover, display title, meta strip, actions. */
function StoryHeroSkeleton({ note }) {
  return (
    <Card
      bezel
      aria-busy="true"
      aria-label="Đang tải thông tin truyện"
      className="-mt-4"
      innerClassName="nh-grid-12 grid gap-y-8 p-5 sm:p-8 lg:p-10 nh-layout-lg-3-9"
    >
      <Skeleton className="mx-auto aspect-[2/3] w-full max-w-44 self-start rounded-2xl sm:max-w-56 lg:max-w-none [@media(max-height:500px)]:max-w-36" />
      <div aria-hidden="true" className="min-w-0 lg:pl-4">
        <span className="flex h-[1.08em] items-center text-display">
          <Skeleton className="h-[0.72em] w-3/4" />
        </span>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Skeleton className="size-9" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="mt-6 grid grid-cols-2 items-center gap-x-4 gap-y-3 border-y border-hairline py-4 sm:flex sm:flex-wrap sm:gap-x-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="col-span-2 h-6 w-32 max-sm:order-1" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        {/* 4 clamped lines + "Xem thêm" on phones, 5 at the desktop column width (line box = leading-7). */}
        <span className="mt-5 flex max-w-[68ch] flex-col gap-4 py-2">
          {Array.from({ length: 5 }, (_, line) => (
            <Skeleton
              key={line}
              className={`h-3 ${line === 4 ? 'w-2/5 max-lg:hidden' : line === 3 ? 'w-3/4 lg:w-full' : 'w-full'}`}
            />
          ))}
        </span>
        <Skeleton className="mt-2 h-4 w-16 lg:hidden" />
        <div className="mt-5 flex flex-wrap items-center gap-3 lg:mt-7">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-12 w-40" />
          <Skeleton className="size-12 rounded-2xl" />
          <Skeleton className="size-12 rounded-2xl" />
        </div>
        <p className="mt-3 min-h-5" />
        {note}
      </div>
    </Card>
  )
}

/* Author + community rating cards at their final heights. */
function StoryAsideSkeleton() {
  return (
    <aside aria-busy="true" aria-label="Đang tải tác giả và đánh giá" className="space-y-5">
      <Card as="div" aria-hidden="true">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <span className="mt-4 flex flex-col gap-3 py-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </span>
        <div className="mt-4 grid grid-cols-3 border-y border-hairline py-3">
          {[0, 1, 2].map(item => (
            <span key={item} className="flex flex-col items-center gap-2 py-0.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3 w-14" />
            </span>
          ))}
        </div>
        <Skeleton className="mt-4 h-11 w-full" />
      </Card>
      <Card as="div" aria-hidden="true">
        <div className="flex h-9 items-center justify-between gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mt-5 flex gap-5">
          <div className="flex w-20 shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-9 w-14 rounded-2xl" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map(value => (
              <span key={value} className="flex h-4 items-center gap-2">
                <Skeleton className="h-2.5 w-6" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-2.5 w-8" />
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 border-t border-hairline pt-4">
          <Skeleton className="h-3 w-24" />
          <SkeletonText lines={3} className="mt-3" />
        </div>
      </Card>
    </aside>
  )
}
/** Reading CTA: resume for signed-in readers, chapter 1 (preview route for Guests). */
function ReadAction({ storyId, chapters, viewer, isAuthenticated }) {
  const { t } = useLocale()
  const first = chapters.find(chapter => chapter.orderKey === 1) ?? chapters[0]
  const saved = viewer?.resume
  const resume = saved?.available ? saved : null
  if (!first && !saved) return null
  /* The saved chapter is locked now: the reader shows its inline unlock prompt. */
  if (saved && !resume)
    return (
      <ButtonLink to={ROUTES.read(storyId, saved.chapterId)} size="lg" trailingIcon={ArrowRight}>
        <BookOpen size={18} aria-hidden="true" />
        {t('storyDetail.unlockToContinue', { title: saved.title })}
      </ButtonLink>
    )
  if (resume)
    return (
      <div className="flex flex-col items-start gap-2">
        <ButtonLink to={ROUTES.read(storyId, resume.chapterId)} size="lg" trailingIcon={ArrowRight}>
          <BookOpen size={18} aria-hidden="true" />
          {t('storyDetail.continueReading', { title: resume.title })}
        </ButtonLink>
        {resume.contentUpdated && (
          <p role="note" className="text-xs text-orange-strong">
            {t('storyDetail.contentUpdated')}
          </p>
        )}
      </div>
    )
  return (
    <ButtonLink
      to={
        isAuthenticated ? ROUTES.read(storyId, first.id) : `/stories/${storyId}/preview/${first.id}`
      }
      size="lg"
      trailingIcon={ArrowRight}
    >
      <BookOpen size={18} aria-hidden="true" />
      {t(isAuthenticated ? 'storyDetail.startReading' : 'storyDetail.readPreview')}
    </ButtonLink>
  )
}

/**
 * Listening CTA (TTS is for signed-in readers only): the saved chapter (read or listened),
 * else chapter 1, in the player.
 */
function ListenAction({ storyId, chapters, viewer, isAuthenticated }) {
  const { t } = useLocale()
  if (!isAuthenticated) return null
  const resume = viewer?.resume?.available ? viewer.resume : null
  const chapterId =
    resume?.chapterId ?? (chapters.find(chapter => chapter.orderKey === 1) ?? chapters[0])?.id
  if (!chapterId) return null
  return (
    <ButtonLink variant="secondary" size="lg" to={ROUTES.listen(storyId, chapterId)}>
      <Headphones size={18} aria-hidden="true" />
      {resume
        ? t('storyDetail.continueListening', { title: resume.title })
        : t('storyDetail.startListening')}
    </ButtonLink>
  )
}

function StoryDetailView({ data, storyId }) {
  const { t, formatNumber } = useLocale()
  const { isAuthenticated } = useAuth()
  const { story } = data
  const [chapterPage, setChapterPage] = useState(1)
  const [tab, setTab] = useState('chapters')
  const [oldestFirst, setOldestFirst] = useState(true)
  const [notice, setNotice] = useState('')
  const [synopsisOpen, setSynopsisOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [follow, setFollow] = useState({
    following: Boolean(data.viewer?.following),
    followers: story.followers ?? 0,
  })
  const [rating, setRating] = useState({
    value: data.viewer?.rating ?? null,
    average: story.averageRating ?? null,
    count: story.ratingCount ?? 0,
  })
  const numbered = data.chapters.map((chapter, index) => ({ ...chapter, number: index + 1 }))
  const chapters = oldestFirst ? numbered : [...numbered].reverse()
  const pageCount = Math.max(1, Math.ceil(chapters.length / CHAPTER_PAGE_SIZE))
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setNotice(t('storyDetail.shareCopied'))
    } catch {
      setNotice(t('storyDetail.shareFailed'))
    }
  }
  const breakdown = story.ratingBreakdown ?? [0, 0, 0, 0, 0]
  const bannerSrc =
    story.bannerUrl && /^\/catalog\//u.test(story.bannerUrl)
      ? `${API_BASE}${story.bannerUrl}`
      : story.bannerUrl
  return (
    <>
      {bannerSrc && (
        <div className="nh-fade-enter -mt-4 mb-5 overflow-hidden rounded-3xl border border-hairline bg-elevated shadow-soft">
          <img
            src={bannerSrc}
            alt={t('storyDetail.bannerAlt', { title: story.title })}
            loading="eager"
            decoding="async"
            className="max-h-64 w-full object-cover sm:max-h-80"
          />
        </div>
      )}
      <Card
        bezel
        className="nh-fade-enter -mt-4"
        innerClassName="nh-grid-12 grid gap-y-8 p-5 sm:p-8 lg:p-10 nh-layout-lg-3-9"
      >
        <StoryCover
          story={story}
          eager
          className="mx-auto aspect-[2/3] w-full max-w-44 self-start rounded-2xl border border-hairline shadow-soft sm:max-w-56 lg:max-w-none [@media(max-height:500px)]:max-w-36"
        />
        <div className="min-w-0 lg:pl-4">
          <h1 className="text-display text-balance">{story.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-brand/12 text-xs font-semibold text-brand-strong"
            >
              {initials(story.author)}
            </span>
            <strong className="font-semibold">{story.author}</strong>
            <span className="text-muted">
              {formatNumber(follow.followers)} {t('storyDetail.followers')}
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-hairline py-4 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">{t('storyDetail.communityRating')}</dt>
              <Star size={15} className="fill-orange text-orange" aria-hidden="true" />
              <dd className="font-semibold tabular-nums">
                {rating.average != null ? rating.average.toFixed(1) : '—'}{' '}
                <span className="font-normal text-muted">({formatNumber(rating.count)})</span>
              </dd>
            </div>
            <div className="flex gap-1.5">
              <dd className="font-semibold tabular-nums">{story.reads}</dd>
              <dt className="text-muted">{t('storyDetail.reads')}</dt>
            </div>
            <div className="flex gap-1.5">
              <dd className="font-semibold tabular-nums">{data.chapters.length}</dd>
              <dt className="text-muted">{t('storyDetail.chapters')}</dt>
            </div>
            <div className="col-span-2 flex items-center gap-1.5 max-sm:order-1">
              <dt className="text-muted">{t('storyDetail.status')}</dt>
              <dd>
                <Badge tone="purple">
                  {t(
                    story.status === 'Completed'
                      ? 'search.status.completed'
                      : 'search.status.ongoing',
                  )}
                </Badge>
              </dd>
            </div>
          </dl>
          {(story.genre || story.tags?.length > 0) && (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label={t('storyDetail.tags')}>
              {story.genre && (
                <li>
                  <Badge tone="orange">{story.genre}</Badge>
                </li>
              )}
              {(story.tags ?? []).map(tag => (
                <li key={tag}>
                  <Link
                    to={`${ROUTES.search}?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex min-h-8 items-center rounded-full transition-colors hover:text-brand-strong"
                  >
                    <Badge tone="green">#{tag}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p
            id="story-synopsis"
            className={`mt-5 max-w-[68ch] whitespace-pre-line text-base leading-7 text-muted lg:line-clamp-none ${synopsisOpen ? '' : 'line-clamp-4'}`}
          >
            {story.synopsis}
          </p>
          <button
            type="button"
            aria-expanded={synopsisOpen}
            aria-controls="story-synopsis"
            onClick={() => setSynopsisOpen(open => !open)}
            className="-ml-2 mt-1 inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-brand-strong hover:bg-brand/8 lg:hidden"
          >
            {t(synopsisOpen ? 'storyDetail.synopsisLess' : 'storyDetail.synopsisMore')}
          </button>
          <div className="mt-5 flex flex-wrap items-start gap-3 lg:mt-7">
            <ReadAction
              storyId={storyId}
              chapters={numbered}
              viewer={data.viewer}
              isAuthenticated={isAuthenticated}
            />
            <ListenAction
              storyId={storyId}
              chapters={numbered}
              viewer={data.viewer}
              isAuthenticated={isAuthenticated}
            />
            <FollowButton storyId={storyId} following={follow.following} onChange={setFollow} />
            <IconButton label={t('storyDetail.share')} size="lg" onClick={share}>
              <Share2 size={18} />
            </IconButton>
            <IconButton
              label={t('storyDetail.report')}
              size="lg"
              onClick={() => setReportOpen(true)}
            >
              <Flag size={18} />
            </IconButton>
          </div>
          <p role="status" className="mt-3 min-h-5 text-sm text-brand-strong">
            {notice}
          </p>
          {!isAuthenticated && (
            <div className="mt-3 rounded-2xl border border-brand/25 bg-brand-soft p-4 text-sm leading-6">
              <strong className="font-semibold text-brand-strong">
                {t('storyDetail.guestMode')}
              </strong>{' '}
              {t('storyDetail.guestModeDescription')}
            </div>
          )}
        </div>
      </Card>
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="story"
        targetId={storyId}
      />
      <div className="nh-grid-12 grid gap-y-6 nh-layout-lg-8-4">
        <Card as="section" className="overflow-hidden p-0" aria-label={t('storyDetail.chapters')}>
          <div className="border-b border-hairline p-3 sm:p-4">
            <Tabs
              label={story.title}
              singleRow
              value={tab}
              onChange={setTab}
              items={tabs.map(([value, labelKey]) => ({
                value,
                label: `${t(labelKey)}${value === 'chapters' ? ` · ${data.chapters.length}` : ''}`,
              }))}
            />
          </div>
          <div className="p-4 sm:p-6">
            {tab === 'chapters' &&
              (chapters.length ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                    <span>
                      {t('pagination.chapterRange', {
                        start: (chapterPage - 1) * CHAPTER_PAGE_SIZE + 1,
                        end: Math.min(chapterPage * CHAPTER_PAGE_SIZE, chapters.length),
                        count: chapters.length,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOldestFirst(value => !value)
                        setChapterPage(1)
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 font-semibold text-brand-strong transition-colors duration-200 hover:bg-brand/8 pointer-coarse:min-h-11"
                    >
                      {t(oldestFirst ? 'storyDetail.oldestFirst' : 'storyDetail.newestFirst')}
                      <ChevronDown
                        size={15}
                        aria-hidden="true"
                        className={`transition-transform duration-200 ease-spring ${oldestFirst ? '' : 'rotate-180'}`}
                      />
                    </button>
                  </div>
                  <ChapterList
                    chapters={chapters.slice(
                      (chapterPage - 1) * CHAPTER_PAGE_SIZE,
                      chapterPage * CHAPTER_PAGE_SIZE,
                    )}
                    storyId={storyId}
                  />
                  <Pagination page={chapterPage} pageCount={pageCount} onChange={setChapterPage} />
                </>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  headingAs="h3"
                  title={t('storyDetail.noChapters')}
                  description={t('storyDetail.noChaptersDescription')}
                  className="rounded-2xl border border-hairline"
                />
              ))}
            {tab === 'synopsis' && (
              <div className="whitespace-pre-line rounded-2xl bg-reader p-6 text-base leading-8 text-ink/80">
                {story.synopsis}
              </div>
            )}
            {tab === 'reviews' && (
              <StoryCommunity storyId={storyId} rating={rating} onRatingChange={setRating} />
            )}
          </div>
          {!isAuthenticated && data.chapters.length > 1 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline bg-elevated px-5 py-4 text-sm text-ink/70 sm:flex-row">
              <span>{t('storyDetail.signInRemaining', { count: data.chapters.length - 1 })}</span>
              <ButtonLink to={ROUTES.register} trailingIcon={ArrowRight}>
                {t('storyDetail.unlockFree')}
              </ButtonLink>
            </div>
          )}
        </Card>
        <aside className="space-y-5">
          <Reveal>
            <Card>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/12 font-semibold text-brand-strong"
                >
                  {initials(story.author)}
                </span>
                <h2 className="min-w-0 text-base font-semibold">
                  {t('storyDetail.aboutAuthor', { name: story.author })}
                </h2>
              </div>
              {story.authorBio && (
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-muted">
                  {story.authorBio}
                </p>
              )}
              {story.authorStats && (
                <dl className="nh-grid-12 mt-4 grid nh-cols-3 border-y border-hairline py-3 text-center">
                  {[
                    [story.authorStats.works, 'storyDetail.works'],
                    [story.authorStats.followers, 'storyDetail.followers'],
                    [story.authorStats.reads, 'storyDetail.reads'],
                  ].map(([value, labelKey]) => (
                    <div key={labelKey} className="flex flex-col-reverse">
                      <dt className="text-xs text-muted">{t(labelKey)}</dt>
                      <dd className="font-semibold tabular-nums">{formatNumber(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </Card>
          </Reveal>
          <Reveal delay={80}>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{t('storyDetail.communityRating')}</h2>
                <button
                  type="button"
                  onClick={() => setTab('reviews')}
                  className="min-h-9 rounded-full px-3 text-xs font-semibold text-brand-strong hover:bg-brand/8 pointer-coarse:min-h-11"
                >
                  {t('storyDetail.rateAndDiscuss')}
                </button>
              </div>
              <div className="mt-5 flex gap-5">
                <div className="shrink-0 text-center">
                  <strong className="block text-4xl font-bold tabular-nums">
                    {rating.average != null ? rating.average.toFixed(1) : '—'}
                  </strong>
                  <small className="mt-1 block text-xs text-muted">
                    {t('storyDetail.ratings', { count: formatNumber(rating.count) })}
                  </small>
                </div>
                <div className="flex-1 space-y-2">
                  {breakdown.map((value, index) => (
                    <div
                      className="flex items-center gap-2 text-xs tabular-nums text-muted"
                      key={5 - index}
                    >
                      <span className="flex w-6 shrink-0 items-center gap-0.5">
                        {5 - index}
                        <Star size={11} className="fill-orange text-orange" aria-hidden="true" />
                      </span>
                      <ProgressBar
                        value={value}
                        size="sm"
                        label={`${5 - index}★: ${value}%`}
                        className="flex-1"
                      />
                      <span className="w-8 shrink-0 text-right">{value}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {story.featuredReview && (
                <figure className="mt-5 border-t border-hairline pt-4">
                  {story.featuredReviewer && (
                    <figcaption className="text-xs font-semibold">
                      {story.featuredReviewer}
                    </figcaption>
                  )}
                  <blockquote className="mt-2 line-clamp-4 text-sm italic leading-6 text-muted">
                    {story.featuredReview}
                  </blockquote>
                </figure>
              )}
            </Card>
          </Reveal>
        </aside>
      </div>
    </>
  )
}

export function StoryDetailPage({ embedded = false }) {
  const { t } = useLocale()
  const { isAuthenticated } = useAuth()
  const { storyId } = useParams()
  const detail = useStoryDetail(storyId)
  const Root = embedded ? 'div' : 'main'
  const ready = detail.status === 'ready'
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-10 pb-20 pt-6 lg:space-y-12">
        <nav aria-label="Breadcrumb" className="text-xs text-muted">
          <Link
            to={ROUTES.home}
            className="inline-flex min-h-8 items-center hover:text-brand-strong"
          >
            {t('navigation.home')}
          </Link>
          {ready && detail.data.story.categoryId && detail.data.story.genre && (
            <>
              <span aria-hidden="true"> / </span>
              <Link
                to={`${ROUTES.categories}?category=${encodeURIComponent(detail.data.story.categoryId)}`}
                className="inline-flex min-h-8 items-center hover:text-brand-strong"
              >
                {detail.data.story.genre}
              </Link>
            </>
          )}
          <span aria-hidden="true"> / </span>
          {ready ? (
            <strong aria-current="page" className="font-semibold text-ink">
              {detail.data.story.title}
            </strong>
          ) : (
            detail.status === 'loading' && (
              <Skeleton className="inline-block h-3 w-28 align-middle" />
            )
          )}
        </nav>
        {detail.status === 'loading' && (
          <>
            <StoryHeroSkeleton
              note={
                !isAuthenticated && (
                  <div className="mt-3 rounded-2xl border border-brand/25 bg-brand-soft p-4 text-sm leading-6">
                    <strong className="font-semibold text-brand-strong">
                      {t('storyDetail.guestMode')}
                    </strong>{' '}
                    {t('storyDetail.guestModeDescription')}
                  </div>
                )
              }
            />
            <div className="nh-grid-12 grid gap-y-6 nh-layout-lg-8-4">
              <Card className="p-6">
                <SkeletonText lines={6} />
              </Card>
              <StoryAsideSkeleton />
            </div>
          </>
        )}
        {detail.status === 'error' && (
          <Card className="-mt-4 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title={t('storyDetail.loadFailed')}
              description={detail.error?.message}
              action={<RetryButton onClick={detail.retry} />}
            />
          </Card>
        )}
        {detail.status === 'empty' && (
          <Card className="-mt-4 p-0">
            <EmptyState
              headingAs="h1"
              icon={Search}
              title={t('storyDetail.notFound')}
              description={t('storyDetail.notFoundDescription')}
              action={
                <ButtonLink to={ROUTES.search} size="sm" trailingIcon={ArrowRight}>
                  {t('home.exploreStories')}
                </ButtonLink>
              }
            />
          </Card>
        )}
        {ready && <StoryDetailView key={storyId} data={detail.data} storyId={storyId} />}
      </Root>
    </div>
  )
}
