import { useMemo, useState } from 'react'
import { BadgeDollarSign, BookOpen, CalendarDays, Coins, Save, UsersRound } from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Input, Select, Tabs } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

const periodData = {
  day: { buyers: 38, subscriptions: 7, coins: 1380, payout: 9.66, bars: [18, 28, 22, 45, 32, 58, 72] },
  week: { buyers: 246, subscriptions: 42, coins: 9620, payout: 67.34, bars: [42, 56, 48, 72, 63, 84, 76] },
  month: { buyers: 984, subscriptions: 168, coins: 41750, payout: 292.25, bars: [54, 61, 58, 76, 69, 88, 82] },
}

const sales = [
  ['The Silent Forest', 'Chương 16', 25, 184, 3220],
  ['The Silent Forest', 'Chương 15', 25, 143, 2502],
  ['Echoes of Eldoria', 'Chương 3', 20, 96, 1344],
]

export function AuthorEarningsPage() {
  const { t, formatNumber } = useLocale()
  const [period, setPeriod] = useState('month')
  const [story, setStory] = useState('silent-forest')
  const [chapterPrice, setChapterPrice] = useState(25)
  const [subscriptionPrice, setSubscriptionPrice] = useState(199)
  const [savedPrices, setSavedPrices] = useState({ chapterPrice: 25, subscriptionPrice: 199 })
  const data = periodData[period]
  const changed = chapterPrice !== savedPrices.chapterPrice || subscriptionPrice !== savedPrices.subscriptionPrice
  const projectedPayout = useMemo(() => data.payout * (period === 'day' ? 30 : period === 'week' ? 4.3 : 1), [data, period])

  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-orange">{t('authorFinance.eyebrow')}</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{t('authorFinance.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{t('authorFinance.description')}</p>
          </div>
          <Tabs value={period} onChange={setPeriod} items={[
            { value: 'day', label: t('authorFinance.today') },
            { value: 'week', label: t('authorFinance.thisWeek') },
            { value: 'month', label: t('authorFinance.thisMonth') },
          ]} />
        </header>

        <section className="nh-grid-12 mt-6 grid nh-cols-1 nh-sm-cols-2 gap-3 nh-xl-cols-4">
          <Metric icon={BookOpen} label={t('authorFinance.chapterBuyers')} value={formatNumber(data.buyers)} />
          <Metric icon={UsersRound} label={t('authorFinance.newSubscribers')} value={formatNumber(data.subscriptions)} tone="purple" />
          <Metric icon={Coins} label={t('authorFinance.coinsEarned')} value={formatNumber(data.coins)} tone="orange" />
          <Metric icon={BadgeDollarSign} label={t('authorFinance.netRevenue')} value={`$${data.payout.toFixed(2)}`} />
        </section>

        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="text-xl font-semibold">{t('authorFinance.revenueTrend')}</h2><p className="text-xs text-muted">{t('authorFinance.revenueTrendDescription')}</p></div>
                <Badge tone="green">{t('authorFinance.creatorShare')}</Badge>
              </div>
              <div className="mt-8 flex h-52 items-end gap-3 border-b border-line px-2">
                {data.bars.map((height, index) => <div key={index} className="flex-1 rounded-t-xl bg-orange/75" style={{ height: `${height}%` }} />)}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-muted">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{t(`authorFinance.days.${day.toLowerCase()}`)}</span>)}
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-line p-5"><h2 className="text-xl font-semibold">{t('authorFinance.salesByChapter')}</h2><p className="text-xs text-muted">{t('authorFinance.salesDescription')}</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-line bg-elevated text-[10px] uppercase text-muted"><tr><th className="px-5 py-3">{t('authorFinance.story')}</th><th>{t('authorFinance.chapter')}</th><th>{t('authorFinance.price')}</th><th>{t('authorFinance.buyers')}</th><th>{t('authorFinance.authorCoins')}</th></tr></thead>
                  <tbody className="divide-y divide-line">{sales.map(([title, chapter, price, buyers, coins]) => <tr key={`${title}-${chapter}`}><td className="px-5 py-4 font-semibold">{title}</td><td>{chapter}</td><td>{price} {t('wallet.coinUnit')}</td><td>{formatNumber(buyers)}</td><td className="font-semibold text-orange">+{formatNumber(coins)}</td></tr>)}</tbody>
                </table>
              </div>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="border-orange/40 bg-orange/10">
              <CalendarDays className="text-orange" />
              <p className="mt-4 text-xs text-muted">{t('authorFinance.estimatedPayout')}</p>
              <strong className="mt-1 block text-3xl">${projectedPayout.toFixed(2)}</strong>
              <p className="mt-2 text-xs leading-5 text-muted">{t('authorFinance.payoutDate')}</p>
            </Card>

            <Card>
              <h2 className="text-xl font-semibold">{t('authorFinance.pricingTitle')}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">{t('authorFinance.pricingDescription')}</p>
              <label className="mt-5 block text-xs font-semibold">{t('authorFinance.story')}</label>
              <Select className="mt-2 w-full" value={story} onChange={event => setStory(event.target.value)}><option value="silent-forest">The Silent Forest</option><option value="echoes">Echoes of Eldoria</option></Select>
              <label className="mt-4 block text-xs font-semibold">{t('authorFinance.chapterPrice')}</label>
              <Input className="mt-2" type="number" min="0" max="500" value={chapterPrice} onChange={event => setChapterPrice(Number(event.target.value))} />
              <p className="mt-2 text-[10px] text-muted">{t('authorFinance.priceHint')}</p>
              <label className="mt-4 block text-xs font-semibold">{t('authorFinance.subscriptionPrice')}</label>
              <Input className="mt-2" type="number" min="0" max="5000" value={subscriptionPrice} onChange={event => setSubscriptionPrice(Number(event.target.value))} />
              {changed && <div className="mt-5 flex gap-2"><Button variant="secondary" onClick={() => { setChapterPrice(savedPrices.chapterPrice); setSubscriptionPrice(savedPrices.subscriptionPrice) }}>{t('common.discard')}</Button><Button onClick={() => setSavedPrices({ chapterPrice, subscriptionPrice })}><Save size={15} />{t('common.saveChanges')}</Button></div>}
            </Card>
          </aside>
        </div>
      </main>
    </AuthorLayout>
  )
}

function Metric({ icon: Icon, label, value, tone = 'brand' }) {
  const color = tone === 'orange' ? 'text-orange' : tone === 'purple' ? 'text-purple' : 'text-brand'
  return <Card className="p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs text-muted">{label}</span><Icon size={18} className={color} /></div><strong className="mt-5 block text-2xl">{value}</strong></Card>
}
