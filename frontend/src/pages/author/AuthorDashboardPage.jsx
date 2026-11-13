import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Coins,
  Edit3,
  Eye,
  Flame,
  Headphones,
  Import,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Star,
  Target,
  Trophy,
  UsersRound,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { StoryCover } from '../../components/story/StoryCover'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  Reveal,
  Skeleton,
  Tabs,
} from '../../components/ui'
const emptyDashboard = {
  stats: {
    views: 0,
    audioPlays: null,
    followers: 0,
    periodViews: 0,
    periodFollowers: 0,
    comparison: {},
  },
  period: null,
  stories: [],
  drafts: [],
  feedback: [],
  draftWords: 0,
  draftCount: 0,
  feedbackTotal: 0,
}
const emptyPeriod = {
  stats: {
    periodViews: 0,
    periodUnlocks: 0,
    periodComments: 0,
    periodEarnings: 0,
    periodFollowers: 0,
    comparison: {},
  },
  period: null,
  revenue: {
    selected: 0,
    today: 0,
    week: 0,
    month: 0,
    selectedUnlocks: 0,
  },
  storyRankings: [],
  stories: [],
  chart: null,
}
const statMeta = [
  {
    icon: BookOpen,
    tone: 'brand',
  },
  {
    icon: Headphones,
    tone: 'orange',
  },
  {
    icon: UsersRound,
    tone: 'brand',
  },
]
const dashboardPeriods = [
  { value: 1, label: 'Hôm nay' },
  { value: 7, label: 'Tuần này' },
  { value: 30, label: 'Tháng này' },
]
const iconTone = {
  brand: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
  blue: 'bg-rose/12 text-rose-strong',
}
const statusLabels = {
  published: 'Đã xuất bản',
  'under-review': 'Đang xét duyệt',
  submitted: 'Đã gửi duyệt',
  approved: 'Đã duyệt',
  draft: 'Bản nháp',
  unpublished: 'Đã gỡ xuất bản',
  archived: 'Đã lưu trữ',
}
const statusTones = {
  published: 'green',
  'under-review': 'orange',
  submitted: 'orange',
  draft: 'neutral',
}
const statusFilter = {
  published: 'published',
  'under-review': 'review',
  submitted: 'review',
  draft: 'draft',
}
export function AuthorDashboardPage() {
  const { t, formatNumber } = useLocale()
  const [period, setPeriod] = useState(1)
  const baseDashboard = useBackendDocument('/author/dashboard', emptyDashboard)
  const periodDashboard = useBackendDocument(
    period === 1 ? null : `/author/dashboard/period?days=${period}`,
    emptyPeriod,
  )
  const [chartOpen, setChartOpen] = useState(false)
  const chartPeriodDashboard = useBackendDocument(
    chartOpen && period === 1 ? '/author/dashboard/period?days=1' : null,
    emptyPeriod,
  )
  const periodStatus = period === 1 ? baseDashboard.status : periodDashboard.status
  const periodData = period === 1 ? baseDashboard.data : periodDashboard.data
  const dashboard = baseDashboard
  const periodLabel = dashboardPeriods.find(item => item.value === period)?.label ?? 'Tuần này'
  const selectedStats = periodData.stats ?? {}
  const stats = {
    ...dashboard,
    status: periodStatus,
    retry: period === 1 ? baseDashboard.retry : periodDashboard.retry,
    data: [
      [`Lượt đọc ${periodLabel.toLowerCase()}`, formatNumber(selectedStats.periodViews ?? 0)],
      [`Lượt nghe ${periodLabel.toLowerCase()}`, '—'],
      [`Người theo dõi mới ${periodLabel.toLowerCase()}`, formatNumber(selectedStats.periodFollowers ?? 0)],
    ],
  }
  const storiesResource = {
    ...dashboard,
    data: dashboard.data.stories,
  }
  const feedbackResource = {
    ...dashboard,
    data: dashboard.data.feedback,
  }
  const [filter, setFilter] = useState('all')
  const [reply, setReply] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [replySent, setReplySent] = useState(false)
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const stories = storiesResource.data
  const shown = stories.filter(story => filter === 'all' || statusFilter[story.status] === filter)
  const drafting = dashboard.data.drafts
  const revenue = periodData.revenue ?? {
    selected: 0,
    today: 0,
    week: 0,
    month: 0,
    selectedUnlocks: 0,
  }
  const periodStats = periodData.stats ?? {}
  const comparison = periodStats.comparison ?? {}
  const periodRankings = periodData.storyRankings ?? []
  const baseRankings = dashboard.data.storyRankings ?? []
  const baseRankingById = new Map(baseRankings.map(item => [item.id, item]))
  const rankings = periodRankings.map(item => {
    const base = baseRankingById.get(item.id)
    return {
      ...base,
      ...item,
      metrics: {
        ...base?.metrics,
        ...item.metrics,
        selected: item.metrics?.selected,
      },
    }
  })
  const comparisonLabel = period === 1 ? 'Hôm qua' : period === 7 ? 'Tuần trước' : 'Tháng trước'
  const comparisonText = (current, previous, unit = '') => {
    if (!comparison.hasData) return `Chưa có dữ liệu ${comparisonLabel.toLowerCase()}`
    if (previous == null) return `Chưa có dữ liệu ${comparisonLabel.toLowerCase()}`
    const delta = Number(current ?? 0) - Number(previous ?? 0)
    if (!delta) return `Không đổi so với ${comparisonLabel.toLowerCase()}`
    const prefix = delta > 0 ? '+' : ''
    return `${prefix}${formatNumber(delta)}${unit} so với ${comparisonLabel.toLowerCase()}`
  }
  const chartData = period === 1 ? chartPeriodDashboard.data.chart : periodData.chart
  const chartStatus = period === 1 ? chartPeriodDashboard.status : periodStatus
  const sendReply = async event => {
    event.preventDefault()
    const target = feedbackResource.data.find(item => item.id === replyTarget)
    if (!target || replyBusy || reply.trim().length < 3) return
    setReplyBusy(true)
    setReplyError(false)
    setReplySent(false)
    try {
      await apiRequest(`/author/comments/${target.id}/reply`, {
        method: 'POST',
        body: { body: reply.trim() },
      })
      setReply('')
      setReplySent(true)
      dashboard.retry()
    } catch {
      setReplyError(true)
    } finally {
      setReplyBusy(false)
    }
  }
  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">Bảng điều khiển tác giả</h1>
            <p className="mt-1 text-sm text-muted">
              Theo dõi hiệu suất truyện, bản nháp đang viết và phản hồi mới từ độc giả.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/author/import" variant="secondary">
              <Import size={16} aria-hidden="true" />
              {t('navigation.importPdf')}
            </ButtonLink>
            <ButtonLink to="/author/stories/new">
              <Plus size={16} aria-hidden="true" />
              Tạo truyện mới
            </ButtonLink>
          </div>
        </header>

        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-brand-soft">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
              Hiệu suất nhanh
            </p>
            <p className="mt-1 text-sm text-muted">
              Thu nhập, lượt đọc và tương tác trong {periodLabel.toLowerCase()}.
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            Kỳ xem
            <select
              aria-label="Kỳ xem dashboard"
              value={period}
              onChange={event => setPeriod(Number(event.target.value))}
              className="min-h-10 rounded-full border border-line bg-surface px-4 text-sm"
            >
              {dashboardPeriods.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </Card>

        {stats.status === 'loading' ? (
          <section
            aria-busy="true"
            aria-label="Đang tải chỉ số tổng quan"
            className="nh-grid-12 mt-6 grid nh-cols-2 gap-3 sm:gap-4 nh-xl-cols-4"
          >
            {statMeta.map((_, index) => (
              <StatSkeleton key={index} />
            ))}
          </section>
        ) : stats.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được chỉ số tổng quan"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
              action={<RetryButton onClick={stats.retry} />}
            />
          </Card>
        ) : stats.status === 'empty' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={Eye}
              title="Chưa có số liệu tổng quan"
              description="Lượt đọc, người theo dõi và doanh thu sẽ xuất hiện khi truyện đầu tiên được xuất bản."
              action={
                <ButtonLink to="/author/stories/new" size="sm">
                  <Plus size={14} aria-hidden="true" />
                  Tạo truyện mới
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <section
            aria-label="Chỉ số tổng quan"
            className="nh-grid-12 nh-fade-enter mt-6 grid nh-cols-2 gap-3 sm:gap-4 nh-xl-cols-4"
          >
            {stats.data.map(([label, value], index) => {
              const { icon: Icon, tone } = statMeta[index]
              const current = index === 0
                ? selectedStats.periodViews
                : index === 2
                  ? selectedStats.periodFollowers
                  : null
              const previous = index === 0
                ? comparison.views
                : index === 2
                  ? comparison.followers
                  : null
              return (
                <Card key={label} className="flex flex-col p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-caption text-muted">{label}</p>
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl ${iconTone[tone]}`}
                    >
                      <Icon size={18} />
                    </span>
                  </div>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tracking-tight tabular-nums">
                    {value}
                    <span className="text-xs font-normal text-muted">
                      {comparisonText(current, previous)}
                    </span>
                  </p>
                  <div aria-hidden="true" className="mt-4 h-1.5 rounded-full bg-elevated" />
                </Card>
              )
            })}
          </section>
        )}

        {periodStatus === 'ready' && (
          <section
            className="nh-grid-12 nh-cols-2 nh-xl-cols-4 mt-5 grid gap-3 sm:gap-4"
            aria-label="Chỉ số theo kỳ"
          >
            <MetricCard
              icon={Coins}
              label={`Thu nhập ${periodLabel.toLowerCase()}`}
              value={`${formatNumber(revenue.selected)} xu`}
              tone="orange"
              comparison={comparisonText(periodStats.periodEarnings, comparison.earnings, ' xu')}
            />
            <MetricCard
              icon={Eye}
              label={`Lượt đọc ${periodLabel.toLowerCase()}`}
              value={formatNumber(periodStats.periodViews ?? 0)}
              tone="brand"
              comparison={comparisonText(periodStats.periodViews, comparison.views)}
            />
            <MetricCard
              icon={BookOpen}
              label="Lượt mở khóa"
              value={formatNumber(periodStats.periodUnlocks ?? revenue.selectedUnlocks ?? 0)}
              tone="purple"
              comparison={comparisonText(periodStats.periodUnlocks, comparison.unlocks)}
            />
            <MetricCard
              icon={MessageCircle}
              label="Bình luận mới"
              value={formatNumber(periodStats.periodComments ?? 0)}
              tone="blue"
              comparison={comparisonText(periodStats.periodComments, comparison.comments)}
            />
          </section>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setChartOpen(true)}>
            <BarChart3 size={15} aria-hidden="true" />
            Xem biểu đồ tổng quan
          </Button>
        </div>

        {drafting.length > 0 && (
          <section className="mt-8" aria-labelledby="continue-writing">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="continue-writing" className="text-h3 md:text-h2">
                  Tiếp tục sáng tác
                </h2>
                {storiesResource.status === 'ready' ? (
                  <Badge>
                    {t('authorData.draftCount', {
                      count: dashboard.data.draftCount,
                    })}
                  </Badge>
                ) : storiesResource.status === 'loading' ? (
                  <Skeleton className="h-6 w-36" />
                ) : null}
              </div>
              <ButtonLink to="/author/drafts" variant="ghost" size="sm" trailingIcon={ArrowRight}>
                Xem tất cả bản nháp
              </ButtonLink>
            </div>
            {storiesResource.status === 'loading' ? (
              <div
                aria-busy="true"
                aria-label="Đang tải bản nháp đang viết"
                className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2"
              >
                <DraftCardSkeleton />
                <DraftCardSkeleton />
              </div>
            ) : storiesResource.status === 'error' ? (
              <Card className="mt-4 p-0">
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được bản nháp đang viết"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={storiesResource.retry} />}
                />
              </Card>
            ) : drafting.length ? (
              <div className="nh-grid-12 nh-fade-enter mt-4 grid gap-4 nh-md-cols-2">
                {drafting.map((story, index) => (
                  <DraftCard
                    key={story.chapterId}
                    story={story}
                    chapter={story.chapter}
                    written={story.written}
                    primary={!index}
                  />
                ))}
              </div>
            ) : null}
          </section>
        )}

        <div className="nh-grid-12 mt-8 grid min-w-0 items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-h3">Thu nhập theo quyển</h2>
                  <p className="mt-1 text-sm text-muted">
                    Xu ghi nhận và lượt đọc theo từng kỳ. Số liệu được lấy từ sổ doanh thu tác giả.
                  </p>
                </div>
                <ButtonLink
                  to="/author/earnings"
                  variant="secondary"
                  size="sm"
                  trailingIcon={ArrowRight}
                >
                  Xem sổ thu nhập
                </ButtonLink>
              </div>
              {periodStatus === 'loading' ? (
                <div aria-busy="true" className="mt-4 space-y-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded-2xl" />
                  ))}
                </div>
              ) : rankings.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-y border-hairline bg-elevated text-muted">
                      <tr>
                        <th className="px-3 py-3">Hạng</th>
                        <th className="px-3 py-3">Tác phẩm</th>
                        <th className="px-3 py-3 text-right">Thu nhập</th>
                        <th className="px-3 py-3 text-right">Mở khóa</th>
                        <th className="px-3 py-3 text-right">Lượt đọc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {rankings.slice(0, 5).map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-3 font-semibold text-orange-strong">
                            #{item.rank}
                          </td>
                          <td className="max-w-[18rem] truncate px-3 py-3 font-semibold">
                            {item.title}
                          </td>
                          <StoryMetricCells item={item} formatNumber={formatNumber} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : periodStatus === 'error' ? (
                <div className="mt-5">
                  <EmptyState
                    tone="rose"
                    headingAs="h3"
                    title="Không tải được số liệu theo kỳ"
                    description="Hãy thử lại để tải số liệu của kỳ xem này."
                    action={<RetryButton onClick={periodDashboard.retry} />}
                  />
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted">Chưa có thu nhập theo kỳ này.</p>
              )}
            </Card>
            <Card>
              <div className="flex flex-col items-start gap-4">
                <div>
                  <h2 className="text-h3">Hiệu suất truyện và trạng thái bản nháp gần đây</h2>
                  <p className="mt-1 text-sm text-muted">
                    Quản lý truyện đang đăng và quy trình xét duyệt
                  </p>
                </div>
                <div className="max-w-full">
                  <Tabs
                    singleRow
                    label="Trạng thái truyện"
                    value={filter}
                    onChange={setFilter}
                    items={[
                      {
                        value: 'all',
                        label: 'Tất cả',
                      },
                      {
                        value: 'published',
                        label: 'Đã xuất bản',
                      },
                      {
                        value: 'review',
                        label: 'Đang xét duyệt',
                      },
                      {
                        value: 'draft',
                        label: 'Bản nháp',
                      },
                    ]}
                  />
                </div>
              </div>
              {storiesResource.status === 'loading' ? (
                <StoryListSkeleton />
              ) : storiesResource.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được danh sách truyện"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={storiesResource.retry} />}
                />
              ) : shown.length ? (
                <ul className="nh-fade-enter mt-4 divide-y divide-hairline">
                  {shown.map(story => {
                    const action = {
                      icon: Edit3,
                      label: t('authorData.manageStory'),
                      to: `/author/stories/${story.id}`,
                    }
                    const ActionIcon = action.icon
                    return (
                      <li key={story.id} className="flex items-center gap-4 py-4">
                        <StoryCover
                          story={story}
                          className="aspect-[2/3] w-12 shrink-0 rounded-xl"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="min-w-0 break-words text-base font-semibold">
                              {story.title}
                            </h3>
                            <Badge tone={statusTones[story.status]}>
                              {statusLabels[story.status] ?? story.status}
                            </Badge>
                          </div>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-muted">
                            <span>{story.chapters} chương</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Star size={13} aria-hidden="true" className="text-orange" />
                              {story.rating}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {story.reads.includes('words')
                                ? story.reads.replace(' words', ' từ')
                                : `${story.reads} lượt đọc`}
                            </span>
                          </p>
                          <ButtonLink
                            to={action.to}
                            variant="secondary"
                            size="sm"
                            className="mt-3 sm:hidden"
                          >
                            <ActionIcon size={14} aria-hidden="true" />
                            {action.label}
                          </ButtonLink>
                        </div>
                        <ButtonLink
                          to={action.to}
                          variant="secondary"
                          size="sm"
                          className="hidden shrink-0 sm:inline-flex"
                        >
                          <ActionIcon size={14} aria-hidden="true" />
                          {action.label}
                        </ButtonLink>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title={
                    stories.length ? 'Không có truyện ở trạng thái này' : 'Bạn chưa có truyện nào'
                  }
                  description={
                    stories.length
                      ? 'Chọn trạng thái khác để xem các truyện còn lại.'
                      : 'Tạo truyện đầu tiên để bắt đầu theo dõi hiệu suất tại đây.'
                  }
                  action={
                    stories.length ? (
                      <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                        Xem tất cả truyện
                      </Button>
                    ) : (
                      <ButtonLink to="/author/stories/new" size="sm">
                        <Plus size={14} aria-hidden="true" />
                        Tạo truyện mới
                      </ButtonLink>
                    )
                  }
                />
              )}
            </Card>

            {dashboard.data.draftWords > 0 && (
              <Reveal>
                <Card className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="nh-eyebrow">{t('authorData.draftContent')}</p>
                    <h2 className="mt-3 text-h3">
                      {t('authorData.words', {
                        count:
                          dashboard.status === 'ready'
                            ? formatNumber(dashboard.data.draftWords)
                            : '—',
                      })}
                    </h2>
                    <p className="mt-1 text-sm text-muted">{t('authorData.noWeeklyTracking')}</p>
                    <div aria-hidden="true" className="mt-4 h-1.5 rounded-full bg-elevated" />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:flex-col sm:items-end">
                    <div className="flex items-center gap-3 rounded-2xl bg-orange/12 px-4 py-3">
                      <Flame size={22} aria-hidden="true" className="text-orange-strong" />
                      <div>
                        <strong className="block text-xl leading-6 text-ink">—</strong>
                        <span className="text-xs text-ink/70">{t('authorData.noStreak')}</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setGoalOpen(true)}>
                      <Target size={14} aria-hidden="true" />
                      Cài đặt mục tiêu
                    </Button>
                  </div>
                </Card>
              </Reveal>
            )}
          </div>

          <aside className="min-w-0 space-y-6" aria-label="Phản hồi độc giả">
            <Card>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                  <Trophy size={18} />
                </span>
                <div>
                  <h2 className="text-h3">Bảng xếp hạng tác phẩm</h2>
                  <p className="text-xs text-muted">
                    Theo thu nhập trong {periodLabel.toLowerCase()}
                  </p>
                </div>
              </div>
              <ol className="mt-4 space-y-3">
                {periodStatus === 'loading' ? (
                  <div className="mt-4 space-y-3" aria-busy="true">
                    {Array.from({ length: 3 }, (_, index) => (
                      <Skeleton key={index} className="h-14 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : rankings.slice(0, 3).map(item => (
                  <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-elevated p-3">
                    <strong className="w-6 text-center text-orange-strong">{item.rank}</strong>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-muted">
                        {formatNumber(item.earnings)} xu · {formatNumber(item.views)} lượt đọc
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {periodStatus === 'error' && (
                <div className="mt-4">
                  <EmptyState
                    tone="rose"
                    headingAs="h3"
                    title="Không tải được xếp hạng"
                    description="Hãy thử lại để tải số liệu của kỳ xem này."
                    action={<RetryButton onClick={periodDashboard.retry} />}
                  />
                </div>
              )}
              {periodStatus === 'ready' && !rankings.length && (
                <p className="mt-4 text-sm text-muted">Chưa có tác phẩm đủ dữ liệu xếp hạng.</p>
              )}
            </Card>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-h3">Phản hồi của độc giả</h2>
                <div className="flex items-center gap-2">
                  {feedbackResource.status === 'ready' && (
                    <Badge tone="rose">
                      {t('authorData.feedbackCount', {
                        count: dashboard.data.feedbackTotal,
                      })}
                    </Badge>
                  )}
                  <ButtonLink to="/author/comments" variant="ghost" size="sm">
                    Xem tất cả
                  </ButtonLink>
                </div>
              </div>
              {feedbackResource.status === 'loading' ? (
                <ul aria-busy="true" aria-label="Đang tải phản hồi" className="mt-4 space-y-3">
                  {Array.from(
                    {
                      length: 2,
                    },
                    (_, index) => (
                      <li key={index} className="rounded-2xl bg-elevated p-4">
                        <div className="flex h-5 items-center justify-between gap-2">
                          <Skeleton className="h-3.5 w-24" />
                          <Skeleton className="size-3.5" />
                        </div>
                        <span className="mt-1.5 block space-y-3 py-1.5">
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-3/5" />
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              ) : feedbackResource.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  headingAs="h3"
                  title="Không tải được phản hồi"
                  description="Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={feedbackResource.retry} />}
                  className="py-8"
                />
              ) : feedbackResource.data.length ? (
                <ul className="nh-fade-enter mt-4 space-y-3">
                  {feedbackResource.data.map(item => (
                    <li key={item.id} className="rounded-2xl bg-elevated p-4">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm">{item.author}</strong>
                        <MessageCircle size={14} aria-hidden="true" className="ml-auto text-rose" />
                      </div>
                      <p className="mt-1.5 text-sm italic leading-6 text-ink/70">“{item.body}”</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={replyBusy || !item.canReply}
                        onClick={() => {
                          setReplyTarget(item.id)
                          setReplySent(false)
                          setReplyError(false)
                        }}
                      >
                        {t('community.reply')}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={MessageCircle}
                  headingAs="h3"
                  title="Chưa có phản hồi mới"
                  description="Bình luận của độc giả về các chương mới sẽ xuất hiện tại đây."
                  action={
                    <ButtonLink to="/author/analytics" variant="secondary" size="sm">
                      Xem phân tích độc giả
                    </ButtonLink>
                  }
                  className="py-8"
                />
              )}
              <form onSubmit={sendReply} className="mt-4">
                <label htmlFor="reader-reply" className="text-xs font-semibold">
                  Trả lời độc giả
                </label>
                <Input
                  id="reader-reply"
                  value={reply}
                  maxLength={2000}
                  disabled={replyBusy || !replyTarget}
                  onChange={event => {
                    setReply(event.target.value)
                    setReplySent(false)
                  }}
                  placeholder="Gửi phản hồi tới độc giả..."
                  className="mt-2"
                  trailing={
                    <button
                      type="submit"
                      disabled={replyBusy || !replyTarget || reply.trim().length < 3}
                      aria-label="Gửi phản hồi"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition-[opacity,transform] duration-200 active:scale-[0.96] disabled:opacity-40"
                    >
                      <Send size={14} aria-hidden="true" />
                    </button>
                  }
                />
                <p role="status" className="mt-2 min-h-5 text-xs text-brand-strong">
                  {replySent ? t('authorData.replySaved') : t('authorData.selectReply')}
                </p>
                {replyError && (
                  <p role="alert" className="mt-2 text-xs text-rose-strong">
                    {t('community.saveError')}
                  </p>
                )}
              </form>
            </Card>

            {dashboard.data.guild && (
              <Card className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                  <Flame size={20} />
                </span>
                <div className="min-w-0">
                  <strong className="text-sm">{t('authorData.guild')}</strong>
                  <p className="text-caption text-muted">{t('authorData.noGuild')}</p>
                </div>
              </Card>
            )}
          </aside>
        </div>

        <Modal
          open={goalOpen}
          title={t('authorData.writingGoal')}
          onClose={() => setGoalOpen(false)}
        >
          <p className="text-sm leading-6 text-muted">{t('authorData.noGoal')}</p>
          <Button variant="secondary" className="mt-5" onClick={() => setGoalOpen(false)}>
            {t('common.close')}
          </Button>
        </Modal>
        <Modal
          open={chartOpen}
          title={`Biểu đồ tổng quan · ${periodLabel}`}
          onClose={() => setChartOpen(false)}
          className="max-w-3xl"
        >
          {chartStatus === 'loading' ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-56 w-full rounded-2xl" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : chartStatus === 'error' ? (
            <EmptyState
              tone="rose"
              title="Không tải được biểu đồ"
              description="Hãy thử lại để tải dữ liệu theo ngày."
              action={<RetryButton onClick={period === 1 ? chartPeriodDashboard.retry : periodDashboard.retry} />}
            />
          ) : chartData?.labels?.length ? (
            <OverviewChart chart={chartData} formatNumber={formatNumber} />
          ) : (
            <EmptyState
              icon={BarChart3}
              title="Chưa có dữ liệu biểu đồ"
              description="Dữ liệu sẽ xuất hiện khi có lượt đọc, doanh thu hoặc tương tác trong kỳ."
            />
          )}
        </Modal>
      </div>
    </AuthorLayout>
  )
}
function DraftCard({ story, chapter, written, primary = false }) {
  const { t } = useLocale()
  return (
    <Card as="article" className="flex flex-col p-5">
      <div className="flex gap-4">
        <StoryCover story={story} className="aspect-[2/3] w-16 shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <Badge tone={primary ? 'green' : 'orange'}>{t('authorData.chapterDraft')}</Badge>
          <h3 className="mt-2 text-h3">{story.title}</h3>
          <p className="text-caption text-muted">{chapter}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-wrap items-end gap-4 border-t border-hairline pt-4">
        <div className="min-w-[10rem] flex-1">
          <div className="flex justify-between gap-2 text-xs">
            <strong>
              {t('authorData.words', {
                count: written.toLocaleString('vi-VN'),
              })}
            </strong>
            <span className="text-muted tabular-nums">{t('authorData.noTarget')}</span>
          </div>
          <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-elevated" />
        </div>
        <ButtonLink
          to={`/author/stories/${story.id}/chapters/${story.chapterId}/edit`}
          size="sm"
          variant={primary ? 'primary' : 'secondary'}
        >
          <Edit3 size={14} aria-hidden="true" />
          {primary ? 'Viết tiếp' : 'Mở bản nháp'}
        </ButtonLink>
      </div>
    </Card>
  )
}

function StoryMetricCells({ item, formatNumber }) {
  const selected = item.metrics?.selected ?? {
    earnings: item.earnings ?? 0,
    unlocks: item.unlocks ?? 0,
    views: item.views ?? 0,
  }
  return (
    <>
      <td className="px-3 py-3 text-right font-semibold tabular-nums">
        {formatNumber(selected.earnings)} xu
        <div className="mt-1 text-[11px] font-normal text-muted">
          Hôm nay {formatNumber(item.metrics?.today?.earnings ?? 0)} · Tuần này{' '}
          {formatNumber(item.metrics?.week?.earnings ?? 0)} · Tháng này{' '}
          {formatNumber(item.metrics?.month?.earnings ?? 0)}
        </div>
        {item.metrics?.sincePublication && (
          <div className="text-[11px] font-normal text-muted">
            Từ khi xuất bản {formatNumber(item.metrics.sincePublication.earnings)}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {formatNumber(selected.unlocks)}
        <div className="mt-1 text-[11px] text-muted">
          Hôm nay {formatNumber(item.metrics?.today?.unlocks ?? 0)} · Tuần này{' '}
          {formatNumber(item.metrics?.week?.unlocks ?? 0)}
        </div>
        {item.metrics?.sincePublication && (
          <div className="text-[11px] text-muted">
            Từ khi xuất bản {formatNumber(item.metrics.sincePublication.unlocks)}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {formatNumber(selected.views)}
        <div className="mt-1 text-[11px] text-muted">
          Hôm nay {formatNumber(item.metrics?.today?.views ?? 0)} · Tuần này{' '}
          {formatNumber(item.metrics?.week?.views ?? 0)} · Tháng này{' '}
          {formatNumber(item.metrics?.month?.views ?? 0)}
        </div>
        {item.metrics?.sincePublication && (
          <div className="text-[11px] text-muted">
            Từ khi xuất bản {formatNumber(item.metrics.sincePublication.views)}
          </div>
        )}
      </td>
    </>
  )
}

function MetricCard({ icon: Icon, label, value, comparison, tone = 'brand' }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-2xl ${iconTone[tone] ?? iconTone.brand}`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
        {comparison && <p className="mt-1 text-[11px] text-muted">{comparison}</p>}
      </div>
    </Card>
  )
}

function OverviewChart({ chart, formatNumber }) {
  const series = [
    { key: 'views', label: 'Lượt đọc', tone: 'bg-brand' },
    { key: 'earnings', label: 'Doanh thu', tone: 'bg-orange' },
    { key: 'unlocks', label: 'Mở khóa', tone: 'bg-purple' },
    { key: 'comments', label: 'Bình luận', tone: 'bg-rose' },
  ]
  const maxByKey = Object.fromEntries(
    series.map(item => [item.key, Math.max(1, ...(chart[item.key] ?? []))]),
  )
  return (
    <div>
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {series.map(item => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${item.tone}`} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
      <div className="mt-5 overflow-x-auto pb-2">
        <div
          className="grid min-w-[34rem] items-end gap-1"
          style={{ gridTemplateColumns: `repeat(${chart.labels.length}, minmax(1.25rem, 1fr))` }}
          aria-label="Biểu đồ số liệu theo ngày"
        >
          {chart.labels.map((label, index) => {
            const values = series.map(item => Number(chart[item.key]?.[index] ?? 0))
            const height = Math.max(...values)
            return (
              <div key={label} className="flex h-56 items-end justify-center gap-0.5 rounded-t-xl bg-surface px-1 pt-3">
                {series.map((item, seriesIndex) => (
                  <span
                    key={item.key}
                    title={`${item.label}: ${formatNumber(values[seriesIndex])}`}
                    className={`w-1.5 rounded-t-sm ${item.tone}`}
                    style={{
                      height: `${Math.max(2, (values[seriesIndex] / maxByKey[item.key]) * 100)}%`,
                      opacity: height ? 1 : 0.35,
                    }}
                  />
                ))}
                <span className="sr-only">{label}</span>
              </div>
            )
          })}
        </div>
        <div
          className="mt-2 grid min-w-[34rem] gap-1 text-center text-[10px] text-muted"
          style={{ gridTemplateColumns: `repeat(${chart.labels.length}, minmax(1.25rem, 1fr))` }}
        >
          {chart.labels.map(label => (
            <span key={label}>{label.slice(5)}</span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Mỗi cột là dữ liệu thật ghi nhận trong MongoDB theo ngày Việt Nam.</p>
    </div>
  )
}
function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  )
}
function StatSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="block h-10 pt-1">
          <Skeleton className="h-3 w-24" />
        </span>
        <Skeleton className="size-9 shrink-0 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-7 w-28 rounded-lg" />
      <Skeleton className="mt-4 h-1.5 w-full" />
    </Card>
  )
}
function DraftCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-5">
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-28" />
          <SkeletonLine box="mt-2 h-7" className="h-5 w-3/5" />
          <SkeletonLine className="h-3 w-4/5" />
          <SkeletonLine box="h-5 sm:hidden" className="h-3 w-2/5" />
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-wrap items-end gap-4 border-t border-hairline pt-4">
        <div className="min-w-[10rem] flex-1">
          <div className="flex justify-between gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="mt-3 h-1.5 w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    </Card>
  )
}
function StoryListSkeleton() {
  return (
    <ul className="mt-4 divide-y divide-hairline" aria-busy="true" aria-label="Đang tải truyện">
      {[0, 1, 2].map(item => (
        <li key={item} className="flex items-center gap-4 py-4">
          <Skeleton className="aspect-[2/3] w-12 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonLine box="h-6 w-3/5 sm:w-2/5" className="h-4 w-full" />
              <Skeleton className="h-6 w-24" />
            </div>
            <SkeletonLine box="mt-1 h-5" className="h-3 w-3/5" />
            <SkeletonLine box="h-5 sm:hidden" className="h-3 w-2/5" />
            <Skeleton className="mt-3 h-9 w-32 sm:hidden" />
          </div>
          <Skeleton className="hidden h-9 w-32 shrink-0 sm:block" />
        </li>
      ))}
    </ul>
  )
}

/* A skeleton bar centred in a box sized like the real text line, so heights match exactly. */
function SkeletonLine({ box = 'h-5', className }) {
  return (
    <span className={`flex items-center ${box}`}>
      <Skeleton className={className} />
    </span>
  )
}
