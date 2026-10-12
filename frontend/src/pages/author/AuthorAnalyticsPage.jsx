import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  BarChart3,
  BookOpen,
  Check,
  Coins,
  Download,
  Lightbulb,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
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
  ProgressBar,
  Select,
  Skeleton,
} from '../../components/ui';

const analyticsData = {
  daily: [
    32, 39, 44, 78, 63, 48, 46, 52, 49, 62, 58, 85, 69, 55, 50, 53, 48, 65, 88, 72, 61, 58, 62, 67,
    93, 80, 68, 64, 73, 82,
  ],
  retention: [100, 92, 89, 87.5, 86, 85.4, 85, 84.8, 84.2, 84, 83.7, 83.5, 83.1, 82.9, 82.6],
  channels: [
    ['Bảng xếp hạng nổi bật', '#1 truyện kỳ ảo dài kỳ tuần', '42%', '524.370', '+24,1%', Trophy],
    ['Duyệt theo thể loại', 'Phân loại Kỳ ảo và Phiêu lưu', '28%', '349.580', '+11,5%', BarChart3],
    [
      'Thông báo tác giả đang theo dõi',
      'Thông báo đẩy tới người đăng ký',
      '20%',
      '249.700',
      '+5,4%',
      UsersRound,
    ],
    ['Tìm kiếm trực tiếp', 'Truy vấn từ khóa và tác giả', '10%', '124.850', '+3,2%', Search],
  ],
  devices: [
    ['Ứng dụng di động (eReader)', 74, 'brand'],
    ['Web máy tính / Máy tính bảng', 26, 'orange'],
    ['Giao diện ban đêm / Tối', 58, 'purple'],
    ['Người sở hữu gói Premium', 68.4, 'brand'],
  ],
};
const isAnalyticsEmpty = (value) => value.daily.length === 0;
const releasePeaks = [3, 11, 18, 24];
const BASELINE = 68;
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
  const [story, setStory] = useState('The Silent Forest');
  const [range, setRange] = useState('Last 30 Days');
  const [exported, setExported] = useState(false);
  const [chapter, setChapter] = useState(analyticsData.retention.length - 1);
  // Per-day readout for touch: the bars are too thin to target, so the plot maps the pointer x to a day.
  const [day, setDay] = useState(null);
  const analytics = useMockResource(`author:analytics:${story}:${range}`, analyticsData, {
    isEmpty: isAnalyticsEmpty,
  });
  const loading = analytics.status === 'loading';
  const { daily, retention, channels, devices } = analytics.data;
  const multiplier = range === 'Last 7 Days' ? 0.42 : range === 'Last 90 Days' ? 2.35 : 1;
  const storyLabel = story === 'All Stories' ? 'tất cả truyện' : story;
  const reads = Math.round(1248500 * multiplier);
  const readers = Math.round(84200 * multiplier);
  const royalties = (1420.5 * multiplier).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });
  const kpis = [
    {
      icon: BookOpen,
      label: 'Tổng lượt đọc truyện',
      value: reads.toLocaleString('vi-VN'),
      delta: '+18,4%',
      trend: true,
    },
    {
      icon: UsersRound,
      label: 'Độc giả tương tác duy nhất',
      value: readers.toLocaleString('vi-VN'),
      delta: '+6,2%',
      trend: true,
      tone: 'orange',
    },
    {
      icon: Sparkles,
      label: 'Tỷ lệ hoàn thành chương trung bình',
      value: '82,6%',
      delta: 'Top 5%',
      tone: 'purple',
    },
    {
      icon: Coins,
      label: 'Nhuận bút xu và tiền tip',
      value: `$${royalties}`,
      delta: '98.400 xu',
      tone: 'orange',
    },
  ];
  const chapterValue = retention[chapter];
  const chapterDelta = (chapterValue - BASELINE).toFixed(1).replace('.', ',');
  const dailyPeak = Math.max(...daily);

  const resetRange = () => {
    setStory('The Silent Forest');
    setRange('Last 30 Days');
    setExported(false);
  };

  const exportReport = () => {
    const rows = [
      ['Chỉ số', 'Giá trị'],
      ['Truyện', storyLabel],
      ['Khoảng thời gian', rangeLabels[range]],
      ['Tổng lượt đọc truyện', reads],
      ['Độc giả tương tác duy nhất', readers],
      ['Nhuận bút xu và tiền tip (USD)', royalties],
      [],
      ['Nguồn kênh', 'Tỷ trọng', 'Lượt đọc chuyển đổi', 'Tăng trưởng'],
      ...channels.map(([name, , share, channelReads, growth]) => [
        name,
        share,
        channelReads,
        growth,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
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
              <option>The Silent Forest</option>
              <option>Echoes of Eldoria</option>
              <option value="All Stories">Tất cả truyện</option>
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
                    <p className="mt-1 text-sm text-muted">
                      Phiên đọc hoạt động trong khoảng thời gian đã chọn. Các đỉnh thể hiện đợt phát
                      hành truyện dài kỳ cuối tuần.
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/80">
                    <Legend className="bg-brand">Lượt đọc hằng ngày</Legend>
                    <Legend className="bg-orange">Đỉnh phát hành</Legend>
                  </ul>
                </div>
                {loading ? (
                  <DailyChartSkeleton />
                ) : (
                  <div className="nh-fade-enter">
                    <div
                      role="img"
                      aria-label={`Biểu đồ lượt đọc 30 ngày, cao nhất ${dailyPeak} nghìn lượt vào ngày ${daily.indexOf(dailyPeak) + 1}`}
                      className="relative mt-8 h-56"
                    >
                      <ChartGridLines />
                      {daily[day] !== undefined && (
                        <p
                          aria-hidden="true"
                          className="pointer-events-none absolute left-0 top-0 z-10 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-whisper tabular-nums"
                        >
                          Ngày {day + 1}: {daily[day]}K lượt đọc
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
                            title={`Ngày ${index + 1}: ${height}K lượt đọc`}
                            className={`min-w-0 flex-1 rounded-t-[4px] transition-opacity duration-200 ${daily[day] !== undefined && day !== index ? 'opacity-50' : ''} ${releasePeaks.includes(index) ? 'bg-orange' : 'bg-brand/75'}`}
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-xs text-ink/70 tabular-nums">
                      {dailyAxisLabels.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                    <div className="mt-6 flex items-start gap-3 border-t border-hairline pt-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-strong">
                        <ArrowUp size={16} aria-hidden="true" />
                      </span>
                      <p className="text-sm">
                        <strong className="text-brand-strong">
                          Mức tăng độc giả cuối tuần trung bình: +46,2% tương tác
                        </strong>
                        <span className="block text-muted">
                          Tính trên 4 đợt phát hành được lên lịch vào thứ Bảy
                        </span>
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
                    <div
                      role="img"
                      aria-label="Văn bản 65%, sách nói 35%"
                      className="mx-auto mt-7 grid size-44 place-items-center rounded-full"
                      style={{
                        background:
                          'conic-gradient(var(--primary) 0 65%, var(--accent-orange) 65% 100%)',
                      }}
                    >
                      <div className="grid size-[7.5rem] place-items-center rounded-full bg-surface text-center">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-[.12em] text-muted">
                            Chủ đạo
                          </span>
                          <strong className="block text-h2 tabular-nums">65%</strong>
                          <span className="text-xs">Văn bản</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 space-y-3">
                      <FormatRow
                        tone="brand"
                        label="Đọc văn bản"
                        value="811.525 lượt đọc"
                        percent={65}
                      />
                      <FormatRow
                        tone="orange"
                        label="Sách nói"
                        value="436.975 lượt phát"
                        percent={35}
                      />
                    </div>
                  </div>
                )}
              </Card>
            </div>

            <Card className="mt-6">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0 max-w-[65ch]">
                  <h2 className="text-h3 md:text-h2">
                    Tỷ lệ giữ chân theo chương và đường cong rời bỏ
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Theo dõi mức rời bỏ từ Chương 1 đến 15 của <em>{storyLabel}</em>. Chỉ số vượt
                    trung bình nền tảng 14,2%.
                  </p>
                </div>
                <ul className="flex shrink-0 flex-wrap gap-x-4 gap-y-1 text-xs text-ink/80">
                  <Legend className="bg-brand">Giữ chân thực tế của truyện</Legend>
                  <li className="flex items-center gap-2">
                    <span
                      className="w-4 border-t-2 border-dashed border-orange"
                      aria-hidden="true"
                    />
                    Mốc cơ sở nền tảng ({BASELINE}%)
                  </li>
                </ul>
              </div>
              {loading ? (
                <RetentionSkeleton />
              ) : (
                <div className="nh-fade-enter">
                  <div className="relative mt-6 h-48">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-orange"
                      style={{ bottom: `${BASELINE}%` }}
                    >
                      <span className="absolute -top-3 right-0 hidden rounded-full bg-orange px-2 py-0.5 text-[11px] font-semibold text-on-orange sm:block">
                        {BASELINE}%
                      </span>
                    </span>
                    <div
                      role="group"
                      aria-label="Tỷ lệ giữ chân theo chương"
                      className="relative flex h-full items-end border-b border-line"
                    >
                      {retention.map((value, index) => {
                        const active = index === chapter;
                        return (
                          <button
                            key={index}
                            type="button"
                            aria-pressed={active}
                            aria-label={`Chương ${index + 1}: ${formatPercent(value)}`}
                            onClick={() => setChapter(index)}
                            className="group flex h-full min-w-0 flex-1 items-end"
                          >
                            <span
                              className={`mx-0.5 min-w-0 flex-1 rounded-t-md transition-[background-color,transform] duration-200 group-hover:bg-brand sm:mx-1 ${active ? 'bg-brand' : 'bg-brand/45'}`}
                              style={{ height: `${value}%` }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 flex text-center text-[11px] text-ink/70 tabular-nums"
                  >
                    {retention.map((_, index) => (
                      <span
                        key={index}
                        className={`min-w-0 flex-1 ${index === chapter ? 'font-semibold text-brand-strong' : ''}`}
                      >
                        {index + 1}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                    <div
                      className="rounded-2xl border border-brand/30 bg-brand-soft p-4"
                      aria-live="polite"
                    >
                      <p className="text-xs text-ink/70">Chương {chapter + 1}</p>
                      <p className="mt-1 text-h2 tabular-nums">{formatPercent(chapterValue)}</p>
                      <p className="mt-1 text-xs font-medium text-brand-strong">
                        +{chapterDelta} điểm so với mốc cơ sở
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-elevated p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                        <Lightbulb size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-48 flex-1">
                        <strong className="text-sm">
                          Nhận định: Mức rời bỏ không đáng kể sau Chương 2
                        </strong>
                        <p className="text-xs text-ink/70">
                          92% độc giả hoàn thành phần mở đầu tiếp tục đọc đến chương mới nhất.
                        </p>
                      </div>
                      <ButtonLink
                        to={ROUTES.authorStory('demo')}
                        variant="secondary"
                        size="sm"
                        trailingIcon={ArrowRight}
                        className="shrink-0 sm:ml-auto"
                      >
                        Xem chi tiết chương
                      </ButtonLink>
                    </div>
                  </div>
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
                    Đã xác minh
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
                    “Khả năng xây dựng thế giới dài kỳ của {storyLabel} luôn nằm trong nhóm 1% cao
                    nhất NovelHub về mức giữ chân độc giả đọc liên tục nhiều chương.”
                  </blockquote>
                  <figcaption className="mt-2 text-xs text-ink/70">
                    Hội đồng Biên tập NovelHub
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

function FormatRow({ tone, label, value, percent }) {
  return (
    <div className="rounded-2xl bg-elevated p-3.5">
      <div className="flex items-center gap-2 text-sm">
        <strong>{label}</strong>
        <strong className="ml-auto tabular-nums">{percent}%</strong>
      </div>
      <ProgressBar value={percent} tone={tone} size="sm" label={label} className="mt-2" />
      <p className="mt-1.5 text-right text-xs text-ink/70 tabular-nums">{value}</p>
    </div>
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
