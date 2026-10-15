import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Edit3,
  Eye,
  FileText,
  Headphones,
  Images,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Star,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { managedChapters } from '../../data/mock/author';
import { useMockResource } from '../../context/MockDataContext';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  Skeleton,
  Tabs,
} from '../../components/ui';

const EDITOR_ROUTE = '/author/stories/demo/chapters/chapter-1/edit';
const PAGE_SIZE = 5;
const story = { id: 'silent-forest', title: 'The Silent Forest', author: 'Mira Lane' };
const tabItems = [
  { value: 'chapters', label: 'Chương · 16' },
  { value: 'details', label: 'Thông tin và tóm tắt truyện' },
  { value: 'media', label: 'Media và bản âm thanh · 8' },
  { value: 'reviews', label: 'Bản gửi và đánh giá' },
  { value: 'analytics', label: 'Phân tích truyện' },
];
const linkedTabs = {
  media: {
    icon: Images,
    title: '8 tệp media và 6 bản âm thanh',
    description: 'Ảnh bìa, minh họa và bản thu âm của truyện được quản lý trong Thư viện media.',
    to: '/author/media',
    action: 'Mở thư viện media',
  },
  reviews: {
    icon: Send,
    title: '1 chương đang chờ xét duyệt',
    description: 'Theo dõi phản hồi của biên tập viên và lịch sử gửi duyệt cho từng chương.',
    to: '/author/submissions',
    action: 'Xem bản gửi duyệt',
  },
  analytics: {
    icon: BarChart3,
    title: '1,2M lượt đọc · giữ chân 68%',
    description: 'Xem lượt đọc, tỷ lệ giữ chân và doanh thu theo từng chương.',
    to: '/author/analytics',
    action: 'Mở phân tích truyện',
  },
};
const filters = [
  { value: 'All', label: 'Tất cả' },
  { value: 'Published', label: 'Đã xuất bản' },
  { value: 'Scheduled', label: 'Đã lên lịch' },
  { value: 'In Review', label: 'Đang xét duyệt' },
  { value: 'Draft', label: 'Bản nháp' },
];
const statusLabels = {
  Published: 'Đã xuất bản',
  Scheduled: 'Đã lên lịch',
  'In Review': 'Đang xét duyệt',
  Draft: 'Bản nháp',
};
const statusTones = { Published: 'green', Scheduled: 'orange', 'In Review': 'purple' };
const formatChapterNote = (note) =>
  note
    .replace('Scheduled for Nov 2, 2026', 'Đã lên lịch ngày 02/11/2026')
    .replace('Draft · Autosaved 12m ago', 'Bản nháp · Tự động lưu 12 phút trước')
    .replace('Published on Oct 24, 2026', 'Xuất bản ngày 24/10/2026')
    .replace('Published on Oct 17, 2026', 'Xuất bản ngày 17/10/2026')
    .replace('Published on Oct 10, 2026', 'Xuất bản ngày 10/10/2026')
    .replace('Published on Jul 18, 2026', 'Xuất bản ngày 18/07/2026')
    .replace('Published on Jul 11, 2026', 'Xuất bản ngày 11/07/2026');
const formatChapterMetric = (value) =>
  value
    .replace('Est. ', 'Khoảng ')
    .replace(' min', ' phút')
    .replace('Target ', 'Mục tiêu ')
    .replace(' reads', ' lượt đọc');
const priceLabels = { '25 Coins': '25 xu', Pending: 'Chờ thiết lập', Free: 'Miễn phí' };
const storyStats = [
  [FileText, '184.200', 'từ'],
  [BookOpen, '15', 'chương đã xuất bản'],
  [Eye, '1,2M', 'lượt đọc'],
  [Star, '4,8', '(3,4K đánh giá)'],
];

