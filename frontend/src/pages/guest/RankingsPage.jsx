import { useLocale } from '../../context/LocaleContext';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Info,
  RefreshCw,
  ShieldCheck,
  Star,
  Trophy,
} from '../../components/icons';
import { PublicHeader } from '../../components/public/PublicHeader';
import { PodiumCard, PodiumCardSkeleton } from '../../components/public/PodiumCard';
import { RankingRow, RankingRowSkeleton } from '../../components/public/RankingRow';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Reveal,
  Tabs,
} from '../../components/ui';
import { useBackendDocument } from '../../api/useBackendResource';

const rankingCategories = [
  'Thịnh hành',
  'Đọc nhiều nhất',
  'Nghe nhiều nhất',
  'Đánh giá cao',
  'Mới phát hành',
];
const rankingPeriods = ['Hôm nay', 'Tuần này', 'Tháng này', 'Mọi thời điểm'];
const categoryKeys = ['trending', 'reads', 'audio', 'rating', 'newest'];
const periodKeys = ['day', 'week', 'month', 'all'];
const emptyBoard = { podium: [], items: [], total: 0 };

export function RankingsPage({ embedded = false }) {
  const { t } = useLocale();
  const [category, setCategory] = useState('Thịnh hành');
  const [period, setPeriod] = useState('Tuần này');
  const [page, setPage] = useState(1);
  const resource = useBackendDocument(
    `/catalog/rankings?category=${categoryKeys[rankingCategories.indexOf(category)]}&period=${periodKeys[rankingPeriods.indexOf(period)]}&page=${page}`,
    emptyBoard,
  );
  const ranking = {
    ...resource,
    status: resource.status === 'ready' && !resource.data.total ? 'empty' : resource.status,
  };
  const loading = ranking.status === 'loading';
  const { podium: podiumStories, items: rankingRows, total } = ranking.data;
  const leader = podiumStories[0];
  const formula = [
    [
      category === 'Đánh giá cao' ? 0 : category === 'Mới phát hành' ? 0 : 100,
      t('rankings.viewMetric'),
      'brand',
    ],
    [category === 'Đánh giá cao' ? 100 : 0, t('rankings.ratingMetric'), 'orange'],
    [category === 'Mới phát hành' ? 100 : 0, t('rankings.releaseMetric'), 'purple'],
  ];
  const Root = embedded ? 'div' : 'main';
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-12 pb-20 pt-6 lg:pt-10">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="nh-eyebrow">Những câu chuyện độc giả yêu thích</p>
              <h1 className="mt-4 text-h1 md:text-4xl">Bảng xếp hạng biên tập</h1>
              <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted">
                {t('rankings.intro')}
              </p>
            </div>
            <Badge tone="green">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
              {loading
                ? t('rankings.updating')
                : ranking.status === 'error'
                  ? t('rankings.loadFailed')
                  : t('rankings.latest')}
            </Badge>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-b border-hairline pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <Tabs
                label="Danh mục xếp hạng"
                singleRow
                value={category}
                onChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
                items={rankingCategories.map((item) => ({
                  value: item,
                  label: item === 'Đánh giá cao' ? t('rankings.ratingTab') : item,
                }))}
              />
            </div>
            <div
              role="group"
              aria-label="Khoảng thời gian"
              className="nh-tab-rail flex max-w-full gap-1 overflow-x-auto rounded-full border border-hairline bg-elevated p-1"
            >
              {rankingPeriods.map((item) => (
                <button
                  type="button"
                  aria-pressed={period === item}
                  onClick={() => {
                    setPeriod(item);
                    setPage(1);
                  }}
                  className={`min-h-9 flex-1 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-[background-color,color,box-shadow] duration-200 ease-spring pointer-coarse:min-h-11 ${period === item ? 'bg-orange text-on-orange shadow-[0_6px_16px_-10px_var(--accent-orange)]' : 'text-ink/70 hover:bg-surface/80 hover:text-ink'}`}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </header>
        {ranking.status !== 'error' && ranking.status !== 'empty' && (
          <section aria-labelledby="podium-title">
            <h2
              id="podium-title"
              className="mb-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.14em] text-ink/70"
            >
              <Star size={13} className="fill-orange text-orange" aria-hidden="true" />
              {category} · Dẫn đầu {period.toLowerCase()}
            </h2>
            {loading ? (
              <div
                aria-busy="true"
                aria-label="Đang tải nhóm dẫn đầu"
                className="nh-grid-12 grid gap-4 nh-lg-cols-3 lg:items-end"
              >
                {[2, 1, 3].map((rank) => (
                  <div key={rank} className={rank === 1 ? 'order-first lg:order-none' : ''}>
                    <PodiumCardSkeleton champion={rank === 1} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="nh-grid-12 grid gap-4 nh-lg-cols-3 lg:items-end">
                {[podiumStories[1], podiumStories[0], podiumStories[2]]
                  .filter(Boolean)
                  .map((story, index) => (
                    <Reveal
                      key={story.rank}
                      delay={index * 80}
                      className={story.rank === 1 ? 'order-first lg:order-none' : ''}
                    >
                      <PodiumCard story={story} />
                    </Reveal>
                  ))}
              </div>
            )}
          </section>
        )}
        <div className="nh-grid-12 grid gap-y-8 nh-layout-lg-8-4">
          {ranking.status === 'error' || ranking.status === 'empty' ? (
            <Card className="self-start p-0">
              {ranking.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được bảng xếp hạng"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                  action={
                    <Button variant="secondary" size="sm" onClick={ranking.retry}>
                      <RefreshCw size={14} aria-hidden="true" />
                      Thử lại
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Trophy}
                  title="Chưa có dữ liệu xếp hạng cho bộ lọc này"
                  description={t('rankings.empty')}
                  action={
                    <ButtonLink to="/search" size="sm" trailingIcon={ArrowRight}>
                      Khám phá truyện
                    </ButtonLink>
                  }
                />
              )}
            </Card>
          ) : (
            <section>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
                <h2 className="text-h3 md:text-h2">
                  {total <= 3
                    ? t('rankings.listTitle')
                    : `${page === 1 ? 'Hạng #04' : `Hạng #${(page - 1) * 15 + 1}`} — #${Math.min(page * 15, total)}`}
                </h2>
                <span className="text-sm text-muted">Hiển thị {rankingRows.length} ứng viên</span>
              </div>
              {loading ? (
                <Card
                  aria-busy="true"
                  aria-label="Đang tải danh sách xếp hạng"
                  className="divide-y divide-hairline overflow-hidden p-0"
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <RankingRowSkeleton key={index} />
                  ))}
                </Card>
              ) : (
                <Reveal>
                  <Card className="divide-y divide-hairline overflow-hidden p-0">
                    {rankingRows.map((item) => (
                      <RankingRow item={item} key={item.rank} />
                    ))}
                  </Card>
                </Reveal>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
                <span>
                  Hiển thị đến {Math.min(page * 15, total)} / {total} mục xếp hạng
                </span>
                <Button
                  type="button"
                  onClick={() => setPage((value) => value + 1)}
                  variant="secondary"
                  size="sm"
                  trailingIcon={ArrowRight}
                  disabled={loading || page * 15 >= total}
                >
                  15 truyện tiếp theo
                </Button>
              </div>
              {page > 1 && (
                <Button variant="secondary" onClick={() => setPage((value) => value - 1)}>
                  {t('rankings.previous')}
                </Button>
              )}
            </section>
          )}
          <aside className="space-y-5">
            <Reveal>
              <Card className="p-6">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  <ShieldCheck size={19} className="text-brand" aria-hidden="true" />
                  {t('rankings.criteria')}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">{t('rankings.criteriaHelp')}</p>
                <ul className="mt-4 space-y-3 border-t border-hairline pt-4 text-xs text-muted">
                  {formula.map(([value, label, tone]) => (
                    <li key={label}>
                      <span className="flex justify-between gap-3">
                        <span>{label}</span>
                        <strong className="tabular-nums text-ink">{value}%</strong>
                      </span>
                      <ProgressBar
                        value={value}
                        tone={tone}
                        size="sm"
                        label={label}
                        className="mt-1.5"
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
            <Reveal delay={80}>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-orange-strong">
                    Tác giả nổi bật
                  </p>
                  <Badge>{period}</Badge>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-full bg-orange/16 text-sm font-semibold text-orange-strong ring-1 ring-orange/40">
                    {leader?.author?.slice(0, 2).toUpperCase() || '—'}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">
                      {leader?.author || t('rankings.noAuthor')}
                    </h3>
                    <p className="text-xs text-muted">{leader?.genre || '—'}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">
                  {leader ? `Tác giả của truyện dẫn đầu: ${leader.title}.` : t('rankings.noLeader')}
                </p>
                <div className="nh-grid-12 mt-4 grid nh-cols-2 gap-3 border-y border-hairline py-3 text-center text-sm">
                  <span>
                    <strong className="block font-semibold tabular-nums">
                      {leader?.reads ?? '—'}
                    </strong>
                    <small className="text-xs text-muted">{t('rankings.leaderReads')}</small>
                  </span>
                  <span>
                    <strong className="block font-semibold">{leader?.chapters ?? '—'}</strong>
                    <small className="text-xs text-muted">{t('rankings.publishedChapters')}</small>
                  </span>
                </div>
                {leader && (
                  <ButtonLink to={`/stories/${leader.id}`} className="mt-4 w-full">
                    {t('rankings.viewLeader')}
                  </ButtonLink>
                )}
              </Card>
            </Reveal>
            <Reveal delay={160}>
              <Card className="bg-elevated p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-brand-strong">
                  Nhân viên tuyển chọn
                </p>
                <h3 className="mt-3 flex items-center gap-2 text-base font-semibold">
                  <BookOpenCheck size={18} aria-hidden="true" />
                  Tìm kiếm những tiếng nói mới?
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink/70">{t('rankings.discover')}</p>
                <Link
                  to="/search"
                  className="group mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-strong"
                >
                  Xem bộ sưu tập
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                  />
                </Link>
              </Card>
            </Reveal>
            <Card className="flex gap-3 p-4">
              <Info size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-xs leading-5 text-muted">{t('rankings.refreshHelp')}</p>
            </Card>
          </aside>
        </div>
      </Root>
    </div>
  );
}
