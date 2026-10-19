import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Heart,
  Pause,
  Play,
  Castle,
  Leaf,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Star,
} from '../../components/icons'
import * as icons from '../../components/icons'
import { categories } from '../../data/mock/categories'
import { featuredStories, stories } from '../../data/mock/stories'
import { PublicHeader } from '../../components/public/PublicHeader'
import { StoryCard, StoryCardSkeleton } from '../../components/public/StoryCard'
import { StoryCover } from '../../components/story/StoryCover'
import { SectionTitle } from '../../components/public/SectionTitle'
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  Reveal,
  Skeleton,
} from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'
import { useMockResource } from '../../context/MockDataContext'

const stagger = index => Math.min(index, 5) * 80

/* Error / empty panel for one home data band; spans the full 12-column band. */
function BandState({ resource, errorTitle, emptyTitle, emptyDescription, emptyAction }) {
  return (
    <Card className="col-span-12 p-0">
      {resource.status === 'error' ? (
        <EmptyState
          tone="rose"
          headingAs="h3"
          icon={AlertTriangle}
          title={errorTitle}
          description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
          action={
            <Button variant="secondary" size="sm" onClick={resource.retry}>
              <RefreshCw size={14} aria-hidden="true" />
              Thử lại
            </Button>
          }
        />
      ) : (
        <EmptyState
          headingAs="h3"
          icon={BookOpen}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      )}
    </Card>
  )
}

/*
 * The page root is one 12-column grid. Every band spans all 12 columns and re-exposes them
 * as a subgrid, so cards in every section snap to the same column lines and gutters.
 * Spans respond to the page's own width (container queries: @2xl 672px, @4xl 896px, @5xl
 * 1024px), so the layout also fits when the page is embedded beside the reader sidebar.
 */
const band = 'col-span-12 grid grid-cols-subgrid'

/* Hero slides: each artwork fills the whole art panel; object position keeps the subject in frame. */
const heroSlides = [
  { story: stories[2], focus: '[&_img]:object-[50%_58%]' },
  { story: stories[1], focus: '[&_img]:object-[50%_42%]' },
  { story: stories[0], focus: '[&_img]:object-[55%_62%]' },
]

/* Stat cells: 2 × 2 until the wide layout, then one row of four; hairline column separators. */
const statEdges = ['', 'border-l', '@4xl:border-l', 'border-l']

