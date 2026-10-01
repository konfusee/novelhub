import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Heart,
  Pause,
  Play,
} from 'lucide-react'
import { categories } from '../../data/mock/categories'
import { featuredStories, stories } from '../../data/mock/stories'
import { PublicHeader } from '../../components/public/PublicHeader'
import { StoryCard } from '../../components/public/StoryCard'
import { SectionTitle } from '../../components/public/SectionTitle'
import { Button, Card } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

function Hero() {
  const { t } = useLocale()
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="grid lg:grid-cols-[1.02fr_.98fr]">
        <div className="p-7 sm:p-10 lg:p-12">
          <p className="text-[11px] font-semibold tracking-[.28em] text-muted">
            {t('home.eyebrow')}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-[-.04em] sm:text-5xl lg:text-[54px]">
            {t('home.heroLineOne')}<br />
            <span className="text-brand">{t('home.heroHighlight')}</span> {t('home.heroLineTwo')}
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-muted sm:text-base">
            {t('home.heroDescription')}
          </p>
          <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button onClick={() => window.location.assign('/search')}>
              {t('home.exploreStories')} <ArrowRight size={16} />
            </Button>
            <Button onClick={() => window.location.assign('/search?format=audio')} variant="secondary">
              <Headphones size={16} /> {t('home.startListening')}
            </Button>
          </div>
          <div className="mt-9 grid grid-cols-2 gap-5 border-t border-line pt-6 sm:grid-cols-4">
            {[
              ['3M+', t('home.readers')],
              ['100K+', t('home.stories')],
              ['15K+', t('home.authors')],
              ['4.8 ★', t('home.userRating')],
            ].map(([value, label]) => (
              <div key={label}>
                <strong className="text-xl">{value}</strong>
                <span className="mt-1 block text-[11px] text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="nh-hero-art relative min-h-80 overflow-hidden bg-elevated p-7 lg:min-h-full">
          <div className="absolute left-8 top-8 text-6xl opacity-70">🌿</div>
          <div className="absolute right-8 top-8 rotate-[-6deg] text-right text-sm font-medium italic text-muted">
            A kinder world
            <br />
            through stories <span className="text-rose">♥</span>
          </div>
          <div className="absolute inset-x-4 bottom-14 flex items-end justify-center sm:inset-x-8">
            <div className="relative h-40 w-72 max-w-full">
              <div className="absolute bottom-0 left-3 h-11 w-60 max-w-[78%] -rotate-2 rounded-lg border border-line bg-[#bd9470] px-5 py-3 text-[10px] tracking-widest text-white">
                TRUYỆN DỊU DÀNG
              </div>
              <div className="absolute bottom-10 left-8 h-11 w-56 max-w-[76%] rotate-1 rounded-lg border border-line bg-brand px-5 py-3 text-[10px] tracking-widest text-white">
                NGÀY MAI TƯƠI SÁNG
              </div>
              <div className="absolute bottom-20 left-5 h-10 w-48 max-w-[72%] -rotate-1 rounded-lg border border-line bg-[#d8c7b4] px-5 py-3 text-[10px] tracking-widest text-[#55483f]">
                TRUYỆN NOVELHUB
              </div>
              <div className="absolute bottom-0 right-0 grid h-24 w-20 place-items-center rounded-b-2xl rounded-t-md border-2 border-line bg-surface text-center text-[9px] font-semibold leading-3 text-brand">
                TRUYỆN
                <br />
                HAY
                <br />
                <span className="text-orange">TƯƠI SÁNG</span>
                <br />
                MỖI NGÀY
              </div>
            </div>
          </div>
          <div className="absolute bottom-5 left-7 flex gap-2">
            <span className="size-2 rounded-full bg-brand" />
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
          </div>
          <div className="absolute bottom-4 right-7 flex gap-2">
            <button onClick={() => window.alert('Đã chọn truyện nổi bật trước đó (mô phỏng).')} className="grid size-8 place-items-center rounded-full border border-line bg-surface">
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => window.alert('Đã chọn truyện nổi bật tiếp theo (mô phỏng).')} className="grid size-8 place-items-center rounded-full border border-line bg-surface">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Categories() {
  const { t } = useLocale()
  return (
    <section>
      <SectionTitle>{t('home.browseCategory')}</SectionTitle>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {categories.map(category => (
          <button
            onClick={() => window.location.assign(`/categories?genre=${encodeURIComponent(category.name)}`)}
            className="rounded-2xl border border-line bg-surface px-2 py-4 text-center hover:border-brand"
            key={category.name}
          >
            <span className="block text-2xl">{category.icon}</span>
            <span className="mt-2 block truncate text-[11px] font-medium">{t(`genres.${category.name.toLowerCase().replaceAll(' ', '').replace('-', '')}`)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ContinueCard({ audio = false }) {
  const { t } = useLocale()
  return (
    <Card className="flex gap-4 p-4">
      <div
        className="grid aspect-[3/4] w-20 shrink-0 place-items-center rounded-xl text-3xl text-white"
        style={{ backgroundColor: audio ? '#df8b79' : '#173b3f' }}
      >
        {audio ? '🌅' : '🌲'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-xs font-medium text-brand">
          <span>{t(audio ? 'home.continueListening' : 'home.continueReading')}</span>
          <span>{audio ? '32%' : '68%'}</span>
        </div>
        <h3 className="mt-2 truncate font-semibold">
          {audio ? 'Whispers of You' : 'The Silent Forest'}
        </h3>
        <p className="mt-1 truncate text-xs text-muted">
          {audio ? 'Chương 5 · The Letter' : 'Chương 12 · A New Beginning'}
        </p>
        <div className="my-3 h-1.5 overflow-hidden rounded-full bg-elevated">
          <div className={audio ? 'h-full w-[32%] bg-orange' : 'h-full w-[68%] bg-brand'} />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.assign(audio ? '/listen/demo/chapter-1' : '/stories/demo')} className="min-h-9 flex-1 px-3 py-2 text-xs">
            {audio ? <Headphones size={14} /> : <BookOpen size={14} />} {t('common.continue')}
          </Button>
          <button
            onClick={() => window.alert('Đã cập nhật đánh dấu truyện (mô phỏng).')}
            aria-label={t('story.bookmark')}
            className="grid size-9 place-items-center rounded-xl border border-line"
          >
            <Bookmark size={15} />
          </button>
        </div>
      </div>
    </Card>
  )
}

function ReaderPreview() {
  const { t } = useLocale()
  const [fontSize, setFontSize] = useState(14)
  const [spacing, setSpacing] = useState(1.8)
  return (
    <Card className="nh-audio-motif overflow-hidden p-5">
      <h3 className="font-bold">{t('home.readerPreview')}</h3>
      <div className="mt-4">
        <h4 className="font-semibold">The Silent Forest</h4>
        <p className="text-xs text-muted">Chương 1 · The Whispering Trees</p>
      </div>
      <div
        className="mt-4 rounded-2xl border border-line bg-reader p-4 text-ink"
        style={{ fontSize, lineHeight: spacing }}
      >
        <p>
          The wind moved gently through the ancient trees, carrying whispers of forgotten stories.
          In that quiet moment, everything felt possible. She closed her eyes and listened — not
          just to the forest, but to her own heartbeat.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs">
        <span className="text-muted">{t('settings.tabs.appearance')}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setFontSize(Math.max(12, fontSize - 1))}
            className="rounded-lg border border-line px-2 py-1"
          >
            Aa−
          </button>
          <span className="rounded-lg border border-line px-2 py-1">{fontSize}</span>
          <button
            onClick={() => setFontSize(Math.min(19, fontSize + 1))}
            className="rounded-lg border border-line px-2 py-1"
          >
            Aa+
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted">{t('settings.reading.lineSpacing')}</span>
        <div className="flex gap-1">
          {[1.5, 1.8, 2.1].map(value => (
            <button
              key={value}
              onClick={() => setSpacing(value)}
              className={`rounded-lg border px-2 py-1 ${spacing === value ? 'border-brand text-brand' : 'border-line'}`}
            >
              ≡
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}

function AudioPreview() {
  const { t } = useLocale()
  const [playing, setPlaying] = useState(true)
  const [liked, setLiked] = useState(false)
  return (
    <Card className="p-5">
      <h3 className="font-bold">{t('home.audioPreview')}</h3>
      <div className="mt-5 flex items-center gap-3">
        <div className="grid size-14 place-items-center rounded-xl bg-orange/20 text-2xl">🌅</div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold">Whispers of You</h4>
          <p className="text-xs text-muted">Elena J. Park</p>
        </div>
        <button onClick={() => setLiked(!liked)} aria-label={t('home.favorite')}>
          <Heart className={liked ? 'fill-rose text-rose' : 'text-muted'} size={20} />
        </button>
      </div>
      <div className="mt-5 h-1.5 rounded-full bg-elevated">
        <div className="h-full w-[28%] rounded-full bg-brand" />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>02:18</span>
        <span>10:24</span>
      </div>
      <div className="mt-4 flex items-center justify-around">
        <button onClick={() => window.alert('Đã lùi 15 giây (mô phỏng).')} className="text-xs text-muted">↺ 15</button>
        <button
          onClick={() => setPlaying(!playing)}
          className="grid size-14 place-items-center rounded-full bg-brand text-white"
          aria-label={t(playing ? 'home.pause' : 'home.play')}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <button onClick={() => window.alert('Đã tiến 15 giây (mô phỏng).')} className="text-xs text-muted">15 ↻</button>
      </div>
    </Card>
  )
}

export function GuestHomePage({ embedded = false }) {
  const { t } = useLocale()
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <main className="page-public space-y-8 py-6">
        <Hero />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <section>
              <SectionTitle>{t('home.trending')}</SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {stories.map(story => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </section>
            <Categories />
            <section className="grid gap-4 md:grid-cols-2">
              <ContinueCard />
              <ContinueCard audio />
            </section>
            <section>
              <SectionTitle>{t('home.featured')}</SectionTitle>
              <div className="grid gap-4 md:grid-cols-3">
                {featuredStories.map(item => (
                  <Card key={item.title} className="flex min-h-48 flex-col p-5">
                    <span className="text-[10px] font-semibold tracking-wide text-rose">
                      {item.label}
                    </span>
                    <h3 className="mt-3 text-lg font-semibold leading-tight">{item.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted">{item.description}</p>
                    <div className="mt-auto flex items-end justify-between">
                      <button onClick={() => window.location.assign('/search')} className="text-xs font-semibold text-brand">{t('navigation.explore')} →</button>
                      <span className="text-3xl">{item.icon}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
            <section className="nh-join-motif flex flex-col justify-between gap-6 overflow-hidden rounded-3xl border border-line bg-surface p-7 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-2xl font-bold text-rose">{t('home.joinTitle')}</h2>
                <p className="mt-2 max-w-lg text-sm text-muted">
                  {t('home.joinDescription')}
                </p>
                <div className="mt-5 flex gap-3">
                  <Button onClick={() => window.location.assign('/register')}>{t('home.createAccount')}</Button>
                  <Button onClick={() => window.location.assign('/')} variant="secondary">{t('home.learnMore')}</Button>
                </div>
              </div>
              <div className="text-7xl">📚🌿</div>
            </section>
          </div>
          <aside className="space-y-5">
            <ReaderPreview />
            <AudioPreview />
            <Card className="bg-elevated">
              <p className="text-2xl font-medium italic leading-relaxed">
                “Những câu chuyện hay làm ngày mai thêm tử tế.”
              </p>
              <p className="mt-5 text-xs text-muted">— NovelHub</p>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}
