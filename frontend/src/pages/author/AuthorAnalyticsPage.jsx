import { useState } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  BarChart3,
  BookOpen,
  Check,
  Coins,
  Download,
  Plus,
  RefreshCw,
  Sparkles,
  UsersRound,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Select,
  Skeleton,
} from '../../components/ui';

const emptyAnalytics = { daily: [], labels: [], stories: [], reads: 0, readers: 0 };
const rangeLabels = {
  'Last 7 Days': '7 ngày gần nhất',
  'Last 30 Days': '30 ngày gần nhất',
  'Last 90 Days': '90 ngày gần nhất',
};
const formatPercent = (value) => `${String(value).replace('.', ',')}%`;
/* Index of the daily bar under the pointer, clamped to the plot. */
const dayAt = (event, count) => {
  const rect = event.currentTarget.getBoundingClientRect();
  const index = Math.floor(((event.clientX - rect.left) / rect.width) * count);
  return Math.min(count - 1, Math.max(0, index));
};
/* Fixed, varied bar heights (%) for chart-shaped skeletons; same bar counts as the real charts. */
const dailySkeletonBars = [
  42, 68, 55, 80, 36, 72, 60, 48, 64, 52, 76, 44, 58, 70, 40, 62, 50, 84, 46, 66, 56, 74, 38, 60,
  78, 52, 68, 44, 72, 58,
];
const retentionSkeletonBars = [94, 82, 86, 74, 78, 70, 76, 66, 72, 64, 70, 62, 68, 60, 66];
const dailyAxisLabels = ['Ngày 1', 'Ngày 7', 'Ngày 14', 'Ngày 21', 'Ngày 30'];
/* 4 channel skeleton rows; on phones some names wrap to 2 lines (72px vs 52px text column). */
const channelSkeletonNameWraps = [true, false, true, false];