export function StoryManagerPage() {
  const { storyId = 'demo' } = useParams();
  const [tab, setTab] = useState('chapters');
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const chaptersResource = useMockResource(`author:chapters:${storyId}`, managedChapters);
  const chapters = useMemo(
    () =>
      chaptersResource.data.filter(
        (chapter) =>
          (filter === 'All' || chapter.status === filter) &&
          chapter.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [chaptersResource.data, filter, query],
  );
  const pageCount = Math.max(1, Math.ceil(chapters.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = chapters.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const linked = linkedTabs[tab];

  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <nav aria-label="Đường dẫn" className="mb-4 text-caption text-ink/70">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                to="/author"
                className="inline-flex min-h-8 items-center hover:text-brand-strong"
              >
                Studio tác giả
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>Truyện</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-ink">
              {story.title}
            </li>
          </ol>
        </nav>

        <Card bezel innerClassName="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start lg:items-center">
            <StoryCover
              story={story}
              eager
              className="aspect-[2/3] w-24 shrink-0 rounded-2xl shadow-soft sm:w-28"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-h2 sm:text-h1">{story.title}</h1>
                <Badge tone="green">Truyện dài kỳ</Badge>
                <Badge tone="orange">Kỳ ảo và Bí ẩn</Badge>
              </div>
              <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">
                The wind moved gently through the ancient trees, carrying whispers of forgotten
                stories. Mira Lane&apos;s bestselling slow-burn mystery epic.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {storyStats.map(([Icon, value, label]) => (
                  <li key={label} className="inline-flex items-center gap-1.5">
                    <Icon size={15} aria-hidden="true" className="text-brand" />
                    <strong className="text-ink tabular-nums">{value}</strong> {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
              <ButtonLink to={EDITOR_ROUTE}>
                <Plus size={16} aria-hidden="true" />
                Thêm chương mới
              </ButtonLink>
              <Button variant="secondary" onClick={() => setTab('details')}>
                <Edit3 size={16} aria-hidden="true" />
                Sửa thông tin
              </Button>
              <ButtonLink to="/stories/demo" variant="secondary">
                <Eye size={16} aria-hidden="true" />
                Xem trước như độc giả
              </ButtonLink>
            </div>
          </div>
        </Card>

        <div className="mt-6 max-w-full">
          <Tabs
            singleRow
            label="Mục quản lý truyện"
            value={tab}
            onChange={setTab}
            items={tabItems}
          />
        </div>

        {tab === 'details' ? (
          <StoryDetails />
        ) : linked ? (
          <Card className="mt-5 p-0">
            <EmptyState
              icon={linked.icon}
              title={linked.title}
              description={linked.description}
              action={
                <ButtonLink
                  to={linked.to}
                  variant="secondary"
                  size="sm"
                  trailingIcon={ChevronRight}
                >
                  {linked.action}
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <div className="nh-grid-12 mt-5 grid items-start gap-6 nh-layout-xl-8-4">
            <Card
              as="section"
              aria-label="Danh sách chương"
              className="min-w-0 overflow-hidden p-0"
            >
              <div className="flex flex-col gap-3 border-b border-hairline p-4 2xl:flex-row 2xl:items-center">
                <Input
                  icon={Search}
                  type="search"
                  enterKeyHint="search"
                  aria-label="Tìm tiêu đề chương"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm tiêu đề chương..."
                  className="2xl:w-64 2xl:shrink-0"
                />
                <div className="min-w-0 max-w-full">
                  <Tabs
                    singleRow
                    label="Lọc trạng thái chương"
                    value={filter}
                    onChange={(value) => {
                      setFilter(value);
                      setPage(1);
                    }}
                    items={filters}
                  />
                </div>
              </div>
              {chaptersResource.status === 'loading' ? (
                <div aria-busy="true" aria-label="Đang tải chương" className="overflow-x-auto">
                  <table aria-hidden="true" className="w-full text-left sm:min-w-[680px]">
                    <ChapterTableHead />
                    <tbody className="divide-y divide-hairline">
                      {[0, 1, 2, 3, 4].map((item) => (
                        <ChapterRowSkeleton key={item} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : chaptersResource.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được danh sách chương"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={chaptersResource.retry} />}
                />
              ) : chaptersResource.status === 'empty' ? (
                <EmptyState
                  icon={BookOpen}
                  title="Truyện chưa có chương nào"
                  description="Viết chương đầu tiên để bắt đầu đăng truyện."
                  action={
                    <ButtonLink to={EDITOR_ROUTE} size="sm">
                      <Plus size={14} aria-hidden="true" />
                      Viết chương đầu tiên
                    </ButtonLink>
                  }
                />
              ) : pageRows.length ? (
                <div className="nh-fade-enter overflow-x-auto">
                  <table className="w-full text-left sm:min-w-[680px]">
                    <ChapterTableHead />
                    <tbody className="divide-y divide-hairline">
                      {pageRows.map((chapter) => (
                        <ChapterRow key={chapter.number} chapter={chapter} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Search}
                  title="Không có chương phù hợp"
                  description="Không có chương nào khớp bộ lọc hoặc từ khóa hiện tại."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setFilter('All');
                        setQuery('');
                      }}
                    >
                      Xóa bộ lọc
                    </Button>
                  }
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-4 text-caption text-muted">
                {chaptersResource.status === 'loading' ? (
                  <>
                    <Skeleton className="my-1 h-3 w-40" />
                    <div aria-hidden="true" className="flex items-center gap-2">
                      <Skeleton className="h-9 w-24" />
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-9 w-20" />
                    </div>
                  </>
                ) : (
                  <span>
                    Đang hiển thị {pageRows.length} / {chapters.length} chương
                  </span>
                )}
                {chaptersResource.status === 'ready' && pageCount > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ChevronLeft size={14} aria-hidden="true" />
                      Trước
                    </Button>
                    <span className="tabular-nums" aria-live="polite">
                      Trang {currentPage} / {pageCount}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={currentPage === pageCount}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      Sau
                      <ChevronRight size={14} aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
            <StoryHealth />
          </div>
        )}
      </div>
    </AuthorLayout>
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

function ChapterTableHead() {
  return (
    <thead className="bg-elevated text-xs font-semibold uppercase tracking-[.12em] text-ink/70 sm:whitespace-nowrap">
      <tr>
        <th scope="col" className="px-4 py-3 sm:px-5">
          Chương và tiêu đề
        </th>
        <th scope="col" className="hidden px-3 py-3 sm:table-cell">
          Trạng thái
        </th>
        <th scope="col" className="hidden px-3 py-3 sm:table-cell">
          Chỉ số
        </th>
        <th scope="col" className="hidden px-3 py-3 sm:table-cell">
          Mức giá
        </th>
        <th scope="col" className="px-4 py-3 text-right">
          Thao tác
        </th>
      </tr>
    </thead>
  );
}

function ChapterRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-4 sm:min-w-[11.5rem] sm:px-5">
        {/* Titles and notes wrap to two lines in the 11.5rem column (2 × 26px + 4px + 2 × 20px). */}
        <div className="flex h-[3.25rem] flex-col justify-center gap-3">
          <Skeleton className="h-3.5 w-full max-w-48" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
        <div className="mt-1 flex h-10 flex-col justify-center gap-2">
          <Skeleton className="h-3 w-full max-w-40" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <Skeleton className="mt-2 h-6 w-24 sm:hidden" />
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <Skeleton className="h-6 w-24" />
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <Skeleton className="my-[3px] h-3.5 w-20" />
        <Skeleton className="mt-1.5 h-3 w-24" />
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <Skeleton className="h-3.5 w-20" />
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24 pointer-coarse:h-11" />
          <Skeleton className="size-9 rounded-full pointer-coarse:size-11" />
        </div>
      </td>
    </tr>
  );
}

function ChapterRow({ chapter }) {
  const draft = chapter.status === 'Draft';
  return (
    <tr className="transition-colors duration-200 hover:bg-elevated/60">
      <td className="px-4 py-4 sm:min-w-[11.5rem] sm:px-5">
        <div className="flex gap-3">
          <div className="min-w-0">
            <strong className="text-sm">
              Chương {chapter.number}: {chapter.title}
            </strong>
            <p className="mt-1 text-xs leading-5 text-muted">{formatChapterNote(chapter.note)}</p>
            <Badge tone={statusTones[chapter.status] ?? 'neutral'} className="mt-2 sm:hidden">
              {statusLabels[chapter.status] ?? chapter.status}
            </Badge>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-4 sm:table-cell">
        <Badge tone={statusTones[chapter.status] ?? 'neutral'} className="whitespace-nowrap">
          {statusLabels[chapter.status] ?? chapter.status}
        </Badge>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-4 text-sm sm:table-cell">
        <strong className="tabular-nums">{chapter.words} từ</strong>
        <p className="whitespace-nowrap text-xs text-muted">{formatChapterMetric(chapter.reads)}</p>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-4 text-sm sm:table-cell">
        <span className="inline-flex items-center gap-1.5">
          <Coins size={14} aria-hidden="true" className="text-orange" />
          {priceLabels[chapter.price] ?? chapter.price}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <ButtonLink to={EDITOR_ROUTE} variant={draft ? 'primary' : 'secondary'} size="sm">
            {draft ? 'Viết tiếp' : chapter.status === 'Scheduled' ? 'Đổi lịch' : 'Chỉnh sửa'}
          </ButtonLink>
          <ButtonLink
            to="/author/analytics"
            variant="secondary"
            size="sm"
            aria-label={`Xem phân tích chương ${chapter.number}: ${chapter.title}`}
            className="w-9 px-0 pointer-coarse:w-11"
          >
            <BarChart3 size={15} aria-hidden="true" />
          </ButtonLink>
        </div>
      </td>
    </tr>
  );
}

function StoryDetails() {
  const [title, setTitle] = useState(story.title);
  const [synopsis, setSynopsis] = useState(
    "The wind moved gently through the ancient trees, carrying whispers of forgotten stories. Mira Lane's bestselling slow-burn mystery epic.",
  );
  const [status, setStatus] = useState('idle');
  const titleError = !title.trim();
  const synopsisError = synopsis.trim().length < 40;
  const submit = (event) => {
    event.preventDefault();
    if (titleError || synopsisError) {
      setStatus('invalid');
      return;
    }
    setStatus('saving');
    window.setTimeout(() => setStatus('saved'), 700);
  };
  const showErrors = status === 'invalid';
  return (
    <Card as="form" noValidate onSubmit={submit} className="mt-5 max-w-3xl">
      <h2 className="text-h3">Thông tin và tóm tắt truyện</h2>
      <p className="mt-1 text-sm text-muted">
        Thông tin này hiển thị trên trang truyện cho độc giả.
      </p>
      <label htmlFor="story-title" className="mt-6 block text-sm font-semibold">
        Tên truyện
      </label>
      <Input
        id="story-title"
        value={title}
        maxLength={100}
        onChange={(event) => {
          setTitle(event.target.value);
          setStatus('idle');
        }}
        aria-invalid={showErrors && titleError}
        aria-describedby={showErrors && titleError ? 'story-title-error' : undefined}
        className="mt-2"
      />
      {showErrors && titleError && (
        <p id="story-title-error" className="mt-2 text-xs text-rose-strong">
          Tên truyện không được để trống.
        </p>
      )}
      <label htmlFor="story-synopsis" className="mt-5 flex justify-between text-sm font-semibold">
        <span>Tóm tắt truyện</span>
        <span className="font-normal text-muted tabular-nums">{synopsis.length}/2000</span>
      </label>
      <textarea
        id="story-synopsis"
        value={synopsis}
        maxLength={2000}
        onChange={(event) => {
          setSynopsis(event.target.value);
          setStatus('idle');
        }}
        aria-invalid={showErrors && synopsisError}
        aria-describedby="story-synopsis-hint"
        className="mt-2 min-h-36 w-full resize-y rounded-3xl border border-line bg-surface p-4 text-base leading-6 text-ink outline-none transition-colors focus:border-brand sm:text-sm"
      />
      <p
        id="story-synopsis-hint"
        className={`mt-2 text-xs ${showErrors && synopsisError ? 'text-rose-strong' : 'text-muted'}`}
      >
        Tóm tắt cần ít nhất 40 ký tự.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="mr-auto text-xs text-brand-strong">
          {status === 'saved' ? 'Đã lưu thông tin truyện.' : ''}
        </p>
        <Button type="submit" disabled={status === 'saving'}>
          <Save size={16} aria-hidden="true" />
          {status === 'saving' ? 'Đang lưu...' : 'Lưu thông tin'}
        </Button>
      </div>
    </Card>
  );
}

function StoryHealth() {
  return (
    <aside className="min-w-0 space-y-6 xl:sticky xl:top-24" aria-label="Sức khỏe truyện">
      <Card>
        <h2 className="flex items-center gap-2 border-b border-hairline pb-4 text-h3">
          <BarChart3 size={20} aria-hidden="true" className="text-brand" />
          Sức khỏe truyện và cột mốc
        </h2>
        <Metric label="Mức độ cập nhật đều đặn hằng tuần" value={100} />
        <Metric label="Tỷ lệ giữ chân độc giả" value={68} />
        <div className="mt-5 rounded-2xl border border-hairline bg-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <Headphones size={16} aria-hidden="true" className="text-orange-strong" />
              Thuyết minh âm thanh
            </span>
            <Badge tone="orange">6/15 chương</Badge>
          </div>
          <ProgressBar
            value={6}
            max={15}
            tone="orange"
            size="sm"
            label="Số chương đã có bản âm thanh"
            className="mt-3"
          />
          <ButtonLink
            to="/author/media"
            variant="ghost"
            size="sm"
            className="-ml-3 mt-2 px-3 text-orange-strong"
          >
            Quản lý bản âm thanh
          </ButtonLink>
        </div>
        <h3 className="mt-5 text-sm font-semibold">Cột mốc xuất bản</h3>
        <ul className="mt-3 space-y-3">
          {[
            ['Vượt mốc 100.000 từ', true],
            ['Đạt tổng 1.000.000 lượt đọc', true],
            ['Thu âm đủ 15 chương', false],
            ['Mở khóa phiên bản bìa cứng cao cấp', false],
          ].map(([label, done]) => (
            <li key={label} className="flex items-start gap-2 text-sm">
              <CheckCircle2
                size={16}
                aria-hidden="true"
                className={`mt-0.5 shrink-0 ${done ? 'text-brand' : 'text-muted'}`}
              />
              <span className={done ? 'text-muted' : ''}>
                {label}
                {done && <span className="sr-only"> (đã đạt)</span>}
              </span>
            </li>
          ))}
        </ul>
        <ButtonLink to="/author/analytics" variant="secondary" className="mt-5 w-full">
          <BarChart3 size={16} aria-hidden="true" />
          Xem phân tích truyện
        </ButtonLink>
      </Card>
      <Card>
        <p className="flex items-center gap-2 text-sm font-semibold text-orange-strong">
          <Sparkles size={16} aria-hidden="true" />
          Lời khuyên của biên tập viên cho Hồi II
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Tỷ lệ giữ chân độc giả tăng 74% quanh Chương 14. Hãy duy trì nhịp kể gọn ở Chương 16 để
          giữ đà mở khóa thuê bao.
        </p>
      </Card>
    </aside>
  );
}

function Metric({ label, value }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <strong className="text-brand-strong tabular-nums">{value}%</strong>
      </div>
      <ProgressBar value={value} size="sm" label={label} className="mt-2" />
    </div>
  );
}