function Hero() {
  const { t } = useLocale()
  const [slide, setSlide] = useState(0)
  const featured = heroSlides[slide].story
  const changeSlide = direction =>
    setSlide(current => (current + direction + heroSlides.length) % heroSlides.length)
  const stats = [
    ['3M+', t('home.readers')],
    ['100K+', t('home.stories')],
    ['15K+', t('home.authors')],
    ['4.8', t('home.userRating'), true],
  ]
  return (
    <section
      aria-label={t('home.featured')}
      aria-roledescription="carousel"
      className={`nh-bezel ${band}`}
    >
      <div className={`nh-bezel-core ${band} overflow-hidden`}>
        <div className="col-span-12 flex flex-col justify-center px-6 pb-10 pt-8 sm:px-10 sm:pt-12 @4xl:col-span-7 lg:px-12 lg:py-16 xl:py-20">
          <p className="nh-eyebrow w-fit">{t('home.eyebrow')}</p>
          <h1 aria-live="polite" className="mt-5 break-words text-display text-balance">
            {t(
              slide === 0
                ? 'home.heroLineOne'
                : slide === 1
                  ? 'home.audioHeroTitle'
                  : 'home.storyHeroTitle',
            )}
            <br />
            <span className="text-brand">
              {slide === 0 ? t('home.heroHighlight') : featured.title}
            </span>{' '}
            {slide === 0 && t('home.heroLineTwo')}
          </h1>
          <p className="mt-5 max-w-[46ch] text-base leading-7 text-muted">
            {t('home.heroDescription')}
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ButtonLink
              to={slide === 0 ? '/search' : `/stories/${featured.id}`}
              size="lg"
              trailingIcon={ArrowRight}
            >
              {t('home.exploreStories')}
            </ButtonLink>
            <ButtonLink to="/search?format=audio" size="lg" variant="secondary">
              <Headphones size={18} aria-hidden="true" /> {t('home.startListening')}
            </ButtonLink>
          </div>
        </div>
        <div className="col-span-12 @4xl:col-span-5">
          {/* Positioned inner panel: absolute layers anchor to it, not to the subgrid item. */}
          <div className="relative h-full min-h-[24rem] overflow-hidden bg-elevated sm:min-h-[28rem]">
            {heroSlides.map(({ story, focus }, index) => (
              <div
                key={story.id}
                aria-hidden={slide !== index}
                className={`absolute inset-0 transition-[opacity,scale] duration-[800ms] ease-spring ${slide === index ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'}`}
              >
                <StoryCover story={story} eager className={`h-full w-full ${focus}`} />
              </div>
            ))}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-footer/90 via-footer/45 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-5 sm:p-6">
              {slide === 0 ? (
                <p className="flex items-center gap-2 text-sm font-medium italic text-white">
                  <Leaf size={16} aria-hidden="true" className="shrink-0" />
                  A kinder world through stories
                  <Heart size={14} aria-hidden="true" className="shrink-0 fill-current text-rose" />
                </p>
              ) : (
                <Link
                  to={`/stories/${featured.id}`}
                  className="group block w-fit max-w-full whitespace-normal rounded-2xl text-white"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[.14em] text-white/80">
                    {featured.genre} · {featured.author}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-h3">
                    {featured.title}
                    <ArrowRight
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              )}
              <div className="flex items-center justify-between gap-2">
                <div
                  className="flex rounded-full bg-surface/90 px-1 shadow-whisper"
                  role="group"
                  aria-label={t('home.chooseSlide')}
                >
                  {heroSlides.map((item, index) => (
                    <button
                      key={item.story.id}
                      type="button"
                      aria-label={t('home.slide', { number: index + 1 })}
                      aria-pressed={slide === index}
                      onClick={() => setSlide(index)}
                      className="grid size-11 place-items-center rounded-full"
                    >
                      <span
                        className={`h-2 rounded-full transition-[transform,background-color] duration-[420ms] ease-spring ${slide === index ? 'w-6 bg-brand' : 'w-2 bg-ink/25'}`}
                      />
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <IconButton
                    label={t('home.previousSlide')}
                    shape="circle"
                    onClick={() => changeSlide(-1)}
                  >
                    <ChevronLeft size={16} />
                  </IconButton>
                  <IconButton
                    label={t('home.nextSlide')}
                    shape="circle"
                    onClick={() => changeSlide(1)}
                  >
                    <ChevronRight size={16} />
                  </IconButton>
                </div>
              </div>
            </div>
          </div>
        </div>
        <dl className={`${band} border-t border-hairline`}>
          {stats.map(([value, label, rating], index) => (
            <div
              key={label}
              className={`col-span-6 flex flex-col-reverse justify-end border-hairline px-6 py-5 sm:px-10 @4xl:col-span-3 lg:px-12 lg:py-6 ${statEdges[index]}`}
            >
              <dt className="mt-1 text-xs text-muted">{label}</dt>
              <dd className="flex items-center gap-1.5 text-2xl font-bold tabular-nums tracking-tight">
                {value}
                {rating && (
                  <Star size={18} className="fill-orange text-orange" aria-hidden="true" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

const categoryTones = {
  purple: 'bg-purple/12 text-purple-strong',
  rose: 'bg-rose/14 text-rose-strong',
  orange: 'bg-orange/16 text-orange-strong',
  green: 'bg-brand/12 text-brand-strong',
  blue: 'bg-ink/6 text-ink/80',
  neutral: 'bg-ink/6 text-ink/80',
}

const tile =
  'group relative flex h-full overflow-hidden whitespace-normal rounded-3xl border border-line bg-surface shadow-whisper transition-[transform,border-color,box-shadow] duration-[420ms] ease-spring hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lift'

/* Static tile frame (no hover) for loading placeholders. */
const tileFrame =
  'relative flex h-full overflow-hidden rounded-3xl border border-line bg-surface shadow-whisper'

const categoryLink = name => `/categories?genre=${encodeURIComponent(name)}`

function Categories() {
  const { t } = useLocale()
  const resource = useMockResource('home:categories', categories)
  const storiesLabel = t('home.stories').toLocaleLowerCase('vi')
  const title = (
    <div className="col-span-12">
      <SectionTitle to="/categories">{t('home.browseCategory')}</SectionTitle>
    </div>
  )
  if (resource.status === 'loading') {
    return (
      <section className={band}>
        {title}
        <div
          aria-busy="true"
          aria-label="Đang tải thể loại"
          className={`${band} gap-y-4 lg:gap-y-6`}
        >
          <div aria-hidden="true" className="col-span-12 @2xl:col-span-6 @2xl:row-span-2">
            <div className={`${tileFrame} min-h-64 flex-col p-6 sm:p-8`}>
              <span className="flex w-[58%] min-w-0 flex-1 flex-col">
                <Skeleton className="size-12 rounded-2xl" />
                <span className="mt-6 flex h-8 items-center">
                  <Skeleton className="h-6 w-2/3" />
                </span>
                <span className="mt-2 flex flex-col gap-3 py-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full @2xl:w-3/4" />
                  <Skeleton className="h-3 w-1/2 @2xl:hidden" />
                </span>
                <span className="mt-auto block pt-6">
                  <span className="flex h-5 items-center">
                    <Skeleton className="h-3.5 w-28" />
                  </span>
                </span>
              </span>
            </div>
          </div>
          {categories.slice(1).map(category => (
            <div key={category.name} aria-hidden="true" className="col-span-6 @2xl:col-span-3">
              <div className={`${tileFrame} flex-col gap-5 p-5`}>
                <Skeleton className="size-11 rounded-2xl" />
                <span className="mt-auto block">
                  <span className="flex flex-col justify-center gap-1.5 @2xl:h-6 @2xl:gap-0">
                    <Skeleton className="mt-[3px] h-3.5 w-3/4 @2xl:mt-0" />
                    <Skeleton className="mb-[3px] h-3.5 w-1/2 @2xl:hidden" />
                  </span>
                  <span className="mt-0.5 flex h-4 items-center">
                    <Skeleton className="h-2.5 w-1/2" />
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    )
  }
  if (resource.status !== 'ready') {
    return (
      <section className={band}>
        {title}
        <BandState
          resource={resource}
          errorTitle="Không tải được danh sách thể loại"
          emptyTitle="Chưa có thể loại nào"
          emptyDescription="Danh mục đang được cập nhật. Bạn vẫn có thể tìm truyện theo tên."
          emptyAction={
            <ButtonLink to="/search" size="sm" trailingIcon={ArrowRight}>
              Tìm truyện
            </ButtonLink>
          }
        />
      </section>
    )
  }
  const [lead, ...rest] = resource.data
  const LeadIcon = icons[lead.icon] || BookOpen
  return (
    <section className={band}>
      {title}
      <div className={`${band} gap-y-4 lg:gap-y-6`}>
        <Reveal className="col-span-12 @2xl:col-span-6 @2xl:row-span-2">
          <Link to={categoryLink(lead.name)} className={`${tile} min-h-64 p-6 sm:p-8`}>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_100%_100%,color-mix(in_oklab,var(--accent-purple)_16%,transparent),transparent_70%)]"
            />
            <span className="relative flex w-[58%] min-w-0 flex-col">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${categoryTones[lead.tone]}`}
              >
                <LeadIcon size={24} aria-hidden="true" />
              </span>
              <span className="mt-6 text-h2">{lead.name}</span>
              <span className="mt-2 text-sm leading-6 text-muted">{lead.description}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold tabular-nums text-brand-strong">
                {lead.count} {storiesLabel}
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                />
              </span>
            </span>
            <span
              aria-hidden="true"
              className="absolute -bottom-6 right-5 w-[34%] max-w-48 rotate-6 transition-transform duration-[420ms] ease-spring group-hover:rotate-3 sm:right-8"
            >
              <StoryCover
                story={stories[0]}
                className="aspect-[2/3] w-full rounded-2xl border border-hairline shadow-float"
              />
            </span>
          </Link>
        </Reveal>
        {rest.map((category, index) => {
          const Icon = icons[category.icon] || BookOpen
          return (
            <Reveal
              key={category.name}
              className="col-span-6 @2xl:col-span-3"
              delay={stagger((index % 4) + 1)}
            >
              <Link to={categoryLink(category.name)} className={`${tile} flex-col gap-5 p-5`}>
                <span className="flex items-start justify-between gap-3">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-2xl ${categoryTones[category.tone] || categoryTones.neutral}`}
                  >
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                    className="mt-1 shrink-0 text-muted transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                  />
                </span>
                <span className="mt-auto min-w-0">
                  <span className="block break-words text-sm font-semibold sm:text-base">
                    {category.name}
                  </span>
                  <span className="mt-0.5 block text-xs tabular-nums text-muted">
                    {category.count} {storiesLabel}
                  </span>
                </span>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}

function ContinueCard({ audio = false }) {
  const { t } = useLocale()
  const [bookmarked, setBookmarked] = useState(false)
  const story = audio ? stories[1] : stories[0]
  const progress = audio ? 32 : 68
  return (
    <Card className="flex h-full gap-5 p-4 sm:p-5">
      <StoryCover
        story={story}
        className="aspect-[2/3] w-20 shrink-0 self-start rounded-2xl sm:w-24"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={`flex justify-between gap-2 text-xs font-semibold ${audio ? 'text-orange-strong' : 'text-brand-strong'}`}
        >
          <span>{t(audio ? 'home.continueListening' : 'home.continueReading')}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <h3 className="mt-1.5 truncate text-base font-semibold">{story.title}</h3>
        <p className="mt-0.5 truncate text-xs text-muted">
          {audio ? 'Chương 5 · The Letter' : 'Chương 12 · A New Beginning'}
        </p>
        <ProgressBar
          value={progress}
          tone={audio ? 'orange' : 'brand'}
          size="sm"
          label={t(audio ? 'home.continueListening' : 'home.continueReading')}
          className="my-3"
        />
        <div className="mt-auto flex gap-2">
          <ButtonLink
            to={audio ? '/listen/demo/chapter-1' : '/stories/demo'}
            size="sm"
            variant={audio ? 'accent' : 'primary'}
            className="flex-1"
          >
            {audio ? (
              <Headphones size={14} aria-hidden="true" />
            ) : (
              <BookOpen size={14} aria-hidden="true" />
            )}
            {t('common.continue')}
          </ButtonLink>
          <IconButton
            label={t('story.bookmark')}
            tone="purple"
            size="sm"
            aria-pressed={bookmarked}
            onClick={() => setBookmarked(value => !value)}
          >
            <Bookmark size={15} className={bookmarked ? 'fill-current' : ''} />
          </IconButton>
        </div>
      </div>
    </Card>
  )
}

const segment =
  'inline-flex min-h-10 items-center justify-center rounded-full px-3 text-xs font-semibold transition-[background-color,color] duration-200 ease-spring pointer-coarse:min-h-11'

function ReaderPreview() {
  const { t } = useLocale()
  const [fontSize, setFontSize] = useState(16)
  const [spacing, setSpacing] = useState(1.8)
  return (
    <Card className="nh-audio-motif flex h-full flex-col overflow-hidden p-6 sm:p-8">
      <h2 className="text-h3">{t('home.readerPreview')}</h2>
      <div
        className="mt-5 flex-1 rounded-2xl border border-hairline bg-reader p-5 text-ink sm:p-7"
        style={{ fontSize, lineHeight: spacing }}
      >
        <h3 className="text-[1.15em] font-semibold leading-snug">The Silent Forest</h3>
        <p className="text-xs text-muted">Chương 1 · The Whispering Trees</p>
        <div className="mt-4 max-w-[62ch] space-y-[0.9em]">
          <p>
            The wind moved gently through the ancient trees, carrying whispers of forgotten stories.
            In that quiet moment, everything felt possible. She closed her eyes and listened — not
            just to the forest, but to her own heartbeat.
          </p>
          <p>
            Somewhere beyond the moss and the mist, a path glowed faintly green, as if the forest
            itself had decided to show her the way home.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 border-t border-hairline pt-5 text-xs sm:grid-cols-2 sm:gap-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">{t('reader.fontSize')}</span>
          <div className="inline-flex items-center rounded-full border border-hairline bg-elevated p-1">
            <button
              type="button"
              aria-label={`${t('reader.fontSize')} −`}
              disabled={fontSize <= 12}
              onClick={() => setFontSize(Math.max(12, fontSize - 1))}
              className={`${segment} hover:bg-surface disabled:opacity-40`}
            >
              Aa−
            </button>
            <span className="min-w-8 text-center font-semibold tabular-nums text-brand-strong">
              {fontSize}
            </span>
            <button
              type="button"
              aria-label={`${t('reader.fontSize')} +`}
              disabled={fontSize >= 19}
              onClick={() => setFontSize(Math.min(19, fontSize + 1))}
              className={`${segment} hover:bg-surface disabled:opacity-40`}
            >
              Aa+
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">{t('settings.reading.lineSpacing')}</span>
          <div
            role="group"
            aria-label={t('settings.reading.lineSpacing')}
            className="inline-flex items-center rounded-full border border-hairline bg-elevated p-1"
          >
            {[1.5, 1.8, 2.1].map(value => (
              <button
                key={value}
                type="button"
                aria-pressed={spacing === value}
                onClick={() => setSpacing(value)}
                className={`${segment} tabular-nums ${spacing === value ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-surface'}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

const AUDIO_LENGTH = 624
const formatTime = seconds =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

function AudioPreview() {
  const { t } = useLocale()
  const [playing, setPlaying] = useState(false)
  const [liked, setLiked] = useState(false)
  const [position, setPosition] = useState(138)
  const seek = delta => setPosition(value => Math.min(AUDIO_LENGTH, Math.max(0, value + delta)))
  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(() => {
      setPosition(value => {
        if (value + 1 < AUDIO_LENGTH) return value + 1
        setPlaying(false)
        return AUDIO_LENGTH
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [playing])
  return (
    <Card className="flex h-full flex-col p-6 sm:p-8">
      <h2 className="text-h3">{t('home.audioPreview')}</h2>
      <div className="mt-5 flex items-center gap-4">
        <StoryCover
          story={stories[1]}
          className="aspect-[2/3] w-14 shrink-0 rounded-xl border border-hairline"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{stories[1].title}</h3>
          <p className="truncate text-xs text-muted">{stories[1].author}</p>
        </div>
        <IconButton
          label={t('home.favorite')}
          tone="rose"
          shape="circle"
          size="sm"
          aria-pressed={liked}
          onClick={() => setLiked(!liked)}
        >
          <Heart size={18} className={liked ? 'fill-current' : ''} />
        </IconButton>
      </div>
      <div className="mt-auto pt-5">
        <ProgressBar value={position} max={AUDIO_LENGTH} size="sm" label={t('home.audioPreview')} />
        <div className="mt-2 flex justify-between text-xs tabular-nums text-muted">
          <span>{formatTime(position)}</span>
          <span>{formatTime(AUDIO_LENGTH)}</span>
        </div>
        <div className="mt-4 flex items-center justify-around">
          <button
            type="button"
            aria-label="Lùi 15 giây"
            onClick={() => seek(-15)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted transition-[background-color,color,transform] duration-200 ease-spring hover:bg-elevated hover:text-ink active:scale-[0.96]"
          >
            <RotateCcw size={16} aria-hidden="true" />
            15
          </button>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="grid size-14 place-items-center rounded-full bg-brand text-on-brand shadow-[0_10px_24px_-14px_var(--primary)] transition-transform duration-200 ease-spring active:scale-[0.96]"
            aria-label={t(playing ? 'home.pause' : 'home.play')}
          >
            {playing ? <Pause /> : <Play />}
          </button>
          <button
            type="button"
            aria-label="Tiến 15 giây"
            onClick={() => seek(15)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold text-muted transition-[background-color,color,transform] duration-200 ease-spring hover:bg-elevated hover:text-ink active:scale-[0.96]"
          >
            15
            <RotateCw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  )
}

const featureTones = {
  rose: ['text-rose-strong', 'bg-rose/14 text-rose-strong', Castle],
  orange: ['text-orange-strong', 'bg-orange/16 text-orange-strong', BookOpen],
  green: ['text-brand-strong', 'bg-brand/12 text-brand-strong', Headphones],
}

/* Featured bento: the editor's pick takes 6 columns with its picks, the other two take 3 each. */
function Featured() {
  const { t } = useLocale()
  const resource = useMockResource('home:featured', featuredStories)
  return (
    <section className={band}>
      <div className="col-span-12">
        <SectionTitle>{t('home.featured')}</SectionTitle>
      </div>
      {resource.status === 'loading' ? (
        <div
          aria-busy="true"
          aria-label="Đang tải tuyển chọn nổi bật"
          className={`${band} gap-y-4 lg:gap-y-6`}
        >
          {featuredStories.map((item, index) => (
            <div
              key={item.title}
              aria-hidden="true"
              className={
                index === 0
                  ? 'col-span-12 @4xl:col-span-6'
                  : 'col-span-12 @2xl:col-span-6 @4xl:col-span-3'
              }
            >
              <Card
                as="div"
                className={`flex h-full min-h-56 gap-6 ${index === 0 ? 'p-6 sm:p-8' : ''}`}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <Skeleton className="h-3 w-28" />
                  <span className={`mt-3 flex items-center ${index === 0 ? 'h-8' : 'h-7'}`}>
                    <Skeleton className={`w-3/4 ${index === 0 ? 'h-6' : 'h-5'}`} />
                  </span>
                  <span className="mt-2 flex max-w-[42ch] flex-col gap-3 py-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </span>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <Skeleton className="h-4 w-20" />
                    {index !== 0 && <Skeleton className="size-12 shrink-0 rounded-2xl" />}
                  </div>
                </div>
                {index === 0 && (
                  <div className="hidden w-[42%] max-w-64 shrink-0 grid-cols-3 items-end gap-2 sm:grid">
                    {[0, 1, 2].map(cover => (
                      <Skeleton
                        key={cover}
                        className={`aspect-[2/3] w-full rounded-2xl ${cover === 1 ? '-translate-y-4' : ''}`}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      ) : resource.status !== 'ready' ? (
        <BandState
          resource={resource}
          errorTitle="Không tải được tuyển chọn nổi bật"
          emptyTitle="Ban biên tập đang chuẩn bị tuyển chọn mới"
          emptyDescription="Trong lúc chờ, hãy xem những truyện đang thịnh hành trên bảng xếp hạng."
          emptyAction={
            <ButtonLink to="/rankings" size="sm" trailingIcon={ArrowRight}>
              Xem bảng xếp hạng
            </ButtonLink>
          }
        />
      ) : (
        <div className={`${band} gap-y-4 lg:gap-y-6`}>
          {resource.data.map((item, index) => {
            const [labelTone, tileTone, Icon] = featureTones[item.tone] || featureTones.green
            const lead = index === 0
            return (
              <Reveal
                key={item.title}
                delay={stagger(index)}
                className={
                  lead
                    ? 'col-span-12 @4xl:col-span-6'
                    : 'col-span-12 @2xl:col-span-6 @4xl:col-span-3'
                }
              >
                <Card
                  as={Link}
                  to="/search"
                  interactive
                  className={`group flex h-full min-h-56 gap-6 whitespace-normal ${lead ? 'p-6 sm:p-8' : ''}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-[.14em] ${labelTone}`}
                    >
                      {item.label}
                    </span>
                    <h3 className={`mt-3 text-balance ${lead ? 'text-h2' : 'text-h3'}`}>
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-[42ch] text-sm leading-6 text-muted">
                      {item.description}
                    </p>
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
                        {t('navigation.explore')}
                        <ArrowRight
                          size={14}
                          aria-hidden="true"
                          className="transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                        />
                      </span>
                      {!lead && (
                        <span
                          className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tileTone}`}
                        >
                          <Icon size={24} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </div>
                  {lead && (
                    <div
                      aria-hidden="true"
                      className="hidden w-[42%] max-w-64 shrink-0 grid-cols-3 items-end gap-2 sm:grid"
                    >
                      {stories.slice(0, 3).map((story, cover) => (
                        <StoryCover
                          key={story.id}
                          story={story}
                          className={`aspect-[2/3] w-full rounded-2xl border border-hairline shadow-soft transition-transform duration-[420ms] ease-spring ${cover === 1 ? '-translate-y-4 group-hover:-translate-y-6' : 'group-hover:-translate-y-1'}`}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              </Reveal>
            )
          })}
        </div>
      )}
    </section>
  )
}

function JoinCta() {
  const { t } = useLocale()
  return (
    <Reveal className={band}>
      <Card
        as="section"
        bezel
        className={band}
        innerClassName={`nh-join-motif ${band} overflow-hidden p-0`}
      >
        <div className="relative col-span-12 p-7 sm:p-10 @4xl:col-span-8 lg:p-12">
          <h2 className="text-h2 text-rose-strong">{t('home.joinTitle')}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted">{t('home.joinDescription')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/register" trailingIcon={ArrowRight}>
              {t('home.createAccount')}
            </ButtonLink>
            <ButtonLink to="/join" variant="secondary">
              {t('home.learnMore')}
            </ButtonLink>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative col-span-4 m-2 hidden place-items-center rounded-[calc(var(--radius-bezel)-var(--bezel-gap)-0.5rem)] bg-brand-soft @4xl:grid"
        >
          <div className="flex items-end gap-4 text-brand-strong">
            <BookOpen size={64} />
            <Headphones size={44} className="text-orange-strong" />
            <Leaf size={48} />
          </div>
        </div>
      </Card>
    </Reveal>
  )
}

function Trending() {
  const { t } = useLocale()
  const resource = useMockResource('home:trending', stories)
  return (
    <section className={band}>
      <div className="col-span-12">
        <SectionTitle to="/rankings">{t('home.trending')}</SectionTitle>
      </div>
      {resource.status === 'loading' ? (
        <div aria-busy="true" aria-label="Đang tải truyện thịnh hành" className={`${band} gap-y-8`}>
          {stories.map(story => (
            <div key={story.id} className="col-span-6 @2xl:col-span-4 @5xl:col-span-2">
              <StoryCardSkeleton />
            </div>
          ))}
        </div>
      ) : resource.status !== 'ready' ? (
        <BandState
          resource={resource}
          errorTitle="Không tải được truyện thịnh hành"
          emptyTitle="Chưa có truyện thịnh hành"
          emptyDescription="Bảng thịnh hành sẽ cập nhật khi có thêm lượt đọc. Hãy khám phá theo thể loại."
          emptyAction={
            <ButtonLink to="/categories" size="sm" trailingIcon={ArrowRight}>
              Khám phá thể loại
            </ButtonLink>
          }
        />
      ) : (
        <div className={`${band} gap-y-8`}>
          {resource.data.map((story, index) => (
            <Reveal
              key={story.id}
              delay={stagger(index)}
              className="col-span-6 @2xl:col-span-4 @5xl:col-span-2"
            >
              <StoryCard story={story} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}

export function GuestHomePage({ embedded = false }) {
  const Root = embedded ? 'div' : 'main'
  return (
    <div className="@container min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public grid grid-cols-12 gap-x-4 gap-y-14 pb-20 pt-4 sm:pt-6 md:gap-y-16 lg:gap-x-6 lg:gap-y-20">
        <Hero />
        <Trending />
        <Categories />
        <div className={`${band} gap-y-4 lg:gap-y-6`}>
          <Reveal className="col-span-12 @4xl:col-span-7 @4xl:row-span-2">
            <ReaderPreview />
          </Reveal>
          <Reveal delay={80} className="col-span-12 @2xl:col-span-6 @4xl:col-span-5">
            <AudioPreview />
          </Reveal>
          <Reveal delay={160} className="col-span-12 @2xl:col-span-6 @4xl:col-span-5">
            <Card className="flex h-full flex-col justify-between gap-6 bg-elevated p-6 sm:p-8">
              <p className="text-xl font-medium italic leading-relaxed md:text-2xl">
                “Những câu chuyện hay làm ngày mai thêm tử tế.”
              </p>
              <p className="flex items-center gap-2 text-xs font-semibold text-ink/70">
                <Leaf size={14} aria-hidden="true" className="text-brand" />
                NovelHub
              </p>
            </Card>
          </Reveal>
        </div>
        <div className={`${band} gap-y-4 lg:gap-y-6`}>
          <Reveal className="col-span-12 @2xl:col-span-6">
            <ContinueCard />
          </Reveal>
          <Reveal delay={80} className="col-span-12 @2xl:col-span-6">
            <ContinueCard audio />
          </Reveal>
        </div>
        <Featured />
        {!embedded && <JoinCta />}
      </Root>
    </div>
  )
}
