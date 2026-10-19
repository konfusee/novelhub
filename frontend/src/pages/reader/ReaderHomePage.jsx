import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Flame,
  PenLine,
  Headphones,
  Pause,
  Play,
  RefreshCw,
  Star,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { ContinueCard, ContinueCardSkeleton } from '../../components/reader/ContinueCard'
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
  SectionHeader,
  Skeleton,
} from '../../components/ui'
import { readerHome } from '../../data/mock/reader'
import { ROUTES } from '../../app/routes'
import { useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { useMockResource } from '../../context/MockDataContext'

const slugify = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const genreTones = { Fantasy: 'orange', Romance: 'rose', Adventure: 'green' }

const continueItems = [readerHome.continueReading, readerHome.continueListening]
const recommendationFeed = {
  recommendations: readerHome.recommendations,
  picks: readerHome.fantasyPicks,
}
const updateFeed = { updates: readerHome.updates, releases: readerHome.releases }
const isRecommendationsEmpty = value => !value.recommendations.length && !value.picks.length
const isUpdatesEmpty = value => !value.updates.length && !value.releases.length

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  )
}

function ErrorCard({ title, onRetry, className = 'mt-4' }) {
  return (
    <Card className={`${className} p-0`}>
      <EmptyState
        tone="rose"
        headingAs="h3"
        icon={AlertTriangle}
        title={title}
        description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
        action={<RetryButton onClick={onRetry} />}
      />
    </Card>
  )
}

function StoryTileSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-3">
      <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
      <span className="mt-3 flex h-5 items-center">
        <Skeleton className="h-3.5 w-4/5" />
      </span>
      <span className="flex h-4 items-center">
        <Skeleton className="h-2.5 w-1/2" />
      </span>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="size-9" />
      </div>
    </Card>
  )
}

function CompactRowSkeleton({ cover = 'h-16 w-11 rounded-xl' }) {
  return (
    <>
      <Skeleton className={`${cover} shrink-0`} />
      <span className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </span>
    </>
  )
}

function StoryTile({ story }) {
  const [saved, setSaved] = useState(false)
  const href = `/stories/${slugify(story.title)}`
  return (
    <Card as="article" interactive className="group flex flex-col p-3">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="block">
        <StoryCover
          story={story}
          className="aspect-[2/3] rounded-2xl"
          badge={
            <span className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] rounded-full bg-surface/90 shadow-whisper">
              <Badge tone={genreTones[story.genre] || 'purple'} className="max-w-full">
                <span className="truncate">{story.genre}</span>
              </Badge>
            </span>
          }
        />
      </Link>
      <h3 className="mt-3 line-clamp-2 whitespace-normal text-sm font-semibold" title={story.title}>
        <Link to={href} className="whitespace-normal transition-colors hover:text-brand">
          {story.title}
        </Link>
      </h3>
      <p className="truncate text-xs text-muted" title={story.author}>
        {story.author}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs font-medium text-ink/80">
          <Star size={12} className="fill-orange text-orange" /> {story.rating}
        </p>
        <IconButton
          label={saved ? `Bỏ lưu ${story.title}` : `Lưu ${story.title}`}
          aria-pressed={saved}
          tone="purple"
          shape="circle"
          size="sm"
          onClick={() => setSaved(!saved)}
        >
          <Bookmark size={15} className={saved ? 'fill-current' : ''} />
        </IconButton>
      </div>
    </Card>
  )
}