export function AuthorAnalyticsPage() {
  const { t } = useLocale();
  const [story, setStory] = useState('');
  const [range, setRange] = useState('Last 30 Days');
  const [exported, setExported] = useState(false);
  // Per-day readout for touch: the bars are too thin to target, so the plot maps the pointer x to a day.
  const [day, setDay] = useState(null);
  const days = { 'Last 7 Days': 7, 'Last 30 Days': 30, 'Last 90 Days': 90 }[range];
  const analytics = useBackendDocument(
    `/author/analytics?days=${days}${story ? `&storyId=${story}` : ''}`,
    emptyAnalytics,
  );
  const loading = analytics.status === 'loading';
  const { daily, labels, reads, readers } = analytics.data;
  const channels = [];
  const devices = [];
  const storyLabel =
    analytics.data.stories.find((item) => item.id === story)?.title ??
    t('analyticsData.allStories');
  const kpis = [
    {
      icon: BookOpen,
      label: t('analyticsData.views'),
      value: reads.toLocaleString('vi-VN'),
      delta: t('analyticsData.recorded'),
    },
    {
      icon: UsersRound,
      label: t('analyticsData.readers'),
      value: readers.toLocaleString('vi-VN'),
      delta: t('analyticsData.readerHint'),
      tone: 'orange',
    },
    {
      icon: Sparkles,
      label: t('analyticsData.completion'),
      value: '—',
      delta: t('analyticsData.unknown'),
      tone: 'purple',
    },
    {
      icon: Coins,
      label: t('analyticsData.revenue'),
      value: '—',
      delta: t('analyticsData.noRevenue'),
      tone: 'orange',
    },
  ];
  const dailyPeak = Math.max(0, ...daily);

  const resetRange = () => {
    setStory('');
    setRange('Last 30 Days');
    setExported(false);
  };

  const exportReport = () => {
    const rows = [
      [t('analyticsData.story'), storyLabel],
      [t('analyticsData.range'), rangeLabels[range]],
      [t('analyticsData.views'), reads],
      [t('analyticsData.readers'), readers],
      [],
      [t('analyticsData.date'), t('analyticsData.views')],
      ...labels.map((label, index) => [label, daily[index]]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell);
            const literal = /^[=+\-@\t\r]/u.test(text) ? `'${text}` : text;
            return `"${literal.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'novelhub-phan-tich-tac-gia.csv';
    link.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-xs text-ink/70">Studio tác giả / Đo lường hiệu suất</p>
            <h1 className="mt-2 text-h2 sm:text-h1">Phân tích tác giả và thông tin độc giả</h1>
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <Select
              aria-label="Chọn truyện"
              value={story}
              onChange={(event) => {
                setStory(event.target.value);
                setExported(false);
              }}
            >
              <option value="">{t('analyticsData.allStories')}</option>
              {analytics.data.stories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Khoảng thời gian"
              value={range}
              onChange={(event) => {
                setRange(event.target.value);
                setExported(false);
              }}
            >
              {Object.entries(rangeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Button onClick={exportReport} disabled={analytics.status !== 'ready'}>
              {exported ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Download size={16} aria-hidden="true" />
              )}
              {exported ? 'Đã tải báo cáo' : 'Xuất báo cáo'}
            </Button>
          </div>
        </header>

        {analytics.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được dữ liệu phân tích"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
              action={<RetryButton onClick={analytics.retry} />}
            />
          </Card>
        ) : analytics.status === 'empty' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={BarChart3}
              title="Chưa có dữ liệu phân tích"
              description="Lượt đọc, tỷ lệ giữ chân và nguồn độc giả sẽ xuất hiện khi truyện có chương được xuất bản trong khoảng thời gian này."
              action={
                <>
                  <Button variant="secondary" size="sm" onClick={resetRange}>
                    Về 30 ngày gần nhất
                  </Button>
                  <ButtonLink to="/author/stories/new" size="sm">
                    <Plus size={14} aria-hidden="true" />
                    Tạo truyện mới
                  </ButtonLink>
                </>
              }
            />
          </Card>
        ) : (
          <>
            {loading ? (
              <section
                aria-busy="true"
                aria-label="Đang tải chỉ số chính"
                className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4"
              >
                {kpis.map((kpi) => (
                  <KpiSkeleton key={`kpi-skeleton-${kpi.label}`} label={kpi.label} />
                ))}
              </section>
            ) : (
              <section
                aria-label="Chỉ số chính"
                className="nh-fade-enter mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4"
              >
                {kpis.map((kpi) => (
                  <Kpi key={kpi.label} {...kpi} />
                ))}
              </section>
            )}

            <div className="nh-grid-12 mt-6 grid items-start gap-5 nh-layout-xl-8-4">
              <Card className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 max-w-[60ch]">
                    <h2 className="text-h3">Tăng trưởng độc giả và lượt đọc hằng ngày</h2>
                    <p className="mt-1 text-sm text-muted">{t('analyticsData.dailyHint')}</p>
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/80">
                    <Legend className="bg-brand">Lượt đọc hằng ngày</Legend>
                  </ul>
                </div>
                {loading ? (
                  <DailyChartSkeleton />
                ) : (
                  <div className="nh-fade-enter">
                    <div
                      role="img"
                      aria-label={t('analyticsData.chart', { days: daily.length, peak: dailyPeak })}
                      className="relative mt-8 h-56"
                    >
                      <ChartGridLines />
                      {daily[day] !== undefined && (
                        <p
                          aria-hidden="true"
                          className="pointer-events-none absolute left-0 top-0 z-10 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-whisper tabular-nums"
                        >
                          {labels[day]}: {daily[day]} lượt đọc
                        </p>
                      )}
                      <div
                        className="relative flex h-full items-end gap-[3px] border-b border-line sm:gap-1.5"
                        onPointerDown={(event) => setDay(dayAt(event, daily.length))}
                        onPointerMove={(event) => setDay(dayAt(event, daily.length))}
                        onPointerLeave={(event) => event.pointerType === 'mouse' && setDay(null)}
                      >
                        {daily.map((height, index) => (
                          <div
                            key={index}
                            title={`${labels[index]}: ${height} lượt đọc`}
                            className={`min-w-0 flex-1 rounded-t-[4px] transition-opacity duration-200 ${daily[day] !== undefined && day !== index ? 'opacity-50' : ''} bg-brand/75`}
                            style={{ height: `${dailyPeak ? (height / dailyPeak) * 100 : 0}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-ink/70 tabular-nums">
                      {[labels[0], labels[Math.floor(labels.length / 2)], labels.at(-1)]
                        .filter(Boolean)
                        .map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                    </div>
                    <div className="mt-6 flex items-start gap-3 border-t border-hairline pt-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-strong">
                        <ArrowUp size={16} aria-hidden="true" />
                      </span>
                      <p className="text-sm">
                        <strong className="text-brand-strong">{t('analyticsData.recorded')}</strong>
                        <span className="block text-muted">{t('analyticsData.dailyHint')}</span>
                      </p>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="min-w-0">
                <h2 className="text-h3">Phân bổ định dạng</h2>
                <p className="mt-1 text-sm text-muted">Đọc văn bản so với lượt nghe sách nói</p>
                {loading ? (
                  <FormatSkeleton />
                ) : (
                  <div className="nh-fade-enter">
                    <div className="mx-auto mt-7 grid size-44 place-items-center rounded-full border-[18px] border-hairline">
                      <strong className="text-h2">—</strong>
                    </div>
                    <p className="mt-6 rounded-2xl bg-elevated p-4 text-sm text-muted">
                      {t('analyticsData.noFormats')}
                    </p>
                  </div>
                )}
              </Card>
            </div>

            <Card className="mt-6">
              <h2 className="text-h3 md:text-h2">{t('analyticsData.retention')}</h2>
              <p className="mt-2 text-sm text-muted">{t('analyticsData.noRetention')}</p>
              {loading ? (
                <RetentionSkeleton />
              ) : (
                <div className="relative mt-6 grid h-48 place-items-center">
                  <ChartGridLines />
                  <span className="relative rounded-2xl bg-elevated p-4 text-sm text-muted">
                    {t('analyticsData.unknown')}
                  </span>
                </div>
              )}
            </Card>

            <div className="nh-grid-12 mt-6 grid items-start gap-5 nh-layout-xl-7-5">
              <Card className="min-w-0 overflow-hidden p-0">
                <div className="p-6 pb-4">
                  <h2 className="text-h3">Đặc điểm độc giả và kênh khám phá</h2>
                  <p className="mt-1 text-sm text-muted">
                    Nguồn lưu lượng đưa độc giả đến {storyLabel}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="whitespace-nowrap border-y border-hairline bg-elevated text-xs text-ink/70">
                      <tr>
                        <th scope="col" className="px-6 py-3 font-semibold">
                          Nguồn kênh
                        </th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">
                          Tỷ trọng
                        </th>
                        <th scope="col" className="px-3 py-3 text-right font-semibold">
                          Lượt đọc chuyển đổi
                        </th>
                        <th scope="col" className="py-3 pl-3 pr-6 text-right font-semibold">
                          Tăng trưởng
                        </th>
                      </tr>
                    </thead>
                    {loading ? (
                      <tbody
                        aria-busy="true"
                        aria-label="Đang tải kênh khám phá"
                        className="divide-y divide-hairline"
                      >
                        {channelSkeletonNameWraps.map((nameWraps, index) => (
                          <ChannelRowSkeleton
                            key={`channel-skeleton-${index}`}
                            nameWraps={nameWraps}
                          />
                        ))}
                      </tbody>
                    ) : (
                      <tbody className="nh-fade-enter divide-y divide-hairline">
                        {!channels.length && (
                          <tr>
                            <td colSpan={4} className="px-6 py-6 text-sm text-muted">
                              {t('analyticsData.noChannels')}
                            </td>
                          </tr>
                        )}
                        {channels.map(([name, note, share, channelReads, growth, Icon]) => (
                          <tr key={name}>
                            <th scope="row" className="px-6 py-4 text-left font-normal">
                              <div className="flex items-center gap-3">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-strong">
                                  <Icon size={15} aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <strong className="block font-semibold">{name}</strong>
                                  <span className="block text-xs text-muted">{note}</span>
                                </div>
                              </div>
                            </th>
                            <td className="px-3 py-4 text-right font-semibold tabular-nums">
                              {share}
                            </td>
                            <td className="px-3 py-4 text-right tabular-nums">{channelReads}</td>
                            <td className="py-4 pl-3 pr-6 text-right">
                              <Badge tone="green">{growth}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
              </Card>
              <Card className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-h3">Hồ sơ độc giả và thiết bị</h2>
                    <p className="mt-1 text-sm text-muted">
                      Thiết bị, giao diện và hành vi đăng ký
                    </p>
                  </div>
                  <Badge tone="green">
                    <Check size={12} aria-hidden="true" />
                    {t('analyticsData.unknown')}
                  </Badge>
                </div>
                {loading ? (
                  <div
                    aria-busy="true"
                    aria-label="Đang tải hồ sơ thiết bị"
                    className="mt-5 space-y-5"
                  >
                    {[0, 1, 2, 3].map((item) => (
                      <div key={`device-skeleton-${item}`} aria-hidden="true">
                        <div className="flex h-5 items-center justify-between gap-3">
                          <Skeleton className="h-3.5 w-44 max-w-[70%]" />
                          <Skeleton className="h-3.5 w-10" />
                        </div>
                        <Skeleton className="mt-2 h-1.5 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="nh-fade-enter mt-5 space-y-5">
                    {!devices.length && (
                      <p className="text-sm text-muted">{t('analyticsData.noDevices')}</p>
                    )}
                    {devices.map(([label, value, tone]) => (
                      <div key={label}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span>{label}</span>
                          <strong className="tabular-nums">{formatPercent(value)}</strong>
                        </div>
                        <ProgressBar
                          value={value}
                          tone={tone}
                          size="sm"
                          label={label}
                          className="mt-2"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <figure className="mt-6 rounded-2xl bg-elevated p-4">
                  <blockquote className="text-sm italic leading-6">
                    {t('analyticsData.noAdvice')}
                  </blockquote>
                  <figcaption className="mt-2 text-xs text-ink/70">
                    {t('managerData.adviceTitle')}
                  </figcaption>
                </figure>
              </Card>
            </div>
          </>
        )}
      </div>
    </AuthorLayout>
  );
}

const iconTones = {
  brand: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
};

function Kpi({ icon: Icon, label, value, delta, trend = false, tone = 'brand' }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <span className="text-sm text-muted">{label}</span>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTones[tone]}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <strong className="mt-3 block text-h3 tabular-nums sm:mt-4 sm:text-h2">{value}</strong>
      <Badge tone={tone === 'brand' ? 'green' : tone} className="mt-3 flex w-fit">
        {trend && <ArrowUp size={12} aria-hidden="true" />}
        {delta}
      </Badge>
    </Card>
  );
}

function Legend({ className, children }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`size-2.5 rounded-[3px] ${className}`} aria-hidden="true" />
      {children}
    </li>
  );
}

function ChartGridLines() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between">
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
 * Sizes skeleton text by an invisible copy of STATIC copy (labels, never resource data), so its
 * responsive wrapping matches the ready state; pills paint on top, first line top, last bottom.
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

/* Mirrors Kpi: wrapped label + icon tile, h3/h2 value line box, inline badge line box. */
function KpiSkeleton({ label }) {
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
      <Skeleton className="mt-3 h-6 w-20" />
    </Card>
  );
}

/* Same h-56 plot, 30 bars, axis row and insight row as the ready daily chart. */
function DailyChartSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải biểu đồ lượt đọc">
      <div className="relative mt-8 h-56" aria-hidden="true">
        <ChartGridLines />
        <div className="relative flex h-full items-end gap-[3px] border-b border-line sm:gap-1.5">
          {dailySkeletonBars.map((height, index) => (
            <div
              key={`daily-skeleton-${index}`}
              className="min-w-0 flex-1"
              style={{ height: `${height}%` }}
            >
              <Skeleton className="h-full w-full rounded-none rounded-t-[4px]" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex h-4 items-center justify-between" aria-hidden="true">
        {dailyAxisLabels.map((label) => (
          <Skeleton key={`axis-skeleton-${label}`} className="h-2.5 w-10" />
        ))}
      </div>
      <div className="mt-6 flex items-start gap-3 border-t border-hairline pt-4" aria-hidden="true">
        <Skeleton className="size-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-4/5 max-w-sm" />
          </div>
          <div className="flex h-5 items-center sm:hidden">
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3 w-3/5 max-w-xs" />
          </div>
          <div className="flex h-5 items-center sm:hidden">
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Donut (size-44 ring with the same 7.5rem hole) plus two FormatRow-shaped tiles. */
function FormatSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải phân bổ định dạng">
      <div className="mx-auto mt-7 grid size-44 place-items-center" aria-hidden="true">
        <Skeleton className="col-start-1 row-start-1 size-44 rounded-full" />
        <span className="relative col-start-1 row-start-1 size-[7.5rem] rounded-full bg-surface" />
      </div>
      <div className="mt-6 space-y-3" aria-hidden="true">
        {[0, 1].map((item) => (
          <div key={`format-skeleton-${item}`} className="rounded-2xl bg-elevated p-3.5">
            <div className="flex h-5 items-center gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="ml-auto h-3.5 w-8" />
            </div>
            <Skeleton className="mt-2 h-1.5 w-full" />
            <div className="mt-1.5 flex h-4 items-center justify-end">
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Same h-48 plot with 15 bars, 11px chapter axis row and the two detail tiles. */
function RetentionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải tỷ lệ giữ chân">
      <div className="relative mt-6 h-48" aria-hidden="true">
        <div className="relative flex h-full items-end border-b border-line">
          {retentionSkeletonBars.map((height, index) => (
            <div
              key={`retention-skeleton-${index}`}
              className="mx-0.5 min-w-0 flex-1 sm:mx-1"
              style={{ height: `${height}%` }}
            >
              <Skeleton className="h-full w-full rounded-none rounded-t-md" />
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="mt-2 flex text-[11px]">
        {retentionSkeletonBars.map((_, index) => (
          <span
            key={`retention-axis-skeleton-${index}`}
            className="flex min-w-0 flex-1 items-center justify-center"
          >
            {/* Invisible strut keeps the 11px label line box. */}
            <span className="invisible w-0">0</span>
            <Skeleton className="h-2 w-3" />
          </span>
        ))}
      </div>
      <div
        className="mt-5 grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
        aria-hidden="true"
      >
        <div className="rounded-2xl border border-hairline p-4">
          <div className="flex h-4 items-center">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="mt-1 flex h-8 items-center">
            <Skeleton className="h-6 w-24 rounded-lg" />
          </div>
          <div className="mt-1 flex h-4 items-center">
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-elevated p-4">
          <Skeleton className="size-10 shrink-0 rounded-2xl" />
          <div className="min-w-48 flex-1">
            <InlineTextLine />
            <InlineTextLine width="w-1/2" className="min-[1400px]:hidden" />
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-3/5 max-w-xs" />
            </div>
            <div className="flex h-4 items-center min-[1400px]:hidden">
              <Skeleton className="h-3 w-2/5" />
            </div>
            <div className="flex h-4 items-center sm:hidden">
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          {/* ButtonLink with a trailing icon circle renders 42px tall. */}
          <Skeleton className="h-10.5 w-44 shrink-0 sm:ml-auto" />
        </div>
      </div>
    </div>
  );
}

/*
 * One line box of inline `text-sm` text inside 16px body copy (the insight's <strong>): the strut
 * makes it taller than 20px, so an invisible nbsp reproduces it instead of a fixed height.
 */
function InlineTextLine({ width = 'w-4/5', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <strong className="invisible text-sm">{'\u00a0'}</strong>
      <span className="absolute inset-0 flex items-center">
        <Skeleton className={`h-3.5 max-w-sm ${width}`} />
      </span>
    </div>
  );
}

/* Channel row: 36px icon + name/note lines that wrap on phones, share, reads and a badge. */
function ChannelRowSkeleton({ nameWraps }) {
  return (
    <tr aria-hidden="true">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-4/5" />
            </div>
            {nameWraps && (
              <div className="flex h-5 items-center sm:hidden">
                <Skeleton className="h-3.5 w-1/2" />
              </div>
            )}
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-3/5" />
            </div>
            <div className="flex h-4 items-center sm:hidden">
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex h-5 items-center justify-end">
          <Skeleton className="h-3.5 w-10" />
        </div>
      </td>
      <td className="px-3 py-4">
        <div className="flex h-5 items-center justify-end">
          <Skeleton className="h-3.5 w-16" />
        </div>
      </td>
      <td className="py-4 pl-3 pr-6">
        <div className="flex justify-end">
          <Skeleton className="h-6 w-16" />
        </div>
      </td>
    </tr>
  );
}
