import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  CalendarDays,
  Coins,
  RefreshCw,
  Save,
  UsersRound,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { ROUTES } from '../../app/routes';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';

const earningsData = {
  periods: {
    day: {
      buyers: 38,
      subscriptions: 7,
      coins: 1380,
      payout: 9.66,
      bars: [18, 28, 22, 45, 32, 58, 72],
    },
    week: {
      buyers: 246,
      subscriptions: 42,
      coins: 9620,
      payout: 67.34,
      bars: [42, 56, 48, 72, 63, 84, 76],
    },
    month: {
      buyers: 984,
      subscriptions: 168,
      coins: 41750,
      payout: 292.25,
      bars: [54, 61, 58, 76, 69, 88, 82],
    },
  },
  sales: [
    ['The Silent Forest', 'Chương 16', 25, 184, 3220],
    ['The Silent Forest', 'Chương 15', 25, 143, 2502],
    ['Echoes of Eldoria', 'Chương 3', 20, 96, 1344],
  ],
};
const isEarningsEmpty = (value) => value.sales.length === 0;
const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
/* Fixed, varied bar heights (%) for the revenue chart skeleton, one per weekday. */
const revenueSkeletonBars = [48, 66, 54, 78, 62, 88, 72];

const toPrice = (value) => Math.max(0, Number(value) || 0);