function StreakCard() {
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Chuỗi ngày đọc</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Flame className="fill-orange/20 text-orange" /> 18 ngày
          </p>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
          <CalendarDays size={18} />
        </span>
      </div>
      <ol className="mt-5 grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <li className="flex flex-col items-center" key={day}>
            <span className="text-xs text-muted">{day}</span>
            <span
              className={`mt-2 grid size-7 place-items-center rounded-full text-[11px] font-semibold ${index < 5 ? 'bg-brand text-on-brand' : 'bg-elevated text-ink/70'}`}
            >
              {index < 5 ? (
                <Check size={12} aria-label="Đã đọc" />
              ) : (
                <span className="tabular-nums">{index + 23}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-2xl bg-orange/12 px-3 py-2 text-xs font-medium text-orange-strong">
        Chuỗi tốt nhất: 24 ngày. Hãy tiếp tục đọc!
      </p>
    </Card>
  )
}

const nowPlaying =
  readerHome.recommendations.find(story => story.title === 'Midnight Whispers') ||
  readerHome.recommendations[0]

function NowPlaying() {
  const [playing, setPlaying] = useState(true)
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Đang phát</h3>
        <Headphones size={18} className="text-orange-strong" />
      </div>
      <div className="group mt-4 flex items-center gap-3">
        <StoryCover story={nowPlaying} className="h-16 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h4
            className="line-clamp-2 whitespace-normal text-sm font-semibold"
            title={nowPlaying.title}
          >
            <Link
              to={`/listen/${slugify(nowPlaying.title)}/chapter-1`}
              className="whitespace-normal transition-colors hover:text-brand"
            >
              {nowPlaying.title}
            </Link>
          </h4>
          <p className="truncate text-xs text-muted" title={nowPlaying.author}>
            {nowPlaying.author}
          </p>
        </div>
      </div>
      <ProgressBar value={42} tone="orange" size="sm" label="Tiến độ nghe" className="mt-4" />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs tabular-nums text-muted">1:24:18</span>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          className="grid size-11 place-items-center rounded-full bg-brand text-on-brand shadow-[0_10px_24px_-14px_var(--primary)] transition-transform duration-200 active:scale-[0.96]"
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <span className="text-xs tabular-nums text-muted">3:09:47</span>
      </div>
    </Card>
  )
}

