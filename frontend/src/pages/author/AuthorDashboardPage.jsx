import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
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
  Sparkles,
  Star,
  Target,
  UsersRound,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { authorStats, authorStories } from '../../data/mock/author';
import { useMockResource } from '../../context/MockDataContext';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  ProgressBar,
  Reveal,
  Skeleton,
  Tabs,
  Trend,
} from '../../components/ui';

const EDITOR_ROUTE = '/author/stories/demo/chapters/chapter-1/edit';
const statMeta = [
  { icon: BookOpen, tone: 'brand', progress: 75 },
  { icon: Headphones, tone: 'orange', progress: 66 },
  { icon: UsersRound, tone: 'brand', progress: 75 },
  { icon: Coins, tone: 'purple', progress: 80 },
];
const iconTone = {
  brand: 'bg-brand/12 text-brand-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
};
const statusLabels = { Published: 'Đã xuất bản', 'In Review': 'Đang xét duyệt', Draft: 'Bản nháp' };
const statusTones = { Published: 'green', 'In Review': 'orange', Draft: 'neutral' };
const statusFilter = { Published: 'published', 'In Review': 'review', Draft: 'draft' };
const metricLabels = { Unpublished: 'Chưa xuất bản' };
const storyActions = {
  Published: { label: 'Thêm chương', icon: Plus, to: EDITOR_ROUTE },
  'In Review': { label: 'Xem bản gửi duyệt', icon: Eye, to: '/author/submissions' },
  Draft: { label: 'Gửi xét duyệt', icon: Send, to: '/author/submissions' },
};
const feedback = [
  ['Liam Vance', 'Màn hé lộ về linh hồn hộ vệ khiến tôi thật sự bất ngờ!'],
  ['Elena Rivera', 'Người kể sách nói đã thể hiện rất hay đoạn chiến ca.'],
];
/* Chapter currently being written for the first two stories (paired by index). */
const drafts = [
  { chapter: 'Chương 16: Heart of the Ironwood', written: 2840, target: 3500 },
  { chapter: 'Chương 3: The Crystal Archivist', written: 1420, target: 4000 },
];

