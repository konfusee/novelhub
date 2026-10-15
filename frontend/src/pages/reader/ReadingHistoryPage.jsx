import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Download,
  Flame,
  Headphones,
  History,
  Laptop,
  Play,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Trash2,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  ProgressBar,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { libraryItems } from '../../data/mock/reader';
import { useLocale } from '../../context/LocaleContext';
import { useMockResource } from '../../context/MockDataContext';

const metrics = [
  ['history.storiesProgress', '6', 'history.activeStories', BookOpen],
  ['history.chaptersMonth', '84', 'history.vsLastMonth', BookOpen],
  ['history.audioHours', '26.5', 'history.hours', Headphones],
  ['history.streak', '18', 'history.consecutiveDays', Flame],
];
const weekly = {
  week: [32, 48, 24, 51, 41, 49, 46],
  last: [25, 37, 19, 40, 32, 38, 36],
};
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const genres = [
  ['Kỳ ảo và thần thoại', 45, 'bg-brand'],
  ['Lãng mạn và chính kịch', 25, 'bg-orange'],
  ['Bí ẩn và giật gân', 18, 'bg-purple'],
  ['Khoa học viễn tưởng và Cyberpunk', 12, 'bg-rose'],
];
const devices = [
  ['Trình đọc MacBook Pro', 'Đang hoạt động', Laptop],
  ['iPhone 15 Pro', 'Đồng bộ 2 giờ trước', Smartphone],
  ['Kindle PaperWhite', 'Hôm qua', BookOpen],
];
const historyItems = [
  { ...libraryItems[0], when: 'Đọc 20 phút trước', duration: '35 phút đọc' },
  { ...libraryItems[1], when: 'Phiên nghe · 2 giờ trước', duration: '20 phút nghe' },
  { ...libraryItems[2], when: 'Đọc hôm qua lúc 21:15', duration: '42 phút đọc' },
  { ...libraryItems[4], when: 'Đọc hôm qua lúc 14:30', duration: '28 phút đọc' },
  { ...libraryItems[3], when: 'Hoàn tất thứ Năm', duration: 'Phiên 1 giờ 15 phút' },
];

const readingStats = { metrics, weekly, genres };
const isStatsEmpty = (value) => !value.metrics.length;
/* Sessions shown under each history tab; the loading list uses it too so row counts match. */
const sessionsForTab = (items, tab) =>
  tab === 'listening'
    ? items.filter((i) => i.type === 'audio')
    : tab === 'completed'
      ? items.filter((i) => i.progress === 100)
      : items.filter((i) => i.type !== 'audio');

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
}

function SessionSkeleton() {
  return (
    <li aria-hidden="true">
      <Card as="div" className="flex gap-4 p-4">
        <Skeleton className="h-24 w-16 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
          <span className="mt-2 flex h-6 items-center">
            <Skeleton className="h-4 w-3/5" />
          </span>
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-2/5" />
          </span>
          <div className="mt-3 flex h-4 items-center gap-3">
            <Skeleton className="h-1.5 flex-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end justify-center gap-3 sm:flex">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
    </li>
  );
}

const csvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;

