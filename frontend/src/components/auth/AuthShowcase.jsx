import {
  BadgeDollarSign,
  BellRing,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Feather,
  Headphones,
  Library,
  NotebookPen,
  PenLine,
  ShieldCheck,
  Sparkles,
} from '../icons'
import { ProgressBar } from '../ui'
import { StoryCover } from '../story/StoryCover'
import { useLocale } from '../../context/LocaleContext'
const stories = [
  { id: 'silent-forest', title: 'The Silent Forest', author: 'Mira Lane', color: '#173b3f', icon: '🌲' },
  { id: 'whispers-of-you', title: 'Whispers of You', author: 'Elena J. Park', color: '#df8b79', icon: '🌅' },
  { id: 'neon-hearts', title: 'Neon Hearts', author: 'Kaito Min', color: '#34336f', icon: '🌃' },
  { id: 'dragons-wish', title: "A Dragon's Wish", author: 'Ren Park', color: '#9d744b', icon: '🐉' },
  { id: 'last-kingdom', title: 'The Last Kingdom', author: 'Aurora White', color: '#668ba3', icon: '🏰' },
  { id: 'your-story', title: 'Truyện của bạn', author: '', color: '#31584c', icon: '✦' },
]

const storyById = Object.fromEntries(stories.map(story => [story.id, story]))
const socialCovers = ['silent-forest', 'whispers-of-you', 'neon-hearts']

/*
 * Fan positions for md+ (x: % of one cover width, r: rotation, s: scale, order: flat-row slot
 * below md, outer: md+ only). Below md the covers render as a flat row: no rotation, no overlap.
 */
const loginFan = [
  { id: 'whispers-of-you', x: -62, r: -8, s: 0.9, z: 'z-0', order: 'order-1', lift: true },
  { id: 'neon-hearts', x: 62, r: 8, s: 0.9, z: 'z-0', order: 'order-3', lift: true },
  { id: 'silent-forest', x: 0, r: 0, s: 1, z: 'z-10', order: 'order-2', lift: true, lead: true },
]

const wideFan = center => [
  { id: 'dragons-wish', x: -100, r: -13, s: 0.8, z: 'z-0', outer: true },
  { id: 'last-kingdom', x: 100, r: 13, s: 0.8, z: 'z-0', outer: true },
  { id: 'whispers-of-you', x: -53, r: -8, s: 0.9, z: 'z-[1]', order: 'order-1', lift: true },
  { id: 'neon-hearts', x: 53, r: 8, s: 0.9, z: 'z-[1]', order: 'order-3', lift: true },
  { x: 0, r: 0, s: 1, z: 'z-10', order: 'order-2', lift: true, lead: true, ...center },
]

/*
 * md+: the stage is a size container. --cover (one cover width) scales with both the stage width
 * and height, so the cascade grows with the viewport instead of leaving a fixed-size island.
 * The frame hugs the fan so the floating cards stay anchored to the covers at every width.
 */
const loginStage = { '--cover': 'min(30cqw, 52cqh)', '--frame': 2.9 }
const wideStage = { '--cover': 'min(30cqw, 50cqh)', '--frame': 3.1 }

const tones = {
  brand: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
}

const readerBenefits = t => [
  { icon: BookOpen, text: t('auth.benefitLibrary'), tone: tones.brand },
  { icon: Headphones, text: t('auth.benefitListening'), tone: tones.orange },
  { icon: ShieldCheck, text: t('auth.benefitPublishing'), tone: tones.purple },
]