export function AuthorDashboardPage() {
  const stats = useMockResource('author:stats', authorStats);
  const storiesResource = useMockResource('author:stories', authorStories);
  const feedbackResource = useMockResource('author:feedback', feedback);
  const [filter, setFilter] = useState('all');
  const [reply, setReply] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [goal, setGoal] = useState(15000);
  const [goalDraft, setGoalDraft] = useState('15000');
  const [goalOpen, setGoalOpen] = useState(false);
  const stories = storiesResource.data;
  const shown = stories.filter(
    (story) => filter === 'all' || statusFilter[story.status] === filter,
  );
  const drafting = stories.slice(0, 2);
  const weekWords = 18450;
  const goalNumber = Number(goalDraft);
  const goalInvalid = !Number.isInteger(goalNumber) || goalNumber < 1000 || goalNumber > 100000;

  const sendReply = (event) => {
    event.preventDefault();
    if (!reply.trim()) return;
    setReply('');
    setReplySent(true);
  };

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
              Nhập PDF
            </ButtonLink>
            <ButtonLink to="/author/stories/new">
              <Plus size={16} aria-hidden="true" />
              Tạo truyện mới
            </ButtonLink>
          </div>
        </header>

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
            {stats.data.map(([label, value, delta], index) => {
              const { icon: Icon, tone, progress } = statMeta[index];
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
                    <Trend value={delta} variant="inline" />
                  </p>
                  <ProgressBar
                    value={progress}
                    tone={tone}
                    size="sm"
                    label={`${label}: đạt ${progress}% mục tiêu tháng`}
                    className="mt-4"
                  />
                </Card>
              );
            })}
          </section>
        )}

        <section className="mt-8" aria-labelledby="continue-writing">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="continue-writing" className="text-h3 md:text-h2">
                Tiếp tục sáng tác
              </h2>
              {storiesResource.status === 'ready' ? (
                <Badge>{drafting.length} tác phẩm đang viết</Badge>
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
                <DraftCard key={story.title} story={story} {...drafts[index]} primary={!index} />
              ))}
            </div>
          ) : (
            <Card className="mt-4 p-0">
              <EmptyState
                icon={Edit3}
                title="Chưa có bản nháp nào đang viết"
                description="Tạo truyện mới hoặc nhập bản thảo PDF để tiếp tục sáng tác tại đây."
                action={
                  <ButtonLink to="/author/stories/new" size="sm">
                    <Plus size={14} aria-hidden="true" />
                    Tạo truyện mới
                  </ButtonLink>
                }
              />
            </Card>
          )}
        </section>

        <div className="nh-grid-12 mt-8 grid min-w-0 items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
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
                      { value: 'all', label: 'Tất cả' },
                      { value: 'published', label: 'Đã xuất bản' },
                      { value: 'review', label: 'Đang xét duyệt' },
                      { value: 'draft', label: 'Bản nháp' },
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
                  {shown.map((story) => {
                    const action = storyActions[story.status];
                    const ActionIcon = action.icon;
                    return (
                      <li key={story.title} className="flex items-center gap-4 py-4">
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
                              {metricLabels[story.rating] ?? story.rating}
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
                    );
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

            <Reveal>
              <Card className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="nh-eyebrow">Tiến độ sáng tác tuần</p>
                  <h2 className="mt-3 text-h3">
                    Đã viết {weekWords.toLocaleString('vi-VN')} từ trong tuần này
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {weekWords >= goal
                      ? `Bạn đã vượt mục tiêu ${goal.toLocaleString('vi-VN')} từ của tuần ${Math.round(((weekWords - goal) / goal) * 100)}%.`
                      : `Còn ${(goal - weekWords).toLocaleString('vi-VN')} từ để đạt mục tiêu ${goal.toLocaleString('vi-VN')} từ của tuần.`}
                  </p>
                  <ProgressBar
                    value={Math.min(weekWords, goal)}
                    max={goal}
                    label="Tiến độ mục tiêu viết trong tuần"
                    className="mt-4"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 sm:flex-col sm:items-end">
                  <div className="flex items-center gap-3 rounded-2xl bg-orange/12 px-4 py-3">
                    <Flame size={22} aria-hidden="true" className="text-orange-strong" />
                    <div>
                      <strong className="block text-xl leading-6 text-ink">6 ngày</strong>
                      <span className="text-xs text-ink/70">Chuỗi sáng tác hằng ngày</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setGoalDraft(String(goal));
                      setGoalOpen(true);
                    }}
                  >
                    <Target size={14} aria-hidden="true" />
                    Cài đặt mục tiêu
                  </Button>
                </div>
              </Card>
            </Reveal>
          </div>

          <aside className="min-w-0 space-y-6" aria-label="Trợ lý và phản hồi">
            <Card className="border-purple/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-h3">
                  <span className="grid size-9 place-items-center rounded-xl bg-purple/12 text-purple-strong">
                    <Bot size={18} />
                  </span>
                  Trợ lý sáng tác AI
                </h2>
                <Badge tone="purple">Đang hoạt động 4.5</Badge>
              </div>
              <p className="mt-3 text-caption text-muted">
                Đang phân tích: <strong className="text-ink">The Silent Forest (Chương 16)</strong>
              </p>
              <div className="mt-4 space-y-3">
                <Insight title="Cảnh báo nhịp độ chương">
                  Chuyển cảnh 3 còn đột ngột. Hãy cân nhắc tăng thêm không khí hồi hộp.
                </Insight>
                <Insight title="Kiểm tra tính nhất quán thế giới truyện">
                  Mặt dây chuyền Ironwood được nhắc đến lần gần nhất ở Chương 4.
                </Insight>
              </div>
              <ButtonLink to="/author/ai" variant="tertiary" className="mt-5 w-full">
                <Sparkles size={16} aria-hidden="true" />
                Kiểm tra toàn bộ bản thảo
              </ButtonLink>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-h3">Phản hồi của độc giả</h2>
                {feedbackResource.status === 'ready' && <Badge tone="rose">9+ mới</Badge>}
              </div>
              {feedbackResource.status === 'loading' ? (
                <ul aria-busy="true" aria-label="Đang tải phản hồi" className="mt-4 space-y-3">
                  {feedback.map(([name]) => (
                    <li key={name} className="rounded-2xl bg-elevated p-4">
                      <div className="flex h-5 items-center justify-between gap-2">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="size-3.5" />
                      </div>
                      <span className="mt-1.5 block space-y-3 py-1.5">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/5" />
                      </span>
                    </li>
                  ))}
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
                  {feedbackResource.data.map(([name, text]) => (
                    <li key={name} className="rounded-2xl bg-elevated p-4">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm">{name}</strong>
                        <MessageCircle size={14} aria-hidden="true" className="ml-auto text-rose" />
                      </div>
                      <p className="mt-1.5 text-sm italic leading-6 text-ink/70">“{text}”</p>
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
                  onChange={(event) => {
                    setReply(event.target.value);
                    setReplySent(false);
                  }}
                  placeholder="Gửi phản hồi tới độc giả..."
                  className="mt-2"
                  trailing={
                    <button
                      type="submit"
                      disabled={!reply.trim()}
                      aria-label="Gửi phản hồi"
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-on-brand transition-[opacity,transform] duration-200 active:scale-[0.96] disabled:opacity-40"
                    >
                      <Send size={14} aria-hidden="true" />
                    </button>
                  }
                />
                <p role="status" className="mt-2 min-h-5 text-xs text-brand-strong">
                  {replySent ? 'Đã gửi phản hồi tới độc giả.' : ''}
                </p>
              </form>
            </Card>

            <Card className="flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                <Flame size={20} />
              </span>
              <div className="min-w-0">
                <strong className="text-sm">Hạng Hội NovelHub: Cấp 4</strong>
                <p className="text-caption text-muted">
                  Top 5% bảng xếp hạng tác giả · còn 850 XP để lên Cấp 5
                </p>
              </div>
            </Card>
          </aside>
        </div>

        <Modal open={goalOpen} title="Mục tiêu viết mỗi tuần" onClose={() => setGoalOpen(false)}>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (goalInvalid) return;
              setGoal(goalNumber);
              setGoalOpen(false);
            }}
          >
            <label htmlFor="weekly-goal" className="text-sm font-semibold">
              Số từ mục tiêu
            </label>
            <Input
              id="weekly-goal"
              type="number"
              inputMode="numeric"
              min={1000}
              max={100000}
              step={500}
              value={goalDraft}
              onChange={(event) => setGoalDraft(event.target.value)}
              aria-invalid={goalInvalid}
              aria-describedby="weekly-goal-hint"
              className="mt-2"
            />
            <p
              id="weekly-goal-hint"
              className={`mt-2 text-xs ${goalInvalid ? 'text-rose-strong' : 'text-muted'}`}
            >
              {goalInvalid
                ? 'Nhập một số nguyên từ 1.000 đến 100.000 từ.'
                : 'Mục tiêu được dùng để tính tiến độ sáng tác hằng tuần.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setGoalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={goalInvalid}>
                Lưu mục tiêu
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AuthorLayout>
  );
}

function DraftCard({ story, chapter, written, target, primary = false }) {
  const progress = Math.round((written / target) * 100);
  return (
    <Card as="article" className="flex flex-col p-5">
      <div className="flex gap-4">
        <StoryCover story={story} className="aspect-[2/3] w-16 shrink-0 rounded-2xl" />
        <div className="min-w-0">
          <Badge tone={primary ? 'green' : 'orange'}>
            {primary ? 'Dự án chính' : 'Truyện dài phụ'}
          </Badge>
          <h3 className="mt-2 text-h3">{story.title}</h3>
          <p className="text-caption text-muted">{chapter}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-wrap items-end gap-4 border-t border-hairline pt-4">
        <div className="min-w-[10rem] flex-1">
          <div className="flex justify-between gap-2 text-xs">
            <strong>Đã viết {progress}%</strong>
            <span className="text-muted tabular-nums">
              {written.toLocaleString('vi-VN')} / {target.toLocaleString('vi-VN')} từ
            </span>
          </div>
          <ProgressBar
            value={written}
            max={target}
            tone={primary ? 'brand' : 'orange'}
            size="sm"
            label={`Tiến độ ${chapter}`}
            className="mt-2"
          />
        </div>
        <ButtonLink to={EDITOR_ROUTE} size="sm" variant={primary ? 'primary' : 'secondary'}>
          <Edit3 size={14} aria-hidden="true" />
          {primary ? 'Viết tiếp' : 'Mở bản nháp'}
        </ButtonLink>
      </div>
    </Card>
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
  );
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
  );
}

function StoryListSkeleton() {
  return (
    <ul className="mt-4 divide-y divide-hairline" aria-busy="true" aria-label="Đang tải truyện">
      {[0, 1, 2].map((item) => (
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
  );
}

/* A skeleton bar centred in a box sized like the real text line, so heights match exactly. */
function SkeletonLine({ box = 'h-5', className }) {
  return (
    <span className={`flex items-center ${box}`}>
      <Skeleton className={className} />
    </span>
  );
}

function Insight({ title, children }) {
  return (
    <div className="rounded-2xl bg-purple/10 p-4 ring-1 ring-inset ring-purple/20">
      <strong className="text-sm">{title}</strong>
      <p className="mt-1.5 text-xs leading-5 text-ink/70">{children}</p>
    </div>
  );
}