function exportHistory(items) {
  const rows = [
    ['Tác phẩm', 'Tác giả', 'Định dạng', 'Tiến độ (%)', 'Thời điểm', 'Thời lượng'],
    ...items.map((item) => [
      item.title,
      item.author,
      item.type === 'audio' ? 'Âm thanh' : 'Truyện',
      item.progress,
      item.when,
      item.duration,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'novelhub-lich-su-doc.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function ReadingHistoryPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState('reading');
  const [period, setPeriod] = useState('week');
  const [cleared, setCleared] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = useMockResource('reader:history:stats', readingStats, { isEmpty: isStatsEmpty });
  const sessions = useMockResource('reader:history:sessions', historyItems);
  const sessionsReady = sessions.status === 'ready';
  const items = useMemo(
    () => (cleared || !sessionsReady ? [] : sessions.data),
    [cleared, sessions.data, sessionsReady],
  );
  const visible = useMemo(() => sessionsForTab(items, tab), [items, tab]);
  const maxMinutes = Math.max(...weekly.week, ...weekly.last);
  const statsLoading = stats.status === 'loading';
  const statsReady = stats.status === 'ready';
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-brand-strong">
              {t('history.eyebrow')}
            </p>
            <h1 className="mt-2 text-h2 sm:text-h1">{t('history.title')}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!items.length}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={15} />
              {t('history.clear')}
            </Button>
            <Button disabled={!items.length} onClick={() => exportHistory(items)}>
              <Download size={15} />
              {t('history.export')}
            </Button>
          </div>
        </div>
        {statsLoading ? (
          <section
            aria-busy="true"
            aria-label="Đang tải thống kê đọc"
            className="nh-grid-12 mt-6 grid nh-cols-2 gap-3 nh-xl-cols-4"
          >
            {metrics.map(([title]) => (
              <Card as="div" key={title} aria-hidden="true" className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-5 flex-1 items-center">
                    <Skeleton className="h-3 w-3/4" />
                  </span>
                  <Skeleton className="size-[18px] shrink-0 rounded-md" />
                </div>
                <span className="mt-3 flex h-8 items-center gap-1.5">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-16" />
                </span>
              </Card>
            ))}
          </section>
        ) : statsReady ? (
          <section className="nh-fade-enter nh-grid-12 mt-6 grid nh-cols-2 gap-3 nh-xl-cols-4">
            {stats.data.metrics.map(([title, value, detail, Icon]) => (
              <Card key={title} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs leading-5 text-muted">{t(title)}</p>
                  <Icon
                    size={18}
                    className={`shrink-0 ${title === 'history.streak' ? 'text-orange' : 'text-brand'}`}
                  />
                </div>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 text-2xl font-bold tabular-nums tracking-tight">
                  {value}
                  <span className="text-xs font-normal tracking-normal text-muted">
                    {t(detail)}
                  </span>
                </p>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="mt-6 p-0">
            {stats.status === 'error' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được thống kê đọc"
                description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                action={<RetryButton onClick={stats.retry} />}
              />
            ) : (
              <EmptyState
                icon={Flame}
                title="Chưa có thống kê đọc"
                description="Đọc hoặc nghe vài chương, số liệu chuỗi ngày và thời lượng sẽ hiện ở đây."
                action={
                  <ButtonLink to="/reader/library" variant="secondary" size="sm">
                    Mở thư viện
                  </ButtonLink>
                }
              />
            )}
          </Card>
        )}
        <div className="mt-6">
          <Tabs
            singleRow
            label={t('history.title')}
            value={tab}
            onChange={setTab}
            items={[
              { value: 'reading', label: t('history.readingTab', { count: 34 }), icon: BookOpen },
              {
                value: 'listening',
                label: t('history.listeningTab', { count: 12 }),
                icon: Headphones,
              },
              {
                value: 'completed',
                label: t('history.completedTab', { count: 19 }),
                icon: History,
              },
            ]}
          />
        </div>
        <div className="nh-grid-12 mt-6 grid gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-h3">{t('history.weeklyMinutes')}</h2>
                  <p className="mt-1 text-xs text-muted">{t('history.weeklyTarget')}</p>
                </div>
                <Tabs
                  label={t('history.weeklyMinutes')}
                  value={period}
                  onChange={setPeriod}
                  items={[
                    { value: 'week', label: t('history.thisWeek') },
                    { value: 'last', label: t('history.lastWeek') },
                  ]}
                />
              </div>
              {statsReady ? (
                <div className="nh-fade-enter mt-7 flex h-40 items-end justify-between gap-2 sm:gap-3">
                  {stats.data.weekly[period].map((value, index) => (
                    <div className="flex h-full flex-1 flex-col justify-end" key={weekdays[index]}>
                      <div className="relative mx-auto w-full max-w-10 flex-1">
                        <div
                          title={`${value} phút`}
                          className={`absolute inset-x-0 bottom-0 rounded-t-[10px] ${index === 3 || index === 6 ? 'bg-brand' : 'bg-brand/45'}`}
                          style={{ height: `${(value / maxMinutes) * 100}%` }}
                        />
                      </div>
                      <span className="mt-2 text-center text-xs text-muted">{weekdays[index]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  aria-busy={statsLoading || undefined}
                  aria-label={statsLoading ? 'Đang tải biểu đồ phút đọc' : undefined}
                  className="mt-7 flex h-40 items-end justify-between gap-2 sm:gap-3"
                >
                  {weekly.week.map((value, index) => (
                    <div
                      aria-hidden="true"
                      className="flex h-full flex-1 flex-col justify-end"
                      key={weekdays[index]}
                    >
                      <div className="relative mx-auto w-full max-w-10 flex-1">
                        <span
                          className="absolute inset-x-0 bottom-0"
                          style={{ height: `${(value / maxMinutes) * 100}%` }}
                        >
                          {statsLoading && <Skeleton className="h-full w-full rounded-t-[10px]" />}
                        </span>
                      </div>
                      <span className="mt-2 text-center text-xs text-muted">{weekdays[index]}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <section>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-base font-semibold">{t('history.recentSessions')}</h2>
                <span className="h-px flex-1 bg-line" />
                {sessionsReady ? (
                  <span className="text-xs text-muted">
                    {t('history.sessions', { count: visible.length })}
                  </span>
                ) : (
                  sessions.status === 'loading' && <Skeleton className="h-3 w-16" />
                )}
              </div>
              {sessions.status === 'loading' ? (
                <ul aria-busy="true" aria-label="Đang tải phiên đọc gần đây" className="space-y-3">
                  {sessionsForTab(historyItems, tab).map((item) => (
                    <SessionSkeleton key={`${item.id}-${item.when}`} />
                  ))}
                </ul>
              ) : sessions.status === 'error' ? (
                <Card className="p-0">
                  <EmptyState
                    tone="rose"
                    headingAs="h3"
                    icon={AlertTriangle}
                    title="Không tải được phiên đọc gần đây"
                    description="Lịch sử của bạn vẫn được lưu. Hãy thử tải lại."
                    action={<RetryButton onClick={sessions.retry} />}
                  />
                </Card>
              ) : visible.length ? (
                <ul className="nh-fade-enter space-y-3">
                  {visible.map((item) => {
                    const audio = item.type === 'audio';
                    const done = item.progress === 100;
                    const href = audio
                      ? `/listen/${item.id}/chapter-1`
                      : `/read/${item.id}/chapter-1`;
                    return (
                      <li key={`${item.id}-${item.when}`}>
                        <Card className="group flex gap-4 p-4">
                          <StoryCover story={item} className="h-24 w-16 shrink-0 rounded-xl" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={audio ? 'orange' : 'green'}>
                                {t(audio ? 'history.audio' : 'history.story')}
                              </Badge>
                              <span className="text-xs text-muted">{item.when}</span>
                            </div>
                            <h3
                              className="mt-2 line-clamp-2 text-base font-semibold"
                              title={item.title}
                            >
                              {item.title}
                            </h3>
                            <p className="text-xs text-muted">
                              {t('history.byAuthor', { author: item.author })} · {item.detail}
                            </p>
                            <div className="mt-3 flex items-center gap-3">
                              <ProgressBar
                                value={item.progress}
                                tone={audio ? 'orange' : 'brand'}
                                size="sm"
                                label={`Tiến độ ${item.title}`}
                                className="flex-1"
                              />
                              <span className="shrink-0 text-xs tabular-nums text-ink/80">
                                {t('history.finished', { progress: item.progress })}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3 sm:hidden">
                              <span className="text-xs text-muted">{item.duration}</span>
                              <ButtonLink to={href} size="sm" variant="outline">
                                {done ? <RotateCcw size={14} /> : <Play size={14} />}
                                {t(done ? 'history.reread' : 'history.resume')}
                              </ButtonLink>
                            </div>
                          </div>
                          <div className="hidden shrink-0 flex-col items-end justify-center gap-3 sm:flex">
                            <p className="text-xs text-muted">{item.duration}</p>
                            <ButtonLink to={href} size="sm" variant="outline">
                              {done ? <RotateCcw size={14} /> : <Play size={14} />}
                              {t(done ? 'history.reread' : 'history.resume')}
                            </ButtonLink>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <Card className="p-0">
                  <EmptyState
                    icon={History}
                    title="Chưa có phiên đọc nào"
                    description="Các phiên đọc và nghe gần đây của bạn sẽ xuất hiện ở đây."
                    action={
                      <ButtonLink to="/reader/library" variant="secondary" size="sm">
                        Mở thư viện
                      </ButtonLink>
                    }
                  />
                </Card>
              )}
            </section>
          </div>
          <aside className="space-y-5">
            <Card>
              <h2 className="text-h3">{t('history.genreAffinity')}</h2>
              <p className="mt-1 text-xs text-muted">{t('history.genreDescription')}</p>
              {statsLoading ? (
                <div aria-busy="true" aria-label="Đang tải thể loại yêu thích">
                  <Skeleton className="mt-5 h-2 w-full" />
                  <ul aria-hidden="true" className="mt-5 space-y-3">
                    {genres.map(([label]) => (
                      <li key={label} className="flex h-4 items-center gap-2">
                        <Skeleton className="size-2 shrink-0" />
                        <Skeleton className="h-2.5 flex-1" />
                        <Skeleton className="h-2.5 w-8" />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : statsReady ? (
                <div className="nh-fade-enter">
                  <div
                    aria-hidden="true"
                    className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full"
                  >
                    {stats.data.genres.map(([label, value, color]) => (
                      <span key={label} className={color} style={{ width: `${value}%` }} />
                    ))}
                  </div>
                  <ul className="mt-5 space-y-3">
                    {stats.data.genres.map(([label, value, color]) => (
                      <li className="flex items-center gap-2 text-xs" key={label}>
                        <span className={`size-2 shrink-0 rounded-full ${color}`} />
                        <span className="flex-1 text-muted">{label}</span>
                        <strong className="tabular-nums">{value}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-5 text-xs text-muted">
                  {stats.status === 'error'
                    ? 'Chưa tải được dữ liệu thể loại.'
                    : 'Chưa đủ dữ liệu để phân tích thể loại.'}
                </p>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{t('history.monthlyTarget')}</h2>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-brand-strong">
                  84 / 100 ch
                </span>
              </div>
              <ProgressBar value={84} label={t('history.monthlyTarget')} className="mt-4" />
              <p className="mt-3 text-xs leading-5 text-muted">{t('history.targetDescription')}</p>
            </Card>
            <Card className="bg-elevated">
              <p className="text-lg font-medium leading-7 text-ink">
                “Những câu chuyện hay làm ngày mai thêm tử tế.”
              </p>
              <p className="mt-4 text-xs text-ink/70">— NovelHub Curator Notes</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{t('history.activeSync')}</h2>
                <Badge tone="green" className="shrink-0 whitespace-nowrap">
                  {t('history.connected')}
                </Badge>
              </div>
              <ul className="mt-4 space-y-3 text-xs">
                {devices.map(([name, status, Icon]) => (
                  <li key={name} className="flex items-center gap-2.5">
                    <Icon size={15} className="shrink-0 text-muted" />
                    <span className="line-clamp-2 min-w-0 flex-1" title={name}>
                      {name}
                    </span>
                    <span className="shrink-0 text-muted">{status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
        <Modal
          open={confirmClear}
          title="Xóa toàn bộ lịch sử đọc?"
          onClose={() => setConfirmClear(false)}
        >
          <p className="text-sm text-muted">
            {items.length} phiên đọc và nghe gần đây sẽ bị xóa khỏi lịch sử. Tiến độ trong thư viện
            của bạn vẫn được giữ nguyên.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setCleared(true);
                setConfirmClear(false);
              }}
            >
              <Trash2 size={15} />
              {t('history.clear')}
            </Button>
          </div>
        </Modal>
      </div>
    </ReaderLayout>
  );
}