export function AuthorEarningsPage() {
  const { t, formatNumber } = useLocale();
  const [period, setPeriod] = useState('month');
  const [story, setStory] = useState('silent-forest');
  const [chapterPrice, setChapterPrice] = useState(25);
  const [subscriptionPrice, setSubscriptionPrice] = useState(199);
  const [savedPrices, setSavedPrices] = useState({ chapterPrice: 25, subscriptionPrice: 199 });
  const earnings = useMockResource(`author:earnings:${period}`, earningsData, {
    isEmpty: isEarningsEmpty,
  });
  const loading = earnings.status === 'loading';
  const hasData = loading || earnings.status === 'ready';
  const data = earnings.data.periods[period];
  const sales = earnings.data.sales;
  const changed =
    chapterPrice !== savedPrices.chapterPrice ||
    subscriptionPrice !== savedPrices.subscriptionPrice;
  const projectedPayout = useMemo(
    () => data.payout * (period === 'day' ? 30 : period === 'week' ? 4.3 : 1),
    [data, period],
  );
  const peak = Math.max(...data.bars);
  const metrics = [
    { icon: BookOpen, label: t('authorFinance.chapterBuyers'), value: formatNumber(data.buyers) },
    {
      icon: UsersRound,
      label: t('authorFinance.newSubscribers'),
      value: formatNumber(data.subscriptions),
      tone: 'purple',
    },
    {
      icon: Coins,
      label: t('authorFinance.coinsEarned'),
      value: formatNumber(data.coins),
      tone: 'orange',
    },
    {
      icon: BadgeDollarSign,
      label: t('authorFinance.netRevenue'),
      value: `$${data.payout.toFixed(2)}`,
    },
  ];

  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="nh-eyebrow">{t('authorFinance.eyebrow')}</p>
            <h1 className="mt-3 text-h2 sm:text-h1">{t('authorFinance.title')}</h1>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">
              {t('authorFinance.description')}
            </p>
          </div>
          <div className="shrink-0">
            <Tabs
              singleRow
              value={period}
              onChange={setPeriod}
              items={[
                { value: 'day', label: t('authorFinance.today') },
                { value: 'week', label: t('authorFinance.thisWeek') },
                { value: 'month', label: t('authorFinance.thisMonth') },
              ]}
            />
          </div>
        </header>

        {loading ? (
          <section
            aria-busy="true"
            aria-label="Đang tải chỉ số doanh thu"
            className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4"
          >
            {metrics.map((metric) => (
              <MetricSkeleton key={`metric-skeleton-${metric.label}`} label={metric.label} />
            ))}
          </section>
        ) : earnings.status === 'ready' ? (
          <section className="nh-fade-enter mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {metrics.map((metric) => (
              <Metric key={metric.label} {...metric} />
            ))}
          </section>
        ) : null}

        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            {earnings.status === 'error' ? (
              <Card className="p-0">
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được dữ liệu doanh thu"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={earnings.retry} />}
                />
              </Card>
            ) : earnings.status === 'empty' ? (
              <Card className="p-0">
                <EmptyState
                  icon={Coins}
                  title="Chưa có doanh thu"
                  description="Doanh thu từ chương trả phí và lượt đăng ký sẽ xuất hiện khi độc giả mua chương đầu tiên. Hãy đặt giá chương trong phần thiết lập giá."
                  action={
                    <ButtonLink to={ROUTES.authorStory('demo')} size="sm" trailingIcon={ArrowRight}>
                      Quản lý chương trả phí
                    </ButtonLink>
                  }
                />
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-h3">{t('authorFinance.revenueTrend')}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {t('authorFinance.revenueTrendDescription')}
                      </p>
                    </div>
                    <Badge tone="green">{t('authorFinance.creatorShare')}</Badge>
                  </div>
                  {loading ? (
                    <RevenueChartSkeleton />
                  ) : (
                    <div className="nh-fade-enter relative mt-8">
                      <RevenueGridLines />
                      <ol
                        aria-label={t('authorFinance.revenueTrend')}
                        className="relative grid grid-cols-7 gap-2 sm:gap-4"
                      >
                        {data.bars.map((height, index) => (
                          <li key={days[index]} className="flex min-w-0 flex-col items-center">
                            <div className="flex h-52 w-full items-end border-b border-line">
                              <div
                                className={`mx-auto w-full max-w-14 rounded-t-xl transition-[transform,background-color] duration-[420ms] ${height === peak ? 'bg-orange' : 'bg-orange/55'}`}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <span className="mt-2 text-xs text-ink/70">
                              {t(`authorFinance.days.${days[index]}`)}
                            </span>
                            <span className="sr-only">: {height}%</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Card>

                <Card className="overflow-hidden p-0">
                  <div className="p-6 pb-4">
                    <h2 className="text-h3">{t('authorFinance.salesByChapter')}</h2>
                    <p className="mt-1 text-sm text-muted">{t('authorFinance.salesDescription')}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="whitespace-nowrap border-y border-hairline bg-elevated text-xs text-ink/70">
                        <tr>
                          <th scope="col" className="px-6 py-3 font-semibold">
                            {t('authorFinance.story')}
                          </th>
                          <th scope="col" className="px-3 py-3 font-semibold">
                            {t('authorFinance.chapter')}
                          </th>
                          <th scope="col" className="px-3 py-3 text-right font-semibold">
                            {t('authorFinance.price')}
                          </th>
                          <th scope="col" className="px-3 py-3 text-right font-semibold">
                            {t('authorFinance.buyers')}
                          </th>
                          <th scope="col" className="py-3 pl-3 pr-6 text-right font-semibold">
                            {t('authorFinance.authorCoins')}
                          </th>
                        </tr>
                      </thead>
                      {loading ? (
                        <tbody
                          aria-busy="true"
                          aria-label="Đang tải doanh số theo chương"
                          className="divide-y divide-hairline"
                        >
                          {[0, 1, 2].map((item) => (
                            <SalesRowSkeleton key={`sales-skeleton-${item}`} />
                          ))}
                        </tbody>
                      ) : (
                        <tbody className="nh-fade-enter divide-y divide-hairline">
                          {sales.map(([title, chapter, price, buyers, coins]) => (
                            <tr key={`${title}-${chapter}`}>
                              <th scope="row" className="px-6 py-4 text-left font-semibold">
                                {title}
                              </th>
                              <td className="px-3 py-4 text-muted">{chapter}</td>
                              <td className="px-3 py-4 text-right tabular-nums">
                                {price} {t('wallet.coinUnit')}
                              </td>
                              <td className="px-3 py-4 text-right tabular-nums">
                                {formatNumber(buyers)}
                              </td>
                              <td className="py-4 pl-3 pr-6 text-right font-semibold text-orange-strong tabular-nums">
                                +{formatNumber(coins)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      )}
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            {hasData && (
              <Card className="border-orange/40 bg-orange/10">
                <span className="grid size-10 place-items-center rounded-2xl bg-orange/20 text-orange-strong">
                  <CalendarDays size={18} aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm text-ink/80">{t('authorFinance.estimatedPayout')}</p>
                {loading ? (
                  <span
                    aria-busy="true"
                    aria-label="Đang tải khoản thanh toán dự kiến"
                    className="mt-1 flex h-10 items-center"
                  >
                    <Skeleton className="h-8 w-36 rounded-lg" />
                  </span>
                ) : (
                  <strong className="nh-fade-enter mt-1 block text-h1 tabular-nums">
                    ${projectedPayout.toFixed(2)}
                  </strong>
                )}
                <p className="mt-2 text-xs leading-5 text-ink/70">
                  {t('authorFinance.payoutDate')}
                </p>
              </Card>
            )}

            <Card>
              <h2 className="text-h3">{t('authorFinance.pricingTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t('authorFinance.pricingDescription')}
              </p>
              <label htmlFor="pricing-story" className="mt-5 block text-sm font-semibold">
                {t('authorFinance.story')}
              </label>
              <Select
                id="pricing-story"
                className="mt-2 w-full"
                value={story}
                onChange={(event) => setStory(event.target.value)}
              >
                <option value="silent-forest">The Silent Forest</option>
                <option value="echoes">Echoes of Eldoria</option>
              </Select>
              <label htmlFor="pricing-chapter" className="mt-4 block text-sm font-semibold">
                {t('authorFinance.chapterPrice')}
              </label>
              <Input
                id="pricing-chapter"
                className="mt-2"
                type="number"
                inputMode="numeric"
                min="0"
                max="500"
                value={chapterPrice}
                aria-describedby="pricing-chapter-hint"
                onChange={(event) => setChapterPrice(toPrice(event.target.value))}
              />
              <p id="pricing-chapter-hint" className="mt-2 text-xs text-muted">
                {t('authorFinance.priceHint')}
              </p>
              <label htmlFor="pricing-subscription" className="mt-4 block text-sm font-semibold">
                {t('authorFinance.subscriptionPrice')}
              </label>
              <Input
                id="pricing-subscription"
                className="mt-2"
                type="number"
                inputMode="numeric"
                min="0"
                max="5000"
                value={subscriptionPrice}
                onChange={(event) => setSubscriptionPrice(toPrice(event.target.value))}
              />
              {changed && (
                <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-hairline pt-5">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setChapterPrice(savedPrices.chapterPrice);
                      setSubscriptionPrice(savedPrices.subscriptionPrice);
                    }}
                  >
                    {t('common.discard')}
                  </Button>
                  <Button onClick={() => setSavedPrices({ chapterPrice, subscriptionPrice })}>
                    <Save size={16} aria-hidden="true" />
                    {t('common.saveChanges')}
                  </Button>
                </div>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </AuthorLayout>
  );
}

const iconTones = {
  brand: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
};

function Metric({ icon: Icon, label, value, tone = 'brand' }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTones[tone]}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <strong className="mt-3 block text-h3 tabular-nums sm:mt-4 sm:text-h2">{value}</strong>
    </Card>
  );
}

function RevenueGridLines() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 flex h-52 flex-col justify-between"
    >
      {[0, 1, 2, 3].map((line) => (
        <span key={line} className="border-t border-dashed border-hairline" />
      ))}
    </div>
  );
}

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
}

/*
 * Sizes skeleton text by an invisible copy of the real markup, so responsive wrapping (and the
 * loading → ready height) is identical; the pills are painted on top, first line top, last bottom.
 */
function GhostText({ className = '', ghost, children }) {
  return (
    <div className={`relative min-w-0 ${className}`}>
      <div className="invisible">{ghost}</div>
      <div className="absolute inset-0 flex flex-col justify-between overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/* Mirrors Metric: wrapped label + icon tile, then the h3/h2 value line box. */
function MetricSkeleton({ label }) {
  return (
    <Card as="div" aria-hidden="true" className="p-4 sm:p-5">
      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <GhostText ghost={<span className="block text-sm">{label}</span>}>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-full" />
          </span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-2/3" />
          </span>
        </GhostText>
        <Skeleton className="size-9 shrink-0 rounded-xl" />
      </div>
      <div className="mt-3 flex h-7 items-center sm:mt-4 sm:h-8">
        <Skeleton className="h-5 w-24 rounded-lg sm:h-6" />
      </div>
    </Card>
  );
}

/* Same 7-column grid, h-52 bar wells and 16px weekday labels as the ready chart. */
function RevenueChartSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải biểu đồ doanh thu" className="relative mt-8">
      <RevenueGridLines />
      <div aria-hidden="true" className="relative grid grid-cols-7 gap-2 sm:gap-4">
        {revenueSkeletonBars.map((height, index) => (
          <div key={`revenue-skeleton-${index}`} className="flex min-w-0 flex-col items-center">
            <div className="flex h-52 w-full items-end border-b border-line">
              <div className="mx-auto w-full max-w-14" style={{ height: `${height}%` }}>
                <Skeleton className="h-full w-full rounded-none rounded-t-xl" />
              </div>
            </div>
            <span className="mt-2 flex h-4 items-center">
              <Skeleton className="h-2.5 w-7" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Sales row: single text-sm line in every cell (row = 52px), same five columns. */
function SalesRowSkeleton() {
  return (
    <tr aria-hidden="true">
      <td className="px-6 py-4">
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-32" />
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-20" />
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex h-5 items-center justify-end">
          <Skeleton className="h-3.5 w-12" />
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex h-5 items-center justify-end">
          <Skeleton className="h-3.5 w-10" />
        </div>
      </td>
      <td className="py-4 pl-3 pr-6">
        <div className="flex h-5 items-center justify-end">
          <Skeleton className="h-3.5 w-14" />
        </div>
      </td>
    </tr>
  );
}