const variants = {
  login: {
    eyebrow: t => [Sparkles, t('auth.storiesTogether')],
    proof: t => ['3M+', t('home.readers').toLowerCase()],
    fan: () => loginFan,
    stage: loginStage,
    Floating: ContinueCard,
    title: t => t('auth.introLoginTitle'),
    description: t => t('auth.introDescription'),
    points: readerBenefits,
  },
  register: {
    eyebrow: t => [Sparkles, t('auth.storiesTogether')],
    proof: t => ['3M+', t('home.readers').toLowerCase()],
    fan: () => wideFan({ id: 'silent-forest' }),
    stage: wideStage,
    Floating: RoleCards,
    title: t => t('auth.introRegisterTitle'),
    description: t => t('auth.introDescription'),
    points: readerBenefits,
  },
  author: {
    eyebrow: () => [Feather, 'Studio tác giả'],
    proof: t => ['15K+', t('home.authors').toLowerCase()],
    fan: ({ authorName }) =>
      wideFan({ id: 'your-story', story: { title: 'Truyện của bạn', author: authorName } }),
    stage: wideStage,
    Floating: AuthorCards,
    title: () => 'Câu chuyện của bạn xứng đáng có độc giả.',
    description: () =>
      'Soạn chương, gửi kiểm duyệt và theo dõi doanh thu trong một Studio duy nhất.',
    ordered: true,
    points: () => [
      { icon: NotebookPen, text: 'Viết bản thảo và chương trong Studio', tone: tones.brand },
      { icon: ClipboardCheck, text: 'Kiểm duyệt viên xét duyệt từng truyện', tone: tones.orange },
      { icon: BadgeDollarSign, text: 'Xuất bản và nhận doanh thu', tone: tones.purple },
    ],
  },
}

/*
 * Presentational visual panel for the auth surfaces (/login, /register, /author/apply).
 * variant: 'login' | 'register' | 'author'. authorShare/authorName feed the author variant.
 */
