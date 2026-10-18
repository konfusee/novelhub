import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  CalendarDays,
  Coins,
  RefreshCw,
  UsersRound,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
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
import { AuthorTransactionHistory } from './AuthorTransactionHistory';
import { AuthorPayoutHistory } from './AuthorPayoutHistory';
import { AuthorBankDetails } from './AuthorBankDetails';

const emptyEarnings = { balance: '0', allocationCredits: 0, bars: [], labels: [], stories: [] };
/* Fixed, varied bar heights (%) for the revenue chart skeleton, one per weekday. */
const revenueSkeletonBars = [48, 66, 54, 78, 62, 88, 72];

export function AuthorEarningsPage() {
  const { t, formatNumber, formatDate } = useLocale();
  const [period, setPeriod] = useState('month');
  const [story, setStory] = useState('');
  const earnings = useBackendDocument(`/author/earnings?period=${period}`, emptyEarnings);
  const loading = earnings.status === 'loading';
  const hasData = loading || earnings.status === 'ready';
  const data = earnings.data;
  const sales = data.sales ?? [];
  const peak = Math.max(0, ...data.bars);
  const metrics = [
    {
      icon: BookOpen,
      label: t('authorFinance.chapterBuyers'),
      value: Number.isSafeInteger(data.buyers) ? formatNumber(data.buyers) : '—',
    },
    { icon: UsersRound, label: t('authorFinance.newSubscribers'), value: '—', tone: 'purple' },
    {
      icon: Coins,
      label: t('earningsData.allocationCredits'),
      value: formatNumber(data.allocationCredits),
      tone: 'orange',
    },
    {
      icon: BadgeDollarSign,
      label: t('earningsData.balance'),
      value: `${data.balance} ${t('wallet.coinUnit')}`,
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
              {t('earningsData.description')}
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
                    <ButtonLink to="/author/stories" size="sm" trailingIcon={ArrowRight}>
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
                      <h2 className="text-h3">{t('earningsData.trend')}</h2>
                      <p className="mt-1 text-sm text-muted">{t('earningsData.grossHint')}</p>
                    </div>
                    <Badge tone="green">{t('earningsData.recorded')}</Badge>
                  </div>
                  {loading ? (
                    <RevenueChartSkeleton />
                  ) : (
                    <div className="nh-fade-enter relative mt-8">
                      <RevenueGridLines />
                      <ol
                        aria-label={t('earningsData.trend')}
                        className="relative grid gap-1 sm:gap-2"
                        style={{
                          gridTemplateColumns: `repeat(${Math.max(1, data.bars.length)},minmax(0,1fr))`,
                        }}
                      >
                        {data.bars.map((height, index) => (
                          <li
                            key={data.labels[index]}
                            className="flex min-w-0 flex-col items-center"
                          >
                            <div className="flex h-52 w-full items-end border-b border-line">
                              <div
                                className={`mx-auto w-full max-w-14 rounded-t-xl transition-[transform,background-color] duration-[420ms] ${height === peak ? 'bg-orange' : 'bg-orange/55'}`}
                                style={{ height: `${peak ? (height / peak) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="mt-2 text-xs text-ink/70">
                              {[0, Math.floor(data.bars.length / 2), data.bars.length - 1].includes(
                                index,
                              )
                                ? data.labels[index].slice(5)
                                : ''}
                            </span>
                            <span className="sr-only">
                              {data.labels[index]}: {height} {t('wallet.coinUnit')}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </Card>

                <Card className="overflow-hidden p-0">
                  <div className="p-6 pb-4">
                    <h2 className="text-h3">{t('authorFinance.salesByChapter')}</h2>
                    <p className="mt-1 text-sm text-muted">{t('earningsData.salesDescription')}</p>
                    {data.salesCoverageIncomplete && (
                      <p className="mt-2 text-xs text-muted">{t('earningsData.partialSales')}</p>
                    )}
                    {data.salesHasMore && (
                      <p className="mt-2 text-xs text-muted">{t('earningsData.salesLimit')}</p>
                    )}
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
                          {!sales.length && (
                            <tr>
                              <td colSpan={5} className="px-6 py-6 text-sm text-muted">
                                {t('earningsData.noSales')}
                              </td>
                            </tr>
                          )}
                          {sales.map(({ id, title, chapter, price, buyers, coins }) => (
                            <tr key={id}>
                              <th scope="row" className="px-6 py-4 text-left font-semibold">
                                {title}
                              </th>
                              <td className="px-3 py-4 text-muted">{chapter}</td>
                              <td className="px-3 py-4 text-right tabular-nums">
                                {formatNumber(price)} {t('wallet.coinUnit')}
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
            <AuthorTransactionHistory period={period} />
            <AuthorPayoutHistory />
          </div>

          <aside className="min-w-0 space-y-6">
            <AuthorBankDetails />
            <Card>
              <h2 className="text-h3">{t('earningsData.agreementTitle')}</h2>
              {loading ? (
                <Skeleton className="mt-4 h-8 w-40" />
              ) : earnings.status === 'ready' && data.agreement ? (
                <>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>{t('agreement.author')}</dt>
                      <dd className="font-semibold">{formatNumber(data.agreement.authorShare)}%</dd>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt>{t('agreement.platform')}</dt>
                      <dd className="font-semibold">
                        {formatNumber(data.agreement.platformShare)}%
                      </dd>
                    </div>
                  </dl>
                  <Badge className="mt-4" tone="green">
                    {t(`agreement.source.${data.agreement.source}`)}
                  </Badge>
                  {data.agreement.effectiveAt && (
                    <p className="mt-2 text-caption text-muted">
                      {t('earningsData.agreementEffective', {
                        date: formatDate(data.agreement.effectiveAt),
                      })}
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {t('earningsData.agreementHint')}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted">{t('earningsData.agreementUnavailable')}</p>
              )}
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                disabled={loading}
                onClick={earnings.retry}
              >
                <RefreshCw size={15} />
                {t('agreement.reload')}
              </Button>
            </Card>
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
                  <strong className="nh-fade-enter mt-1 block text-h1 tabular-nums">—</strong>
                )}
                <p className="mt-2 text-xs leading-5 text-ink/70">{t('earningsData.noPayout')}</p>
              </Card>
            )}

            <Card>
              <h2 className="text-h3">{t('authorFinance.pricingTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{t('earningsData.noPricing')}</p>
              <label htmlFor="pricing-story" className="mt-5 block text-sm font-semibold">
                {t('authorFinance.story')}
              </label>
              <Select
                id="pricing-story"
                className="mt-2 w-full"
                value={story}
                onChange={(event) => setStory(event.target.value)}
              >
                <option value="">{t('analyticsData.allStories')}</option>
                {data.stories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </Select>
              {story && (
                <ButtonLink
                  to={`/author/stories/${story}`}
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                >
                  {t('navigation.storyManager')}
                </ButtonLink>
              )}
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
                value=""
                disabled
                placeholder="—"
                aria-describedby="pricing-chapter-hint"
              />
              <p id="pricing-chapter-hint" className="mt-2 text-xs text-muted">
                {t('earningsData.noPricing')}
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
                value=""
                disabled
                placeholder="—"
              />
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
