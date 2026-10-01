import { useMemo, useState } from 'react'
import { BookOpen, Download, Flame, Headphones, Play, RotateCcw, Trash2 } from 'lucide-react'
import { ReaderLayout } from '../../layouts'
import { Badge, Button, Card, Tabs } from '../../components/ui'
import { libraryItems } from '../../data/mock/reader'
import { useLocale } from '../../context/LocaleContext'

const metrics = [
  ['history.storiesProgress', '6', 'history.activeStories', BookOpen],
  ['history.chaptersMonth', '84', 'history.vsLastMonth', BookOpen],
  ['history.audioHours', '26.5', 'history.hours', Headphones],
  ['history.streak', '18', 'history.consecutiveDays', Flame],
]
const weekly = [32, 48, 24, 51, 41, 49, 46]
const genres = [
  ['Fantasy & Mythic', 45, 'bg-brand'],
  ['Romance & Drama', 25, 'bg-orange'],
  ['Mystery & Thriller', 18, 'bg-purple'],
  ['Sci-Fi & Cyberpunk', 12, 'bg-[#985016]'],
]
const historyItems = [
  { ...libraryItems[0], when: 'Read 20m ago', duration: '35 mins reading time' },
  { ...libraryItems[1], when: 'Audio session · 2h ago', duration: '20 mins listening time' },
  { ...libraryItems[2], when: 'Read yesterday 21:15', duration: '42 mins reading time' },
  { ...libraryItems[4], when: 'Read yesterday 14:30', duration: '28 mins reading time' },
  { ...libraryItems[3], when: 'Finished Thursday', duration: '1hr 15m session' },
]

export function ReadingHistoryPage() {
  const { t } = useLocale()
  const [tab, setTab] = useState('reading')
  const [period, setPeriod] = useState('week')
  const [items, setItems] = useState(historyItems)
  const visible = useMemo(
    () =>
      tab === 'listening'
        ? items.filter(i => i.type === 'audio')
        : tab === 'completed'
          ? items.filter(i => i.progress === 100)
          : items,
    [items, tab],
  )
  return (
    <ReaderLayout>
      <main className="page-reader py-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[.2em] text-brand">
              {t('history.eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {t('history.title')}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setItems([])}>
              <Trash2 size={15} />
              {t('history.clear')}
            </Button>
            <Button onClick={() => window.alert('Reading history export prepared (mock).')}>
              <Download size={15} />
              {t('history.export')}
            </Button>
          </div>
        </div>
        <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {metrics.map(([title, value, detail, Icon]) => (
            <Card key={title} className="p-4">
              <div className="flex justify-between gap-2">
                <p className="text-xs text-muted">{t(title)}</p>
                <Icon
                  size={18}
                  className={title === 'history.streak' ? 'text-orange' : 'text-brand'}
                />
              </div>
              <p className="mt-3 text-2xl font-bold">
                {value} <span className="text-xs font-normal text-muted">{t(detail)}</span>
              </p>
            </Card>
          ))}
        </section>
        <div className="mt-6 overflow-x-auto">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'reading', label: t('history.readingTab', { count: 34 }) },
              { value: 'listening', label: t('history.listeningTab', { count: 12 }) },
              { value: 'completed', label: t('history.completedTab', { count: 19 }) },
            ]}
          />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-6">
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{t('history.weeklyMinutes')}</h2>
                  <p className="text-xs text-muted">
                    {t('history.weeklyTarget')}
                  </p>
                </div>
                <div className="flex rounded-xl border border-line p-1">
                  <button
                    onClick={() => setPeriod('week')}
                    className={`rounded-lg px-3 py-1 text-xs ${period === 'week' ? 'bg-brand text-white' : ''}`}
                  >
                    {t('history.thisWeek')}
                  </button>
                  <button
                    onClick={() => setPeriod('last')}
                    className={`rounded-lg px-3 py-1 text-xs ${period === 'last' ? 'bg-brand text-white' : ''}`}
                  >
                    {t('history.lastWeek')}
                  </button>
                </div>
              </div>
              <div className="mt-7 flex h-40 items-end justify-between gap-3">
                {weekly.map((value, index) => (
                  <div className="flex h-full flex-1 flex-col justify-end" key={index}>
                    <div
                      className={`mx-auto w-full max-w-10 rounded-t-md ${index === 3 || index === 6 ? 'bg-brand' : 'bg-brand/55'}`}
                      style={{ height: `${period === 'week' ? value * 2 : value * 1.55}px` }}
                    />
                    <span className="mt-2 text-center text-[10px] text-muted">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-sm font-semibold">{t('history.recentSessions')}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-[10px] text-muted">{t('history.sessions', { count: visible.length })}</span>
              </div>
              <div className="space-y-3">
                {visible.map(item => (
                  <Card key={`${item.id}-${item.when}`} className="flex items-center gap-4 p-4">
                    <div
                      className="grid h-24 w-16 shrink-0 place-items-center rounded-xl text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      NH
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex gap-2">
                        <Badge tone={item.type === 'audio' ? 'orange' : 'green'}>
                          {t(item.type === 'audio' ? 'history.audio' : 'history.story')}
                        </Badge>
                        <span className="text-[10px] text-muted">{item.when}</span>
                      </div>
                      <h3 className="mt-2 truncate font-semibold">{item.title}</h3>
                      <p className="text-xs text-muted">
                        {t('history.byAuthor', { author: item.author })} · {item.detail}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-1.5 flex-1 rounded-full bg-elevated">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-brand">{t('history.finished', { progress: item.progress })}</span>
                      </div>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="mb-3 text-[10px] text-muted">{item.duration}</p>
                      <Button onClick={() => window.location.assign('/stories/demo')} className="min-h-9 px-3 py-1 text-xs">
                        {item.progress === 100 ? <RotateCcw size={14} /> : <Play size={14} />}{' '}
                        {t(item.progress === 100 ? 'history.reread' : 'history.resume')}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </div>
          <aside className="space-y-5">
            <Card>
              <h2 className="text-xl font-semibold">{t('history.genreAffinity')}</h2>
              <p className="text-xs text-muted">{t('history.genreDescription')}</p>
              <div className="mt-5 flex h-2 overflow-hidden rounded-full">
                {genres.map(([, value, color]) => (
                  <span key={color} className={color} style={{ width: `${value}%` }} />
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {genres.map(([label, value, color]) => (
                  <div className="flex items-center text-xs" key={label}>
                    <span className={`mr-2 size-2 rounded-full ${color}`} />
                    <span className="flex-1 text-muted">{label}</span>
                    <strong>{value}%</strong>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t('history.monthlyTarget')}</h2>
                <span className="text-xs text-brand">84 / 100 ch</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-elevated">
                <div className="h-full w-[84%] rounded-full bg-brand" />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">
                {t('history.targetDescription')}
              </p>
            </Card>
            <Card className="bg-elevated">
              <p className="text-lg italic leading-7">“Good stories make a kinder tomorrow.”</p>
              <p className="mt-4 text-xs text-muted">— NovelHub Curator Notes</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t('history.activeSync')}</h2>
                <Badge tone="green">{t('history.connected')}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted">
                <p>
                  ▣ Trình đọc MacBook Pro <span className="float-right">Đang hoạt động</span>
                </p>
                <p>
                  ▯ iPhone 15 Pro <span className="float-right">Đồng bộ 2 giờ trước</span>
                </p>
                <p>
                  ▭ Kindle PaperWhite <span className="float-right">Hôm qua</span>
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </ReaderLayout>
  )
}
