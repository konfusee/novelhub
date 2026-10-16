import { useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  Archive,
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
import { useBackendDocument, useBackendResource } from '../../api/useBackendResource';
import { apiRequest } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
import { StoryCover } from '../../components/story/StoryCover';
import { ChapterOrderDialog } from './ChapterOrderDialog';
import { ChapterLifecycleDialog } from './ChapterLifecycleDialog';
import { ChapterReleaseDialog, StoryReleaseDialog } from './StoryReleaseDialog';
import { ROUTES } from '../../app/routes';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Modal,
  Tabs,
} from '../../components/ui';

const PAGE_SIZE = 5;
const emptyWorkspace = {
  story: { id: null, title: '—', description: '', genres: [], canEdit: false, version: 0 },
  chapters: [],
  stats: { availableWords: 0, publishedChapters: 0, reads: 0, rating: '—', ratings: 0 },
};
const normalStatus = (value) =>
  ({
    published: 'Published',
    scheduled: 'Scheduled',
    due: 'Scheduled',
    submitted: 'In Review',
    draft: 'Draft',
    approved: 'Approved',
    unpublished: 'Unpublished',
    archived: 'Archived',
    cancelled: 'Cancelled',
  })[value] ?? value;
const tabItems = [
  { value: 'chapters', label: 'Chương' },
  { value: 'details', label: 'Thông tin và tóm tắt truyện' },
  { value: 'media', label: 'Media và bản âm thanh' },
  { value: 'reviews', label: 'Bản gửi và đánh giá' },
  { value: 'analytics', label: 'Phân tích truyện' },
];
const linkedTabs = {
  media: {
    icon: Images,
    titleKey: 'managerData.mediaTitle',
    descriptionKey: 'managerData.mediaHint',
    to: '/author/media',
    action: 'Mở thư viện media',
  },
  reviews: {
    icon: Send,
    title: 'Bản gửi và kết quả xét duyệt',
    description: 'Theo dõi phản hồi của biên tập viên và lịch sử gửi duyệt cho từng chương.',
    to: '/author/submissions',
    action: 'Xem bản gửi duyệt',
  },
  analytics: {
    icon: BarChart3,
    title: 'Phân tích truyện',
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
  Approved: 'Đã duyệt',
  Unpublished: 'Đã gỡ xuất bản',
  Archived: 'Đã lưu trữ',
  Cancelled: 'Đã hủy',
};
const statusTones = { Published: 'green', Scheduled: 'orange', 'In Review': 'purple' };
export function StoryManagerPage() {
  const { storyId } = useParams();
  const { t } = useLocale();
  const [search, setSearch] = useSearchParams();
  const tab = tabItems.some((item) => item.value === search.get('tab'))
    ? search.get('tab')
    : 'chapters';
  const setTab = (value) =>
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set('tab', value);
      return next;
    });
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const workspace = useBackendDocument(`/author/stories/${storyId}/workspace`, emptyWorkspace);
  const [savedStory, setSavedStory] = useState(null);
  const story = savedStory?.source === workspace.data ? savedStory.story : workspace.data.story;
  const chaptersResource = {
    ...workspace,
    status:
      workspace.status === 'ready' && !workspace.data.chapters.length ? 'empty' : workspace.status,
    data: workspace.data.chapters.map((chapter) => ({
      ...chapter,
      status: normalStatus(chapter.status),
    })),
  };
  const storyStats = [
    [FileText, workspace.data.stats.availableWords, t('managerData.knownWords')],
    [BookOpen, workspace.data.stats.publishedChapters, t('managerData.publishedChapters')],
    [Eye, workspace.data.stats.reads, t('managerData.reads')],
    [
      Star,
      workspace.data.stats.rating,
      t('managerData.ratingCount', { count: workspace.data.stats.ratings }),
    ],
  ];
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBusy, setNewBusy] = useState(false);
  const [newError, setNewError] = useState('');
  const [notice, setNotice] = useState('');
  const [orderOpen, setOrderOpen] = useState(false);
  const [chapterAction, setChapterAction] = useState(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseChapter, setReleaseChapter] = useState(null);
  const createChapter = async (event) => {
    event.preventDefault();
    if (newBusy || !newTitle.trim()) return;
    setNewBusy(true);
    setNewError('');
    try {
      await apiRequest(`/author/stories/${storyId}/chapters`, {
        method: 'POST',
        body: { title: newTitle.trim(), paragraphs: [''] },
      });
      setNewOpen(false);
      setNewTitle('');
      setNotice(t('managerData.created'));
      workspace.retry();
    } catch (error) {
      setNewError(error.message || t('managerData.saveError'));
    } finally {
      setNewBusy(false);
    }
  };
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

  if (workspace.status === 'error' || workspace.status === 'empty')
    return (
      <AuthorLayout>
        <div className="page-author py-7">
          <Card className="p-0">
            <EmptyState
              icon={AlertTriangle}
              title={t(
                workspace.status === 'empty' ? 'managerData.notFound' : 'managerData.loadError',
              )}
              action={<RetryButton onClick={workspace.retry} />}
            />
          </Card>
        </div>
      </AuthorLayout>
    );
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
                <Badge tone="green">
                  {story.status ? (statusLabels[normalStatus(story.status)] ?? story.status) : '—'}
                </Badge>
                <Badge tone="orange">{story.genres.join(', ') || '—'}</Badge>
              </div>
              <p className="mt-2 max-w-[65ch] text-sm leading-6 text-muted">{story.description}</p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                {storyStats.map(([Icon, value, label]) => (
                  <li key={label} className="inline-flex items-center gap-1.5">
                    <Icon size={15} aria-hidden="true" className="text-brand" />
                    <strong className="text-ink tabular-nums">
                      {workspace.status === 'ready' ? value : '—'}
                    </strong>{' '}
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
              {(story.canReleaseMetadata ?? story.status === 'approved') && (
                <Button
                  variant="secondary"
                  disabled={workspace.status !== 'ready'}
                  onClick={() => setReleaseOpen(true)}
                >
                  {t('storyRelease.title')}
                </Button>
              )}
              {story.status === 'published' && (
                <ButtonLink variant="secondary" to={ROUTES.story(storyId)}>
                  {t('storyRelease.viewPublic')}
                </ButtonLink>
              )}
              <Button
                disabled={!story.canEdit || workspace.status !== 'ready'}
                onClick={() => setNewOpen(true)}
              >
                <Plus size={16} aria-hidden="true" />
                Thêm chương mới
              </Button>
              <Button variant="secondary" onClick={() => setTab('details')}>
                <Edit3 size={16} aria-hidden="true" />
                Sửa thông tin
              </Button>
              {story.canEdit && (
                <ButtonLink to={`/author/import?storyId=${storyId}`} variant="secondary">
                  {t('authorDraftActions.import')}
                </ButtonLink>
              )}
              <ButtonLink to={`/author/stories/${storyId}/preview`} variant="secondary">
                <Eye size={16} aria-hidden="true" />
                Xem trước như độc giả
              </ButtonLink>
            </div>
          </div>
        </Card>

        {releaseOpen && (
          <StoryReleaseDialog
            storyId={storyId}
            onClose={() => setReleaseOpen(false)}
            onReleased={() => {
              setReleaseOpen(false);
              setNotice(t('storyRelease.success'));
              workspace.retry();
            }}
          />
        )}
        {releaseChapter && (
          <ChapterReleaseDialog
            key={releaseChapter.id}
            storyId={storyId}
            chapterId={releaseChapter.id}
            onClose={() => setReleaseChapter(null)}
            onReleased={() => {
              setReleaseChapter(null);
              setNotice(t('chapterRelease.success'));
              workspace.retry();
            }}
          />
        )}
        <div className="mt-6 max-w-full">
          <Tabs
            singleRow
            label="Mục quản lý truyện"
            value={tab}
            onChange={setTab}
            items={tabItems.map((item) =>
              item.value === 'chapters'
                ? {
                    ...item,
                    label: `Chương · ${workspace.status === 'ready' ? workspace.data.chapters.length : '—'}`,
                  }
                : item,
            )}
          />
        </div>

        {tab === 'details' ? (
          <StoryDetails
            key={story.id}
            story={story}
            onLifecycle={workspace.retry}
            onSaved={(updated) =>
              setSavedStory({ source: workspace.data, story: { ...story, ...updated } })
            }
          />
        ) : linked ? (
          <Card className="mt-5 p-0">
            <EmptyState
              icon={linked.icon}
              title={linked.titleKey ? t(linked.titleKey) : linked.title}
              description={linked.descriptionKey ? t(linked.descriptionKey) : linked.description}
              action={
                <ButtonLink
                  to={
                    ['reviews', 'media'].includes(tab)
                      ? `${linked.to}?storyId=${storyId}`
                      : linked.to
                  }
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
                <Button
                  variant="secondary"
                  disabled={workspace.status !== 'ready' || !story.canReorder}
                  onClick={() => setOrderOpen(true)}
                >
                  {t('chapterOrder.title')}
                </Button>
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
                    items={[
                      ...filters,
                      { value: 'Archived', label: t('chapterLifecycle.archivedFilter') },
                      { value: 'Unpublished', label: t('chapterLifecycle.unpublishedFilter') },
                    ]}
                  />
                </div>
              </div>
              {workspace.status === 'ready' && !story.canReorder && (
                <p className="border-b border-hairline px-4 py-3 text-xs text-muted">
                  {t('chapterOrder.unavailable')}
                </p>
              )}
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
                    <Button disabled={!story.canEdit} onClick={() => setNewOpen(true)} size="sm">
                      <Plus size={14} aria-hidden="true" />
                      Viết chương đầu tiên
                    </Button>
                  }
                />
              ) : pageRows.length ? (
                <div className="nh-fade-enter overflow-x-auto">
                  <table className="w-full text-left sm:min-w-[680px]">
                    <ChapterTableHead />
                    <tbody className="divide-y divide-hairline">
                      {pageRows.map((chapter) => (
                        <ChapterRow
                          key={chapter.id}
                          chapter={chapter}
                          storyId={storyId}
                          onRelease={() => setReleaseChapter(chapter)}
                          onLifecycle={(action) => setChapterAction({ story, chapter, action })}
                        />
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
            <StoryHealth stats={workspace.data.stats} />
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-brand-strong">
            {notice}
          </p>
        )}
        {chapterAction && (
          <ChapterLifecycleDialog
            {...chapterAction}
            onClose={() => setChapterAction(null)}
            onReload={() => {
              setChapterAction(null);
              workspace.retry();
            }}
            onSaved={() => {
              setChapterAction(null);
              setNotice(t(`chapterLifecycle.${chapterAction.action}Saved`));
              workspace.retry();
            }}
          />
        )}
        {orderOpen && (
          <ChapterOrderDialog
            story={story}
            chapters={workspace.data.chapters}
            onClose={() => setOrderOpen(false)}
            onReload={() => {
              setOrderOpen(false);
              workspace.retry();
            }}
            onSaved={() => {
              setOrderOpen(false);
              setNotice(t('chapterOrder.saved'));
              workspace.retry();
            }}
          />
        )}
        <Modal
          open={newOpen}
          title={t('managerData.newChapter')}
          onClose={() => {
            if (!newBusy) setNewOpen(false);
          }}
        >
          <form onSubmit={createChapter}>
            <label htmlFor="new-chapter-title" className="text-sm font-semibold">
              {t('managerData.chapterTitle')}
            </label>
            <Input
              id="new-chapter-title"
              required
              maxLength={200}
              disabled={newBusy}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              className="mt-2"
            />
            {newError && (
              <p role="alert" className="mt-3 text-sm text-rose-strong">
                {newError}
              </p>
            )}
            <Button type="submit" disabled={newBusy || !newTitle.trim()} className="mt-4">
              {t(newBusy ? 'managerData.creating' : 'managerData.createDraft')}
            </Button>
          </form>
        </Modal>
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

function ChapterRow({ chapter, storyId, onLifecycle, onRelease }) {
  const { t, formatDate, formatNumber } = useLocale();
  const note =
    chapter.status === 'Scheduled' && chapter.requestedReleaseAt
      ? t('managerData.scheduledOn', { date: formatDate(chapter.requestedReleaseAt) })
      : chapter.publishedAt
        ? t('managerData.publishedOn', { date: formatDate(chapter.publishedAt) })
        : chapter.updatedAt
          ? t('managerData.updatedOn', { date: formatDate(chapter.updatedAt) })
          : '—';
  const access = chapter.earlyAccess;
  const price =
    chapter.status !== 'Published'
      ? t('managerData.notReleased')
      : !access?.enabled || (access.endsAt && new Date(access.endsAt) <= new Date())
        ? t('managerData.free')
        : access.coinPrice == null || !access.endsAt
          ? '—'
          : t('managerData.coinPrice', { count: access.coinPrice });
  const draft = chapter.status === 'Draft';
  return (
    <tr className="transition-colors duration-200 hover:bg-elevated/60">
      <td className="px-4 py-4 sm:min-w-[11.5rem] sm:px-5">
        <div className="flex gap-3">
          <div className="min-w-0">
            <strong className="text-sm">
              Chương {chapter.number}: {chapter.title}
            </strong>
            <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
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
        <strong className="tabular-nums">
          {chapter.words == null ? '—' : formatNumber(chapter.words)} từ
        </strong>
        <p className="whitespace-nowrap text-xs text-muted">
          {t('managerData.viewCount', { count: formatNumber(chapter.reads) })}
        </p>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-4 text-sm sm:table-cell">
        <span className="inline-flex items-center gap-1.5">
          <Coins size={14} aria-hidden="true" className="text-orange" />
          {price}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-wrap justify-end gap-2">
          {chapter.canRelease && (
            <Button size="sm" onClick={onRelease}>
              {t('chapterRelease.title')}
            </Button>
          )}
          <ButtonLink
            to={`/author/stories/${storyId}/chapters/${chapter.id}/edit`}
            variant={draft ? 'primary' : 'secondary'}
            size="sm"
          >
            {chapter.status === 'Archived'
              ? t('chapterLifecycle.view')
              : draft
                ? 'Viết tiếp'
                : chapter.status === 'Scheduled'
                  ? 'Đổi lịch'
                  : 'Chỉnh sửa'}
          </ButtonLink>
          {(chapter.canArchive || chapter.canRestore) && (
            <Button
              variant="secondary"
              size="sm"
              aria-label={t(
                chapter.canRestore
                  ? 'chapterLifecycle.restoreNamed'
                  : 'chapterLifecycle.archiveNamed',
                { title: chapter.title },
              )}
              onClick={() => onLifecycle(chapter.canRestore ? 'restore' : 'archive')}
            >
              {t(chapter.canRestore ? 'chapterLifecycle.restore' : 'chapterLifecycle.archive')}
            </Button>
          )}
          {chapter.canDelete && (
            <Button variant="danger" size="sm" onClick={() => onLifecycle('delete')}>
              {t('chapterLifecycle.delete')}
            </Button>
          )}
          {chapter.canUnpublish && (
            <Button variant="danger" size="sm" onClick={() => onLifecycle('unpublish')}>
              {t('chapterLifecycle.unpublish')}
            </Button>
          )}
          <ButtonLink
            to={`/author/stories/${storyId}/chapters/${chapter.id}/preview`}
            variant="secondary"
            size="sm"
          >
            {t('authorDraftActions.preview')}
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

function StoryDetails({ story, onSaved, onLifecycle }) {
  const { t } = useLocale();
  const categories = useBackendResource('/catalog/categories');
  const [categoryIds, setCategoryIds] = useState(story.categoryIds ?? []);
  const categoriesChanged = JSON.stringify(categoryIds) !== JSON.stringify(story.categoryIds ?? []);
  const retired = categoryIds
    .filter((id) =>
      ['ready', 'empty'].includes(categories.status)
        ? !categories.data.some((item) => item.id === id)
        : story.categories?.some((item) => item.id === id && item.status === 'retired'),
    )
    .map((id) => story.categories?.find((item) => item.id === id) ?? { id, name: id });
  const genreOptions = [...categories.data, ...retired];
  const [version, setVersion] = useState(story.version);
  const [saveError, setSaveError] = useState('');
  const [title, setTitle] = useState(story.title);
  const [synopsis, setSynopsis] = useState(story.description);
  const [status, setStatus] = useState('idle');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const dirty = title !== story.title || synopsis !== story.description || categoriesChanged;
  const titleError = !title.trim();
  const synopsisError = synopsis.trim().length < 40;
  const submit = async (event) => {
    event.preventDefault();
    if (!story.canEdit || status === 'saving' || lifecycleBusy) return;
    if (titleError || synopsisError || (categoriesChanged && !categoryIds.length)) {
      setStatus('invalid');
      return;
    }
    setStatus('saving');
    setSaveError('');
    try {
      const result = await apiRequest(`/author/stories/${story.id}`, {
        method: 'PUT',
        body: {
          title: title.trim(),
          description: synopsis.trim(),
          expectedVersion: version,
          ...(categoriesChanged ? { categoryIds } : {}),
        },
      });
      setVersion(result.story.version);
      setStatus('saved');
      onSaved({
        ...result.story,
        ...(categoriesChanged
          ? {
              genres: categoryIds.map(
                (id) => genreOptions.find((item) => item.id === id)?.name ?? id,
              ),
            }
          : {}),
      });
    } catch (error) {
      setStatus('error');
      setSaveError(error.message || t('managerData.saveError'));
    }
  };
  const showErrors = status === 'invalid';
  return (
    <Card as="form" noValidate onSubmit={submit} className="mt-5 max-w-3xl">
      <h2 className="text-h3">Thông tin và tóm tắt truyện</h2>
      <p className="mt-1 text-sm text-muted">{t('managerData.draftInfo')}</p>
      <label htmlFor="story-title" className="mt-6 block text-sm font-semibold">
        Tên truyện
      </label>
      <Input
        id="story-title"
        value={title}
        disabled={!story.canEdit || status === 'saving' || lifecycleBusy}
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
        disabled={!story.canEdit || status === 'saving' || lifecycleBusy}
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
      <fieldset disabled={!story.canEdit || status === 'saving' || lifecycleBusy} className="mt-5">
        <legend className="text-sm font-semibold">{t('managerData.categories')}</legend>
        <p className="mt-2 text-xs text-muted">{t('managerData.categoriesHint')}</p>
        {categories.status === 'loading' ? (
          <Skeleton className="mt-3 h-10 w-full" />
        ) : categories.status === 'error' ? (
          <div className="mt-3">
            <p role="alert" className="text-sm text-rose-strong">
              {t('managerData.categoriesError')}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={categories.retry}
            >
              {t('managerData.retryCategories')}
            </Button>
          </div>
        ) : categories.status === 'empty' && !retired.length ? (
          <p className="mt-3 text-sm text-muted">{t('managerData.categoriesEmpty')}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {genreOptions.map((item) => (
            <label
              key={item.id}
              className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-elevated px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={categoryIds.includes(item.id)}
                disabled={!categoryIds.includes(item.id) && categoryIds.length >= 10}
                onChange={(event) => {
                  setCategoryIds((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  );
                  setStatus('idle');
                }}
                className="size-4 accent-brand"
              />
              {item.name}
              {retired.some((old) => old.id === item.id) && (
                <span className="text-xs text-muted">{t('managerData.retiredCategory')}</span>
              )}
            </label>
          ))}
        </div>
        {showErrors && !categoryIds.length && (
          <p role="alert" className="mt-2 text-xs text-rose-strong">
            {t('managerData.categoriesRequired')}
          </p>
        )}
      </fieldset>
      {saveError && (
        <p role="alert" className="mt-3 text-sm text-rose-strong">
          {saveError}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="mr-auto text-xs text-brand-strong">
          {status === 'saved' ? 'Đã lưu thông tin truyện.' : ''}
        </p>
        <Button type="submit" disabled={status === 'saving' || !story.canEdit || lifecycleBusy}>
          <Save size={16} aria-hidden="true" />
          {status === 'saving' ? 'Đang lưu...' : 'Lưu thông tin'}
        </Button>
      </div>
      <DraftLifecycle
        story={story}
        version={version}
        disabled={dirty || status === 'saving'}
        onBusy={setLifecycleBusy}
        onChanged={onLifecycle}
      />
    </Card>
  );
}

function DraftLifecycle({ story, version, disabled, onBusy, onChanged }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const restore = story.status === 'archived';
  const allowed = restore ? story.canRestore : story.canArchive;
  const submit = async () => {
    if (busyRef.current || disabled || !allowed) return;
    busyRef.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const response = await apiRequest(`/author/stories/${story.id}/lifecycle`, {
        method: 'POST',
        body: { action: restore ? 'restore' : 'archive', expectedVersion: version },
      });
      if (response?.story?.status !== (restore ? 'draft' : 'archived'))
        throw new Error(t('managerData.lifecycleError'));
      setOpen(false);
      onChanged();
    } catch (failure) {
      setError(failure.message || t('managerData.lifecycleError'));
    } finally {
      busyRef.current = false;
      setBusy(false);
      onBusy(false);
    }
  };
  return (
    <section className="mt-6 border-t border-hairline pt-5">
      <h3 className="text-sm font-semibold">{t('managerData.lifecycleTitle')}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{t('managerData.lifecycleHint')}</p>
      {disabled && <p className="mt-2 text-xs text-muted">{t('managerData.lifecycleSaveFirst')}</p>}
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        disabled={!allowed || disabled || busy}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <Archive size={16} />
        {t(restore ? 'managerData.restoreDraft' : 'managerData.archiveDraft')}
      </Button>
      <Modal
        open={open}
        title={t(restore ? 'managerData.restoreDraft' : 'managerData.archiveDraft')}
        onClose={() => !busy && setOpen(false)}
      >
        <p className="font-semibold">{story.title}</p>
        <p className="mt-3 text-sm leading-6 text-muted">
          {t(restore ? 'managerData.restoreDraftHint' : 'managerData.archiveDraftHint')}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
            {t('managerData.lifecycleCancel')}
          </Button>
          <Button type="button" disabled={busy || !allowed || disabled} onClick={submit}>
            {t(busy ? 'managerData.lifecycleBusy' : 'managerData.lifecycleConfirm')}
          </Button>
        </div>
      </Modal>
    </section>
  );
}

function StoryHealth({ stats }) {
  const { t } = useLocale();
  return (
    <aside className="min-w-0 space-y-6 xl:sticky xl:top-24" aria-label="Sức khỏe truyện">
      <Card>
        <h2 className="flex items-center gap-2 border-b border-hairline pb-4 text-h3">
          <BarChart3 size={20} aria-hidden="true" className="text-brand" />
          Sức khỏe truyện và cột mốc
        </h2>
        <Metric label="Mức độ cập nhật đều đặn hằng tuần" />
        <Metric label="Tỷ lệ giữ chân độc giả" />
        <div className="mt-5 rounded-2xl border border-hairline bg-elevated p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <Headphones size={16} aria-hidden="true" className="text-orange-strong" />
              Thuyết minh âm thanh
            </span>
            <Badge tone="orange">—</Badge>
          </div>
          <div aria-hidden="true" className="mt-3 h-1.5 rounded-full bg-elevated" />
          <p className="mt-3 text-xs text-muted">{t('mediaData.audioUnavailable')}</p>
        </div>
        <h3 className="mt-5 text-sm font-semibold">Cột mốc xuất bản</h3>
        <ul className="mt-3 space-y-3">
          {[
            [
              t('managerData.actualPublished', { count: stats.publishedChapters }),
              stats.publishedChapters > 0,
            ],
            [t('managerData.viewCount', { count: stats.reads }), stats.reads > 0],
            [t('managerData.audioUnknown'), false],
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
          {t('managerData.adviceTitle')}
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">{t('managerData.adviceUnknown')}</p>
      </Card>
    </aside>
  );
}

function Metric({ label }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <strong className="text-brand-strong tabular-nums">—</strong>
      </div>
      <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-elevated" />
    </div>
  );
}