export function ReaderHomePage() {
  const { currentUser, hasRole } = useAuth()
  const { t } = useLocale()
  const continuing = useMockResource('reader:continue', continueItems)
  const recommended = useMockResource('reader:recommendations', recommendationFeed, {
    isEmpty: isRecommendationsEmpty,
  })
  const updated = useMockResource('reader:updates', updateFeed, { isEmpty: isUpdatesEmpty })
  const [picks, setPicks] = useState(readerHome.fantasyPicks)
  return (
    <ReaderLayout>
      <div className="page-reader py-6">
        {!hasRole('author') && (
          <Card className="mb-6 flex flex-col gap-4 border-brand/25 bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-brand-strong">
                <PenLine size={22} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{t('reader.authorInvitationTitle')}</h2>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {t('reader.authorInvitationDescription')}
                </p>
              </div>
            </div>
            <ButtonLink to={ROUTES.authorApply} trailingIcon={ArrowRight} className="shrink-0">
              {t('navigation.becomeAuthor')}
            </ButtonLink>
          </Card>
        )}
        <div className="nh-grid-12 grid gap-6 nh-layout-2xl-8-4">
          <div className="min-w-0 space-y-8">
            <Card bezel as="section" innerClassName="p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="min-w-0">
                  <p className="nh-eyebrow">{t('readerHome.sanctuary')}</p>
                  <h1 className="mt-3 text-h2 sm:text-h1">
                    {t('readerHome.welcome', {
                      name: currentUser?.name?.split(' ')[0] || t('auth.reader'),
                    })}
                  </h1>
                  <p className="mt-2 max-w-prose text-sm text-muted">
                    {t('readerHome.nextChapterWaiting')}
                  </p>
                  <ButtonLink to="/reader/library" trailingIcon={ArrowRight} className="mt-5">
                    {t('readerHome.openReader')}
                  </ButtonLink>
                </div>
                <div className="w-full rounded-2xl border border-hairline bg-elevated p-5 md:max-w-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-ink/70">{t('readerHome.goal')}</p>
                      <strong className="mt-1 block text-lg">
                        {t('readerHome.goalProgress', { current: 35, total: 45 })}
                      </strong>
                    </div>
                    <span className="grid size-12 shrink-0 place-items-center rounded-full border-4 border-brand text-xs font-bold tabular-nums text-brand-strong">
                      78%
                    </span>
                  </div>
                  <ProgressBar value={35} max={45} label={t('readerHome.goal')} className="mt-4" />
                  <p className="mt-3 flex items-center gap-2 text-xs text-ink/70">
                    <Flame size={14} className="shrink-0 text-orange" />
                    {t('readerHome.streakRemaining', { count: 12 })}
                  </p>
                </div>
              </div>
            </Card>

            <section>
              <SectionHeader
                title={t('readerHome.pickUp')}
                description="Truyện của bạn luôn sẵn sàng"
              />
              {continuing.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label="Đang tải truyện đang đọc"
                  className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2"
                >
                  <ContinueCardSkeleton />
                  <ContinueCardSkeleton />
                </div>
              ) : continuing.status === 'error' ? (
                <ErrorCard title="Không tải được truyện đang đọc" onRetry={continuing.retry} />
              ) : continuing.status === 'empty' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    headingAs="h3"
                    icon={BookOpen}
                    title="Bạn chưa bắt đầu truyện nào"
                    description="Chọn một truyện để đọc hoặc nghe, tiến độ sẽ hiện ở đây để bạn tiếp tục bất cứ lúc nào."
                    action={
                      <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                        Khám phá truyện
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : (
                <div className="nh-fade-enter nh-grid-12 mt-4 grid gap-4 nh-md-cols-2">
                  <ContinueCard item={continuing.data[0]} />
                  <ContinueCard item={continuing.data[1]} audio />
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                title={t('readerHome.recommended')}
                description="Được tuyển chọn theo sở thích đọc của bạn"
                action={
                  <Link
                    to="/search"
                    className="inline-flex min-h-9 items-center gap-1 rounded-full text-sm font-semibold text-brand-strong transition-colors hover:text-brand"
                  >
                    {t('readerHome.seeAll')} <ChevronRight size={15} />
                  </Link>
                }
              />
              {recommended.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label="Đang tải đề xuất"
                  className="nh-grid-12 mt-4 grid nh-cols-2 gap-3 nh-sm-cols-4"
                >
                  {readerHome.recommendations.map(story => (
                    <StoryTileSkeleton key={story.title} />
                  ))}
                </div>
              ) : recommended.status === 'error' ? (
                <ErrorCard title="Không tải được đề xuất" onRetry={recommended.retry} />
              ) : recommended.status === 'empty' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    headingAs="h3"
                    icon={Compass}
                    title="Chưa có đề xuất cho bạn"
                    description="Đọc thêm vài chương hoặc chọn thể loại yêu thích để NovelHub hiểu gu của bạn."
                    action={
                      <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                        Chọn thể loại
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : (
                <div className="nh-fade-enter nh-grid-12 mt-4 grid nh-cols-2 gap-3 nh-sm-cols-4">
                  {recommended.data.recommendations.map(story => (
                    <StoryTile key={story.title} story={story} />
                  ))}
                </div>
              )}
            </section>

            {(recommended.status === 'ready' || recommended.status === 'loading') && (
              <Reveal as="section">
                <SectionHeader
                  title={t('readerHome.becauseFantasy')}
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPicks(current => [...current.slice(1), current[0]])}
                      className="text-brand-strong"
                    >
                      <RefreshCw size={14} />
                      Làm mới đề xuất
                    </Button>
                  }
                />
                {recommended.status === 'loading' ? (
                  <div
                    aria-busy="true"
                    aria-label="Đang tải gợi ý kỳ ảo"
                    className="nh-grid-12 mt-4 grid gap-3 nh-sm-cols-3"
                  >
                    {readerHome.fantasyPicks.map(item => (
                      <Card
                        as="div"
                        key={item.title}
                        aria-hidden="true"
                        className="flex items-center gap-3 p-3"
                      >
                        <CompactRowSkeleton />
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div
                    aria-live="polite"
                    className="nh-fade-enter nh-grid-12 mt-4 grid gap-3 nh-sm-cols-3"
                  >
                    {picks.map(item => (
                      <Card
                        key={item.title}
                        as={Link}
                        to={`/stories/${slugify(item.title)}`}
                        interactive
                        className="group flex items-center gap-3 p-3"
                      >
                        <StoryCover story={item} className="h-16 w-11 shrink-0 rounded-xl" />
                        <div className="min-w-0">
                          <h3
                            className="line-clamp-2 whitespace-normal text-sm font-semibold"
                            title={item.title}
                          >
                            {item.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted">{item.detail}</p>
                        </div>
                        <ChevronRight
                          size={17}
                          className="ml-auto shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-0.5"
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </Reveal>
            )}

            <Reveal as="section">
              <SectionHeader
                title={t('readerHome.recentlyUpdated')}
                description="Chương mới từ những truyện bạn theo dõi"
              />
              {updated.status === 'loading' ? (
                <Card
                  aria-busy="true"
                  aria-label="Đang tải chương mới"
                  className="mt-4 divide-y divide-hairline p-0"
                >
                  {readerHome.updates.map(item => (
                    <div
                      key={item.title}
                      aria-hidden="true"
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <CompactRowSkeleton cover="h-14 w-10 rounded-xl" />
                      <Skeleton className="hidden h-3 w-14 shrink-0 sm:block" />
                      <Skeleton className="h-9 w-16 shrink-0" />
                    </div>
                  ))}
                </Card>
              ) : updated.status === 'error' ? (
                <ErrorCard title="Không tải được chương mới" onRetry={updated.retry} />
              ) : updated.status === 'empty' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    headingAs="h3"
                    icon={BellRing}
                    title="Chưa có chương mới"
                    description="Theo dõi tác giả và truyện yêu thích để nhận chương mới ngay khi phát hành."
                    action={
                      <ButtonLink to="/reader/following" size="sm" trailingIcon={ArrowRight}>
                        Quản lý theo dõi
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : (
                <Card className="nh-fade-enter mt-4 divide-y divide-hairline p-0">
                  {updated.data.updates.map(item => (
                    <div className="group flex items-center gap-3 px-4 py-3" key={item.title}>
                      <StoryCover story={item} className="h-14 w-10 shrink-0 rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <h3
                          className="line-clamp-2 whitespace-normal text-sm font-semibold"
                          title={item.title}
                        >
                          {item.title}
                        </h3>
                        <p className="truncate text-xs text-muted" title={item.chapter}>
                          {item.chapter}
                        </p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted sm:block">
                        {item.time}
                      </span>
                      <ButtonLink
                        to={`/stories/${slugify(item.title)}`}
                        variant="outline"
                        size="sm"
                        aria-label={`Đọc ${item.title}`}
                        className="shrink-0 px-4"
                      >
                        Đọc
                      </ButtonLink>
                    </div>
                  ))}
                </Card>
              )}
            </Reveal>
          </div>

          <aside className="nh-grid-12 grid content-start gap-5 nh-sm-cols-2 nh-2xl-cols-1">
            <StreakCard />
            <NowPlaying />
            <Card>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Sắp phát hành</h3>
                <BellRing size={18} className="text-rose-strong" />
              </div>
              {updated.status === 'loading' ? (
                <ul
                  aria-busy="true"
                  aria-label="Đang tải lịch phát hành"
                  className="mt-4 space-y-3"
                >
                  {readerHome.releases.map(item => (
                    <li key={item.title} aria-hidden="true" className="flex items-center gap-3">
                      <CompactRowSkeleton cover="size-11 rounded-2xl" />
                    </li>
                  ))}
                </ul>
              ) : updated.status === 'ready' && updated.data.releases.length ? (
                <ul className="nh-fade-enter mt-4 space-y-3">
                  {updated.data.releases.map(item => (
                    <li className="flex items-center gap-3" key={item.title}>
                      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-center text-[11px] font-bold leading-tight text-brand-strong">
                        {item.date}
                      </span>
                      <div className="min-w-0">
                        <h4
                          className="line-clamp-2 whitespace-normal text-sm font-semibold"
                          title={item.title}
                        >
                          {item.title}
                        </h4>
                        <p className="truncate text-xs text-muted" title={item.author}>
                          {item.author}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  {updated.status === 'error'
                    ? 'Chưa tải được lịch phát hành.'
                    : 'Chưa có lịch phát hành sắp tới.'}
                </p>
              )}
            </Card>
            <Card className="bg-elevated sm:col-span-2 2xl:col-span-1">
              <Clock3 className="text-brand" />
              <p className="mt-4 text-lg font-medium leading-7 text-ink">
                “Một độc giả sống ngàn cuộc đời trước khi nghỉ ngơi.”
              </p>
              <p className="mt-3 text-xs text-ink/70">Cảm hứng mỗi ngày của bạn</p>
            </Card>
          </aside>
        </div>
      </div>
    </ReaderLayout>
  )
}