export function AuthShowcase({ variant, authorShare, authorName, className = '' }) {
  const { t } = useLocale()
  const config = variants[variant] || variants.register
  const [EyebrowIcon, eyebrow] = config.eyebrow(t)
  const [proofValue, proofLabel] = config.proof(t)
  const List = config.ordered ? 'ol' : 'ul'

  return (
    <section
      aria-labelledby="auth-showcase-title"
      className={`relative isolate flex min-w-0 flex-col overflow-hidden rounded-[2rem] border border-hairline bg-brand-soft p-5 sm:p-7 lg:min-h-0 xl:p-9 ${className}`}
    >
      {/* Corner washes painted inside the panel box (no overhanging blurred layers to clip). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_100%_0%,color-mix(in_oklab,var(--accent-orange)_16%,transparent),transparent),radial-gradient(55%_45%_at_0%_100%,color-mix(in_oklab,var(--accent-purple)_12%,transparent),transparent)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="nh-eyebrow">
          <EyebrowIcon size={13} /> {eyebrow}
        </p>
        <div className="flex items-center gap-2.5 text-xs text-ink/70">
          <div aria-hidden="true" className="flex -space-x-2">
            {socialCovers.map(id => (
              <StoryCover
                key={id}
                story={storyById[id]}
                eager
                className="size-7 rounded-full ring-2 ring-surface"
              />
            ))}
          </div>
          <span>
            <strong className="font-bold text-ink">{proofValue}</strong> {proofLabel}
          </span>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={config.stage}
        className="group relative mt-5 [container-type:inline-size] md:h-72 md:[container-type:size] lg:h-auto lg:min-h-40 lg:flex-1"
      >
        <div className="flex justify-center gap-3 md:absolute md:left-1/2 md:top-1/2 md:block md:h-[calc(var(--cover)*1.62)] md:w-[min(100cqw,calc(var(--cover)*var(--frame)))] md:-translate-x-1/2 md:-translate-y-1/2">
          {config.fan({ authorName }).map(({ id, story, x, r, s, z, order, outer, lift, lead }) => (
            <div
              key={id}
              style={{ '--fan-x': `${x}%`, '--fan-r': `${r}deg`, '--fan-s': s }}
              className={`${outer ? 'hidden md:block' : order} w-[28%] max-w-28 md:absolute md:left-1/2 md:top-1/2 md:w-[var(--cover)] md:max-w-none md:[transform:translate(calc(var(--fan-x)_-_50%),-50%)_rotate(var(--fan-r))_scale(var(--fan-s))] ${z}`}
            >
              <div
                className={`transition-transform duration-700 ease-spring motion-reduce:transform-none ${
                  lift ? (lead ? 'group-hover:-translate-y-2.5' : 'group-hover:-translate-y-1') : ''
                }`}
              >
                <StoryCover
                  story={story || storyById[id]}
                  eager
                  className="aspect-[2/3] w-full rounded-2xl shadow-float ring-1 ring-ink/5"
                />
              </div>
            </div>
          ))}

          <config.Floating t={t} authorShare={authorShare} />
        </div>
      </div>

      <div className="mt-6 lg:mt-7">
        <h2
          id="auth-showcase-title"
          className="max-w-[22ch] text-2xl font-bold leading-[1.15] tracking-[-0.03em] sm:text-[2rem] xl:text-[2.5rem] xl:leading-[1.08] 2xl:text-[3rem]"
        >
          {config.title(t)}
        </h2>
        <p className="mt-3 max-w-[52ch] text-sm leading-6 text-ink/70 sm:text-base">
          {config.description(t)}
        </p>
        <List className="mt-5 grid gap-3 border-t border-hairline pt-5 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 xl:gap-4">
          {config.points(t).map(({ icon: Icon, text, tone }, index) => (
            <li key={text} className="flex items-center gap-3 xl:items-start">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-2xl ${tone}`}
                aria-hidden="true"
              >
                <Icon size={17} />
              </span>
              <span className="text-sm leading-5 text-ink/80">
                {config.ordered && (
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/60">
                    Bước {index + 1}
                  </span>
                )}
                {text}
              </span>
            </li>
          ))}
        </List>
      </div>
    </section>
  )
}

function ContinueCard({ t }) {
  return (
    <>
      <div className="absolute bottom-0 left-0 z-20 hidden w-64 max-w-[60cqw] -translate-x-[28%] items-center gap-3 rounded-3xl border border-hairline bg-surface p-3 shadow-float md:flex">
        <StoryCover
          story={storyById['silent-forest']}
          eager
          className="aspect-[2/3] w-11 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-strong">
            {t('readerHome.continueReading')}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">The Silent Forest</p>
          <p className="truncate text-xs text-muted">Chương 12 · còn 9 phút</p>
          <ProgressBar value={68} size="sm" className="mt-2" label="Tiến độ đọc" />
        </div>
      </div>
      <span className="absolute right-0 top-[6%] z-20 hidden translate-x-1/4 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-orange-strong shadow-soft md:inline-flex">
        <BellRing size={14} /> 3 chương mới
      </span>
    </>
  )
}

function RoleCards({ t }) {
  return (
    <>
      <FloatingCard
        icon={Library}
        tone="bg-brand text-on-brand"
        title={t('auth.reader')}
        text={t('auth.readerDescription')}
        className="left-0 top-0"
      />
      <FloatingCard
        icon={PenLine}
        tone="bg-purple text-on-purple"
        title={t('auth.author')}
        text="Xuất bản và nhận 80% doanh thu"
        className="bottom-0 right-0"
      />
    </>
  )
}

function AuthorCards({ authorShare, t }) {
  return (
    <>
      <FloatingCard
        icon={BadgeDollarSign}
        tone="bg-orange text-on-orange"
        title={authorShare == null ? t('authorAccess.revenueTitle') : `${authorShare}% doanh thu`}
        text={
          authorShare == null ? t('authorAccess.revenueHint') : 'Phần của tác giả từ chương trả phí'
        }
        className="left-0 top-0"
      />
      <FloatingCard
        icon={CheckCircle2}
        tone="bg-brand text-on-brand"
        title="Đã được duyệt"
        text="Chương 1 · sẵn sàng xuất bản"
        className="bottom-0 right-0"
      />
    </>
  )
}

function FloatingCard({ icon: Icon, tone, title, text, className }) {
  return (
    <div
      className={`absolute z-20 hidden w-60 max-w-[46%] items-start gap-3 rounded-3xl border border-hairline bg-surface p-3 shadow-float md:flex ${className}`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-2xl ${tone}`}>
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <strong className="block text-sm">{title}</strong>
        {/* Short stages (laptop heights): title only, so the card never buries the covers. */}
        <span className="mt-0.5 hidden text-xs leading-4 text-muted [@container(min-height:15rem)]:block">
          {text}
        </span>
      </span>
    </div>
  )
}
