import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Coins,
  Edit3,
  Ellipsis,
  Eye,
  FileText,
  ImagePlus,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Star,
  Trash2,
  UsersRound,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument, useBackendResource } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { privateMediaUrl } from '../../api/media'
import { useLocale } from '../../context/LocaleContext'
import { StoryCover } from '../../components/story/StoryCover'
import { StoryTagEditor } from '../../components/author/StoryTagEditor'
import { ChapterOrderDialog } from './ChapterOrderDialog'
import { ChapterLifecycleDialog } from './ChapterLifecycleDialog'
import { ChapterReleaseDialog, StoryReleaseDialog } from './StoryReleaseDialog'
import { StoryUnpublishDialog } from './StoryUnpublishDialog'
import { ChapterScheduleDialog } from './ChapterScheduleDialog'
import { ChapterEarlyAccessDialog } from './ChapterEarlyAccessDialog'
import { ROUTES } from '../../app/routes'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Modal,
  Select,
  Tabs,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'

const PAGE_SIZE = 10
const MAX_MEDIA_BYTES = 10 * 1024 * 1024
const emptyWorkspace = {
  story: { id: null, title: '—', description: '', genre: '', canEdit: false, version: 0 },
  chapters: [],
  stats: { availableWords: 0, publishedChapters: 0, reads: 0, rating: '—', ratings: 0 },
}
const normalStatus = value =>
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
  })[value] ?? value
const tabItems = [
  { value: 'chapters', label: 'Chương' },
  { value: 'details', label: 'Thông tin và tóm tắt truyện' },
  { value: 'reviews', label: 'Bản gửi và đánh giá' },
  { value: 'analytics', label: 'Phân tích truyện' },
]
const filters = [
  { value: 'All', label: 'Tất cả' },
  { value: 'Published', label: 'Đã xuất bản' },
  { value: 'Scheduled', label: 'Đã lên lịch' },
  { value: 'In Review', label: 'Đang xét duyệt' },
  { value: 'Approved', label: 'Đã duyệt' },
  { value: 'Draft', label: 'Bản nháp' },
]
const statusLabels = {
  Published: 'Đã xuất bản',
  Scheduled: 'Đã lên lịch',
  'In Review': 'Đang xét duyệt',
  Draft: 'Bản nháp',
  Approved: 'Đã duyệt',
  Unpublished: 'Đã gỡ xuất bản',
  Archived: 'Đã lưu trữ',
  Cancelled: 'Đã hủy',
}
const statusTones = {
  Published: 'green',
  Draft: 'blue',
  Scheduled: 'orange',
  'In Review': 'purple',
  Approved: 'purple',
  Unpublished: 'orange',
  Archived: 'neutral',
  Cancelled: 'red',
}
export function StoryManagerPage() {
  const navigate = useNavigate()
  const { storyId } = useParams()
  const { t } = useLocale()
  const [search, setSearch] = useSearchParams()
  const tab = tabItems.some(item => item.value === search.get('tab'))
    ? search.get('tab')
    : 'chapters'
  const setTab = value =>
    setSearch(previous => {
      const next = new URLSearchParams(previous)
      next.set('tab', value)
      return next
    })
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const workspace = useBackendDocument(`/author/stories/${storyId}/workspace`, emptyWorkspace)
  const [savedStory, setSavedStory] = useState(null)
  const story = savedStory?.source === workspace.data ? savedStory.story : workspace.data.story
  const chaptersResource = {
    ...workspace,
    status:
      workspace.status === 'ready' && !workspace.data.chapters.length ? 'empty' : workspace.status,
    data: workspace.data.chapters.map(chapter => ({
      ...chapter,
      status: normalStatus(chapter.status),
    })),
  }
  const storyStats = [
    [FileText, workspace.data.stats.availableWords, t('managerData.knownWords')],
    [BookOpen, workspace.data.stats.publishedChapters, t('managerData.publishedChapters')],
    [Eye, workspace.data.stats.reads, t('managerData.reads')],
    [
      Star,
      workspace.data.stats.rating,
      t('managerData.ratingCount', { count: workspace.data.stats.ratings }),
    ],
  ]
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBusy, setNewBusy] = useState(false)
  const [newError, setNewError] = useState('')
  const [notice, setNotice] = useState('')
  const [orderOpen, setOrderOpen] = useState(false)
  const [chapterAction, setChapterAction] = useState(null)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseChapter, setReleaseChapter] = useState(null)
  const [scheduleChapter, setScheduleChapter] = useState(null)
  const [accessChapter, setAccessChapter] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deleteDraft = async () => {
    if (deleteBusy || !story.canDelete) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const response = await apiRequest(`/author/stories/${storyId}/lifecycle`, {
        method: 'POST',
        body: { action: 'delete', expectedVersion: story.version },
      })
      if (response?.story?.status !== 'archived') throw new Error(t('worksData.deleteError'))
      setDeleteOpen(false)
      navigate('/author/stories')
    } catch (error) {
      setDeleteError(error.message || t('worksData.deleteError'))
    } finally {
      setDeleteBusy(false)
    }
  }
  const createChapter = async event => {
    event.preventDefault()
    if (newBusy || !newTitle.trim()) return
    setNewBusy(true)
    setNewError('')
    try {
      await apiRequest(`/author/stories/${storyId}/chapters`, {
        method: 'POST',
        body: { title: newTitle.trim(), paragraphs: [''] },
      })
      setNewOpen(false)
      setNewTitle('')
      setNotice(t('managerData.created'))
      workspace.retry()
    } catch (error) {
      setNewError(error.message || t('managerData.saveError'))
    } finally {
      setNewBusy(false)
    }
  }
  const chapters = useMemo(
    () =>
      chaptersResource.data.filter(
        chapter =>
          (filter === 'All' || chapter.status === filter) &&
          chapter.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [chaptersResource.data, filter, query],
  )
  const pageCount = Math.max(1, Math.ceil(chapters.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = chapters.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
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
    )
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
                <Badge tone="orange">{story.genre || '—'}</Badge>
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
                  {t(
                    story.status === 'unpublished'
                      ? 'storyRelease.restoreTitle'
                      : 'storyRelease.title',
                  )}
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
              <Button
                variant="secondary"
                disabled={!story.canEditMetadata}
                onClick={() => setTab('details')}
              >
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
              {story.canDelete && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setDeleteError('')
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {t('worksData.delete')}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Modal
          open={deleteOpen}
          title={t('worksData.deleteTitle')}
          onClose={() => !deleteBusy && setDeleteOpen(false)}
        >
          <p className="font-semibold">{story.title}</p>
          <p className="mt-3 text-sm leading-6 text-muted">{t('worksData.deleteHint')}</p>
          {deleteError && (
            <p className="mt-3 text-sm text-rose-strong" role="alert">
              {deleteError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleteOpen(false)}>
              {t('worksData.cancel')}
            </Button>
            <Button variant="danger" disabled={deleteBusy} onClick={deleteDraft}>
              {deleteBusy ? t('worksData.deleting') : t('worksData.confirmDelete')}
            </Button>
          </div>
        </Modal>

        {releaseOpen && (
          <StoryReleaseDialog
            storyId={storyId}
            onClose={() => setReleaseOpen(false)}
            onReleased={() => {
              setReleaseOpen(false)
              setNotice(t('storyRelease.success'))
              workspace.retry()
            }}
          />
        )}
        {accessChapter && (
          <ChapterEarlyAccessDialog
            storyId={storyId}
            chapterId={accessChapter.id}
            onClose={() => setAccessChapter(null)}
            onSaved={() => {
              setAccessChapter(null)
              setNotice(t('earlyAccess.saved'))
              workspace.retry()
            }}
          />
        )}
        {scheduleChapter && (
          <ChapterScheduleDialog
            key={scheduleChapter.id}
            storyId={storyId}
            chapterId={scheduleChapter.id}
            onClose={() => setScheduleChapter(null)}
            onSaved={cancelled => {
              setScheduleChapter(null)
              setNotice(t(cancelled ? 'chapterSchedule.cancelled' : 'chapterSchedule.saved'))
              workspace.retry()
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
              setReleaseChapter(null)
              setNotice(t('chapterRelease.success'))
              workspace.retry()
            }}
          />
        )}
        <div className="mt-6 max-w-full">
          <Tabs
            singleRow
            label="Mục quản lý truyện"
            value={tab}
            onChange={setTab}
            items={tabItems.map(item =>
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
            onSaved={updated =>
              setSavedStory({ source: workspace.data, story: { ...story, ...updated } })
            }
          />
        ) : tab === 'reviews' ? (
          <StorySubmissionHistory storyId={storyId} />
        ) : tab === 'analytics' ? (
          <StoryAnalyticsSummary storyId={storyId} />
        ) : (
          <div className="nh-grid-12 mt-5 grid items-start gap-6 nh-layout-xl-9-3">
            <Card
              as="section"
              aria-label="Danh sách chương"
              className="min-w-0 overflow-hidden p-0"
            >
              <div className="flex flex-col gap-3 border-b border-hairline p-4">
                <div className="flex flex-wrap items-center gap-3">
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
                    onChange={event => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Tìm tiêu đề chương..."
                    className="min-w-0 flex-1 2xl:w-64 2xl:flex-none"
                  />
                </div>
                <div className="min-w-0 w-full max-w-full">
                  <Tabs
                    className="w-full"
                    label="Lọc trạng thái chương"
                    value={filter}
                    onChange={value => {
                      setFilter(value)
                      setPage(1)
                    }}
                    items={[
                      ...filters,
                      { value: 'Archived', label: t('chapterLifecycle.archivedFilter') },
                      { value: 'Unpublished', label: t('chapterLifecycle.unpublishedFilter') },
                    ]}
                  />
                  <div
                    className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted"
                    aria-label="Chú giải trạng thái chương"
                  >
                    <span className="font-semibold text-ink/80">Màu trạng thái:</span>
                    {[
                      ['green', 'Đã xuất bản'],
                      ['blue', 'Bản nháp'],
                      ['purple', 'Đang duyệt/đã duyệt'],
                      ['orange', 'Đã lên lịch/gỡ xuất bản'],
                    ].map(([tone, label]) => (
                      <Badge key={tone} tone={tone} className="px-2 py-0.5 text-[10px]">
                        {label}
                      </Badge>
                    ))}
                  </div>
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
                      {[0, 1, 2, 3, 4].map(item => (
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
                      {pageRows.map(chapter => (
                        <ChapterRow
                          key={chapter.id}
                          chapter={chapter}
                          storyId={storyId}
                          onRelease={() => setReleaseChapter(chapter)}
                          onSchedule={() => setScheduleChapter(chapter)}
                          onEarlyAccess={() => setAccessChapter(chapter)}
                          onLifecycle={action => setChapterAction({ story, chapter, action })}
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
                        setFilter('All')
                        setQuery('')
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
                {chaptersResource.status === 'ready' && (
                  <Pagination
                    page={currentPage}
                    pageCount={pageCount}
                    onChange={setPage}
                    className="mt-0 justify-end"
                  />
                )}
              </div>
            </Card>
            <StoryHealth storyId={storyId} stats={workspace.data.stats} />
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
              setChapterAction(null)
              workspace.retry()
            }}
            onSaved={result => {
              if (chapterAction.action === 'reviseUnpublished') {
                const revision = result.revision
                navigate(`/author/stories/${revision.storyId}/chapters/${revision.chapterId}/edit`)
                return
              }
              setChapterAction(null)
              setNotice(t(`chapterLifecycle.${chapterAction.action}Saved`))
              workspace.retry()
            }}
          />
        )}
        {orderOpen && (
          <ChapterOrderDialog
            story={story}
            chapters={workspace.data.chapters}
            onClose={() => setOrderOpen(false)}
            onReload={() => {
              setOrderOpen(false)
              workspace.retry()
            }}
            onSaved={() => {
              setOrderOpen(false)
              setNotice(t('chapterOrder.saved'))
              workspace.retry()
            }}
          />
        )}
        <Modal
          open={newOpen}
          title={t('managerData.newChapter')}
          onClose={() => {
            if (!newBusy) setNewOpen(false)
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
              onChange={event => setNewTitle(event.target.value)}
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
  )
}

const emptyStoryAnalytics = {
  daily: [],
  labels: [],
  stories: [],
  chapters: [],
  reads: 0,
  readers: 0,
  followers: 0,
  paidUnlocks: 0,
  earnings: 0,
  rating: { average: null, count: 0 },
  comments: {},
}

const analyticsPeriods = [
  { value: '7', labelKey: 'periodWeek', days: 7, groupBy: 'day' },
  { value: '30', labelKey: 'periodMonth', days: 30, groupBy: 'day' },
  { value: '90', labelKey: 'periodQuarter', days: 90, groupBy: 'week' },
  { value: '180', labelKey: 'periodHalfYear', days: 180, groupBy: 'week' },
  { value: '365', labelKey: 'periodYear', days: 365, groupBy: 'month' },
]

function StorySubmissionHistory({ storyId }) {
  const { t, formatDate } = useLocale()
  const [page, setPage] = useState(1)
  const feed = useBackendDocument(
    `/author/submissions?page=${page}&storyId=${encodeURIComponent(storyId)}`,
    {
      items: [],
      stories: [],
      page: 1,
      pageCount: 1,
      total: 0,
    },
  )
  const knownStatuses = [
    'validated',
    'pending-review',
    'decision-pending',
    'approved',
    'superseded',
    'rejected',
    'cancelled',
  ]
  const statusTones = {
    validated: 'blue',
    'pending-review': 'orange',
    'decision-pending': 'orange',
    approved: 'green',
    superseded: 'neutral',
    rejected: 'red',
    cancelled: 'neutral',
  }
  const historyActions = ['submitted', 'decided', 'publication.superseded']
  const historyOutcomes = ['validated', 'approved', 'rejected', 'superseded', 'cancelled']
  return (
    <Card className="mt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{t('submissionData.studio')}</p>
          <h2 className="mt-1 text-h3">{t('submissionData.storyHistoryTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('submissionData.storyHistoryHint')}</p>
          {feed.status === 'ready' && (
            <p className="mt-2 text-xs font-semibold text-brand-strong">
              {t('submissionData.submissionCount', { count: feed.data.total })}
            </p>
          )}
        </div>
        <ButtonLink
          to={`/author/submissions?storyId=${encodeURIComponent(storyId)}`}
          variant="secondary"
          size="sm"
        >
          {t('submissionData.openGlobalHistory')}
        </ButtonLink>
      </div>
      {feed.status === 'loading' ? (
        <div aria-busy="true" className="mt-5 space-y-3">
          {[0, 1, 2].map(item => (
            <Skeleton key={item} className="h-24 w-full" />
          ))}
        </div>
      ) : feed.status === 'error' ? (
        <EmptyState
          tone="rose"
          icon={AlertTriangle}
          title={t('submissionData.loadError')}
          action={<RetryButton onClick={feed.retry} />}
        />
      ) : !feed.data.items.length ? (
        <EmptyState
          className="mt-5"
          icon={FileText}
          title={t('submissionData.noHistory')}
          description={t('submissionData.noHistoryHint')}
        />
      ) : (
        <div className="mt-5 space-y-3">
          {feed.data.items.map(item => (
            <article key={item.id} className="rounded-2xl border border-hairline p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{item.title || item.id}</h3>
                <div className="flex flex-wrap justify-end gap-2">
                  <Badge tone={item.chapterId ? 'purple' : 'brand'}>
                    {t(
                      item.chapterId
                        ? 'submissionData.chapterSubmission'
                        : 'submissionData.storySubmission',
                    )}
                  </Badge>
                  <Badge tone={statusTones[item.status] ?? 'neutral'}>
                    {knownStatuses.includes(item.status)
                      ? t(`submissionData.status.${item.status}`)
                      : item.status}
                  </Badge>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">
                {item.submittedAt ? formatDate(item.submittedAt) : '—'} ·{' '}
                {t('submissionData.revision')} {item.revisionNumber ?? '—'}
              </p>
              {item.decisionSummary && (
                <p className="mt-3 whitespace-pre-wrap text-sm">{item.decisionSummary}</p>
              )}
              {Array.isArray(item.history) && item.history.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {item.history.map(row => (
                    <li key={row.id} className="rounded-xl bg-elevated p-3 text-xs">
                      {historyActions.includes(row.action)
                        ? t(`submissionData.historyActions.${row.action}`)
                        : row.action}{' '}
                      ·{' '}
                      {historyOutcomes.includes(row.outcome)
                        ? t(`submissionData.historyOutcomes.${row.outcome}`)
                        : row.outcome}{' '}
                      · {row.occurredAt ? formatDate(row.occurredAt) : '—'}
                      {row.feedback && (
                        <p className="mt-2 whitespace-pre-wrap text-sm">{row.feedback}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink
                  size="sm"
                  variant="secondary"
                  to={`/author/submissions/${item.id}/preview`}
                >
                  {t('submissionPackage.title')}
                </ButtonLink>
                {item.chapterId && (
                  <ButtonLink
                    size="sm"
                    variant="secondary"
                    to={`/author/stories/${storyId}/chapters/${item.chapterId}/edit`}
                  >
                    {t('submissionData.openDraft')}
                  </ButtonLink>
                )}
                {!item.chapterId && (item.canRevise ?? item.status === 'rejected') && (
                  <ButtonLink
                    size="sm"
                    variant="secondary"
                    to={`/author/stories/${storyId}?tab=details`}
                  >
                    {t('submissionData.reviseFromHistory')}
                  </ButtonLink>
                )}
              </div>
            </article>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(value => value - 1)}
            >
              {t('submissionData.previous')}
            </Button>
            <span className="text-sm tabular-nums">
              {t('submissionData.pageOf', {
                page: feed.data.page,
                pageCount: feed.data.pageCount,
              })}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= feed.data.pageCount}
              onClick={() => setPage(value => value + 1)}
            >
              {t('submissionData.next')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function StoryAnalyticsSummary({ storyId }) {
  const { t } = useLocale()
  const [period, setPeriod] = useState('30')
  const selectedPeriod = analyticsPeriods.find(item => item.value === period) ?? analyticsPeriods[1]
  const analytics = useBackendDocument(
    `/author/analytics?days=${selectedPeriod.days}&groupBy=${selectedPeriod.groupBy}&storyId=${encodeURIComponent(storyId)}`,
    emptyStoryAnalytics,
  )
  const data = analytics.data
  const metrics = [
    [BookOpen, t('analyticsData.views'), data.reads ?? 0, 'brand'],
    [UsersRound, t('analyticsData.readers'), data.readers ?? 0, 'orange'],
    [UsersRound, t('analyticsData.followers'), data.followers ?? 0, 'purple'],
    [Coins, t('analyticsData.paidUnlocks'), data.paidUnlocks ?? 0, 'orange'],
    [Coins, t('analyticsData.earnings'), data.earnings ?? 0, 'purple'],
    [Star, t('analyticsData.averageRating'), data.rating?.average ?? '—', 'orange'],
  ]
  return (
    <section className="mt-5 space-y-5" aria-labelledby="story-analytics-heading">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted">{t('analyticsData.range')}</p>
              <label className="sr-only" htmlFor="story-analytics-period">
                {t('analyticsData.periodLabel')}
              </label>
              <Select
                id="story-analytics-period"
                value={period}
                onChange={event => setPeriod(event.target.value)}
                className="h-9 min-w-28"
              >
                {analyticsPeriods.map(item => (
                  <option key={item.value} value={item.value}>
                    {t(`analyticsData.${item.labelKey}`)}
                  </option>
                ))}
              </Select>
            </div>
            <h2 id="story-analytics-heading" className="mt-1 text-h3">
              {t('analyticsData.storySummaryTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t('analyticsData.storySummaryHint', {
                period: t(`analyticsData.${selectedPeriod.labelKey}`),
              })}
            </p>
          </div>
          <ButtonLink to={ROUTES.authorAnalytics(storyId)} variant="secondary" size="sm">
            {t('analyticsData.openFullAnalytics')}
          </ButtonLink>
        </div>
        {analytics.status === 'error' ? (
          <EmptyState
            className="mt-5"
            tone="rose"
            icon={AlertTriangle}
            title={t('analyticsData.loadError')}
            action={<RetryButton onClick={analytics.retry} />}
          />
        ) : analytics.status === 'loading' ? (
          <div aria-busy="true" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(item => (
              <Skeleton key={item} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {metrics.map(([Icon, label, value, tone]) => (
                <div key={label} className="rounded-2xl bg-elevated p-4">
                  <Icon
                    size={16}
                    aria-hidden="true"
                    className={
                      {
                        brand: 'text-brand-strong',
                        orange: 'text-orange-strong',
                        purple: 'text-purple-strong',
                      }[tone]
                    }
                  />
                  <span className="mt-2 block text-xs text-muted">{label}</span>
                  <strong className="mt-1 block text-h3 tabular-nums">
                    {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
                  </strong>
                </div>
              ))}
            </div>
            {!data.daily?.length ? (
              <p className="mt-5 text-sm text-muted">{t('analyticsData.noDailyData')}</p>
            ) : (
              <div className="mt-5">
                <div className="flex h-28 items-end gap-1 rounded-2xl bg-elevated px-3 py-3">
                  {data.daily.map((value, index) => {
                    const peak = Math.max(1, ...data.daily)
                    return (
                      <span
                        key={`${data.labels?.[index] ?? index}`}
                        title={`${data.labels?.[index] ?? ''}: ${value} ${t('analyticsData.readCountUnit')}`}
                        className="min-w-0 flex-1 rounded-t bg-brand/75"
                        style={{ height: `${(value / peak) * 100}%` }}
                      />
                    )
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-muted">
                  <span>{t('analyticsData.date')}</span>
                  <span>{t('analyticsData.views')}</span>
                </div>
                <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-hairline bg-elevated">
                  {data.daily.map((value, index) => (
                    <div
                      key={`row-${data.labels?.[index] ?? index}`}
                      className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2 text-xs last:border-b-0"
                    >
                      <span className="text-muted">{data.labels?.[index] ?? '—'}</span>
                      <strong className="tabular-nums text-ink">
                        {value.toLocaleString('vi-VN')} {t('analyticsData.readCountUnit')}
                      </strong>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">{t('analyticsData.dailyHint')}</p>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
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
  )
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
  )
}

function ChapterRow({ chapter, storyId, onLifecycle, onRelease, onSchedule, onEarlyAccess }) {
  const { t, formatDate, formatNumber } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const note =
    chapter.status === 'Scheduled' && chapter.requestedReleaseAt
      ? t('managerData.scheduledOn', { date: formatDate(chapter.requestedReleaseAt) })
      : chapter.publishedAt
        ? t('managerData.publishedOn', { date: formatDate(chapter.publishedAt) })
        : chapter.updatedAt
          ? t('managerData.updatedOn', { date: formatDate(chapter.updatedAt) })
          : '—'
  const access = chapter.earlyAccess
  const price =
    chapter.status !== 'Published'
      ? t('managerData.notReleased')
      : !access?.enabled || (access.endsAt && new Date(access.endsAt) <= new Date())
        ? t('managerData.free')
        : access.coinPrice == null || !access.endsAt
          ? '—'
          : t('managerData.coinPrice', { count: access.coinPrice })
  const draft = chapter.status === 'Draft'
  const canEdit = chapter.canEdit ?? draft
  const previewPath = `/author/stories/${storyId}/chapters/${chapter.id}/preview${chapter.status === 'Published' ? '?source=published' : ''}`
  const editPath = `/author/stories/${storyId}/chapters/${chapter.id}/edit`
  const chapterEditorPath = canEdit ? editPath : previewPath
  const chapterEditorLabel = canEdit
    ? draft
      ? 'Viết tiếp'
      : 'Chỉnh sửa'
    : chapter.status === 'Published'
      ? t('chapterLifecycle.viewPublished')
      : t('chapterLifecycle.view')
  return (
    <tr className="transition-colors duration-200 hover:bg-elevated/60">
      <td className="px-4 py-4 sm:min-w-[11.5rem] sm:px-5">
        <div className="flex gap-3">
          <div className="min-w-0">
            <strong className="text-sm">
              Chương {chapter.number}: {chapter.title}
            </strong>
            <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
            {chapter.status !== 'Published' && access?.enabled && (
              <p className="mt-1 text-xs text-muted">
                {t('earlyAccess.summary', { price: access.coinPrice, days: access.durationDays })}
              </p>
            )}
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
            to={chapterEditorPath}
            variant={canEdit && draft ? 'primary' : 'secondary'}
            size="sm"
          >
            {chapterEditorLabel}
          </ButtonLink>
          {chapter.canDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onLifecycle('delete')}
              aria-label={`Xóa bản nháp Chương ${chapter.number}: ${chapter.title}`}
            >
              <Trash2 size={14} aria-hidden="true" />
              Xóa
            </Button>
          )}
          <ChapterActionsMenu
            open={menuOpen}
            onToggle={() => setMenuOpen(value => !value)}
            onClose={() => setMenuOpen(false)}
            items={[
              {
                show: true,
                content: (
                  <ButtonLink
                    to={chapterEditorPath}
                    variant={canEdit && draft ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    {chapterEditorLabel}
                  </ButtonLink>
                ),
              },
              {
                show: chapter.canConfigureEarlyAccess,
                content: (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false)
                      onEarlyAccess()
                    }}
                  >
                    {t('earlyAccess.title')}
                  </Button>
                ),
              },
              {
                show: chapter.canManageSchedule,
                content: (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false)
                      onSchedule()
                    }}
                  >
                    {t(
                      chapter.status === 'Scheduled'
                        ? 'chapterSchedule.manage'
                        : 'chapterSchedule.title',
                    )}
                  </Button>
                ),
              },
              {
                show: chapter.canArchive || chapter.canRestore,
                content: (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false)
                      onLifecycle(chapter.canRestore ? 'restore' : 'archive')
                    }}
                  >
                    {t(
                      chapter.canRestore ? 'chapterLifecycle.restore' : 'chapterLifecycle.archive',
                    )}
                  </Button>
                ),
              },
              {
                show: chapter.canDelete,
                content: (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false)
                      onLifecycle('delete')
                    }}
                  >
                    {t('chapterLifecycle.delete')}
                  </Button>
                ),
              },
              {
                show: chapter.canUnpublish,
                content: (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false)
                      onLifecycle('unpublish')
                    }}
                  >
                    {t('chapterLifecycle.unpublish')}
                  </Button>
                ),
              },
              {
                show: Boolean(chapter.reviseSource),
                content: (
                  <Button
                    size="sm"
                    onClick={() => {
                      setMenuOpen(false)
                      onLifecycle('reviseUnpublished')
                    }}
                  >
                    {t('chapterLifecycle.reviseUnpublished')}
                  </Button>
                ),
              },
              {
                show: true,
                content: (
                  <ButtonLink
                    to={previewPath}
                    variant="secondary"
                    size="sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    {t('authorDraftActions.preview')}
                  </ButtonLink>
                ),
              },
              {
                show: true,
                content: (
                  <ButtonLink
                    to={ROUTES.authorAnalytics(storyId, chapter.id)}
                    variant="secondary"
                    size="sm"
                    onClick={() => setMenuOpen(false)}
                    aria-label={`Xem phân tích chương ${chapter.number}: ${chapter.title}`}
                  >
                    <BarChart3 size={15} aria-hidden="true" /> Phân tích
                  </ButtonLink>
                ),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  )
}

function ChapterActionsMenu({ open, onToggle, onClose, items }) {
  const visible = items.filter(item => item.show)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [position, setPosition] = useState(null)
  useLayoutEffect(() => {
    if (!open) return undefined
    const updatePosition = () => {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      const menuHeight = Math.min(menuRef.current?.scrollHeight ?? 360, window.innerHeight - 24)
      const width = 224
      const top = Math.max(12, rect.top - menuHeight - 8)
      const left = Math.min(
        Math.max(12, rect.right - width),
        Math.max(12, window.innerWidth - width - 12),
      )
      setPosition({ top, left, width })
    }
    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, visible.length])
  return (
    <div ref={buttonRef}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label="Thao tác khác cho chương"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onToggle}
        className="w-10 px-0 pointer-coarse:w-11"
      >
        <Ellipsis size={17} aria-hidden="true" />
      </Button>
      {open &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Đóng menu thao tác"
              className="fixed inset-0 z-[90] cursor-default"
              onClick={onClose}
            />
            <div
              ref={menuRef}
              role="menu"
              style={
                position
                  ? { top: position.top, left: position.left, width: position.width }
                  : { visibility: 'hidden' }
              }
              className="fixed z-[100] grid max-h-[min(24rem,calc(100vh-1.5rem))] min-w-56 gap-1 overflow-y-auto rounded-2xl border border-line bg-surface p-2.5 shadow-float"
            >
              {visible.map((item, index) => (
                <div
                  key={index}
                  role="menuitem"
                  tabIndex={-1}
                  className="[&>a]:w-full [&>a]:justify-start [&>button]:w-full [&>button]:justify-start"
                >
                  {item.content}
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  )
}

function StoryDetails({ story, onSaved, onLifecycle }) {
  const { t } = useLocale()
  const canEditMetadata = story.canEditMetadata ?? !story.publishedRevisionId
  const categories = useBackendResource('/catalog/categories')
  const [categoryId, setCategoryId] = useState(story.categoryId ?? '')
  const categoryChanged = categoryId !== (story.categoryId ?? '')
  const listed = ['ready', 'empty'].includes(categories.status)
  const currentRetired = listed
    ? categoryId && !categories.data.some(item => item.id === categoryId)
    : story.category?.id === categoryId && story.category.status === 'retired'
  const retired = currentRetired
    ? [story.category?.id === categoryId ? story.category : { id: categoryId, name: categoryId }]
    : []
  const genreOptions = [...categories.data, ...retired]
  const [version, setVersion] = useState(story.version)
  const [saveError, setSaveError] = useState('')
  const [title, setTitle] = useState(story.title)
  const [synopsis, setSynopsis] = useState(story.description)
  const [status, setStatus] = useState('idle')
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [unpublishOpen, setUnpublishOpen] = useState(false)
  const [tags, setTags] = useState(story.tags ?? [])
  const [coverMediaId, setCoverMediaId] = useState(story.coverMediaId ?? null)
  const [coverUrl, setCoverUrl] = useState(story.coverUrl ?? null)
  const [coverBannerMediaId, setCoverBannerMediaId] = useState(story.coverBannerMediaId ?? null)
  const [bannerUrl, setBannerUrl] = useState(
    story.coverBannerMediaId
      ? privateMediaUrl(story.coverBannerMediaId)
      : (story.bannerUrl ?? null),
  )
  const [coverBusy, setCoverBusy] = useState(false)
  const [bannerBusy, setBannerBusy] = useState(false)
  const coverInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const tagsChanged = JSON.stringify(tags) !== JSON.stringify(story.tags ?? [])
  const dirty =
    title !== story.title ||
    synopsis !== story.description ||
    categoryChanged ||
    tagsChanged ||
    coverMediaId !== (story.coverMediaId ?? null) ||
    coverBannerMediaId !== (story.coverBannerMediaId ?? null)
  const titleError = !title.trim()
  const synopsisError = false
  const submit = async event => {
    event.preventDefault()
    if (!canEditMetadata || status === 'saving' || lifecycleBusy || coverBusy || bannerBusy) return
    if (titleError || synopsisError || (categoryChanged && !categoryId)) {
      setStatus('invalid')
      return
    }
    setStatus('saving')
    setSaveError('')
    try {
      const result = await apiRequest(`/author/stories/${story.id}`, {
        method: 'PUT',
        body: {
          title: title.trim(),
          description: synopsis.trim(),
          expectedVersion: version,
          ...(categoryChanged ? { categoryId } : {}),
          ...(tagsChanged ? { tags } : {}),
          coverMediaId,
          coverBannerMediaId,
        },
      })
      setVersion(result.story.version)
      setStatus('saved')
      onSaved({
        ...result.story,
        ...(tagsChanged ? { tags } : {}),
        ...(categoryChanged
          ? { genre: genreOptions.find(item => item.id === categoryId)?.name ?? categoryId }
          : {}),
      })
    } catch (error) {
      setStatus('error')
      setSaveError(error.message || t('managerData.saveError'))
    }
  }
  const chooseCover = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSaveError(t('createData.coverInvalid'))
      setStatus('error')
      return
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setSaveError(t('createData.coverTooLarge'))
      setStatus('error')
      return
    }
    setCoverBusy(true)
    setSaveError('')
    try {
      const query = new URLSearchParams({ name: file.name, kind: 'cover', storyId: story.id })
      const result = await apiRequest(`/author/media?${query}`, {
        method: 'POST',
        body: file,
        binary: true,
      })
      if (!result.asset?.id) throw new Error(t('managerData.coverUploadError'))
      setCoverMediaId(result.asset.id)
      setCoverUrl(privateMediaUrl(result.asset.id))
      setStatus('idle')
    } catch (error) {
      setSaveError(error.message || t('managerData.coverUploadError'))
      setStatus('error')
    } finally {
      setCoverBusy(false)
    }
  }
  const chooseBanner = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setSaveError(t('createData.bannerInvalid'))
      setStatus('error')
      return
    }
    if (file.size > MAX_MEDIA_BYTES) {
      setSaveError(t('createData.bannerTooLarge'))
      setStatus('error')
      return
    }
    setBannerBusy(true)
    setSaveError('')
    try {
      const query = new URLSearchParams({ name: file.name, kind: 'banner', storyId: story.id })
      const result = await apiRequest(`/author/media?${query}`, {
        method: 'POST',
        body: file,
        binary: true,
      })
      if (!result.asset?.id) throw new Error(t('managerData.bannerUploadError'))
      setCoverBannerMediaId(result.asset.id)
      setBannerUrl(privateMediaUrl(result.asset.id))
      setStatus('idle')
    } catch (error) {
      setSaveError(error.message || t('managerData.bannerUploadError'))
      setStatus('error')
    } finally {
      setBannerBusy(false)
    }
  }
  const showErrors = status === 'invalid'
  return (
    <Card as="form" noValidate onSubmit={submit} className="mt-5 max-w-3xl">
      <h2 className="text-h3">Thông tin và tóm tắt truyện</h2>
      <p className="mt-1 text-sm text-muted">{t('managerData.draftInfo')}</p>
      {!canEditMetadata && (
        <p className="mt-3 rounded-2xl border border-orange/30 bg-orange/10 p-3 text-sm leading-6 text-orange-strong">
          {t('managerData.metadataLocked')}
        </p>
      )}
      <label htmlFor="story-title" className="mt-6 block text-sm font-semibold">
        Tên truyện
      </label>
      <Input
        id="story-title"
        value={title}
        disabled={!canEditMetadata || status === 'saving' || lifecycleBusy}
        maxLength={200}
        onChange={event => {
          setTitle(event.target.value)
          setStatus('idle')
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
        <span className="font-normal text-muted tabular-nums">{synopsis.length}/10000</span>
      </label>
      <textarea
        id="story-synopsis"
        value={synopsis}
        disabled={!canEditMetadata || status === 'saving' || lifecycleBusy}
        maxLength={10000}
        onChange={event => {
          setSynopsis(event.target.value)
          setStatus('idle')
        }}
        aria-invalid={showErrors && synopsisError}
        aria-describedby="story-synopsis-hint"
        className="mt-2 min-h-36 w-full resize-y rounded-3xl border border-line bg-surface p-4 text-base leading-6 text-ink outline-none transition-colors focus:border-brand sm:text-sm"
      />
      <p
        id="story-synopsis-hint"
        className={`mt-2 text-xs ${showErrors && synopsisError ? 'text-rose-strong' : 'text-muted'}`}
      >
        Tóm tắt là tùy chọn khi lưu bản nháp và tối đa 10.000 ký tự.
      </p>
      <fieldset
        disabled={
          !canEditMetadata || status === 'saving' || lifecycleBusy || coverBusy || bannerBusy
        }
        className="mt-5"
      >
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
        <div role="radiogroup" className="mt-3 flex flex-wrap gap-2">
          {genreOptions.map(item => (
            <label
              key={item.id}
              className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-elevated px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="story-category"
                value={item.id}
                checked={categoryId === item.id}
                onChange={() => {
                  setCategoryId(item.id)
                  setStatus('idle')
                }}
                className="size-4 accent-brand"
              />
              {item.name}
              {retired.some(old => old.id === item.id) && (
                <span className="text-xs text-muted">{t('managerData.retiredCategory')}</span>
              )}
            </label>
          ))}
        </div>
        {showErrors && !categoryId && (
          <p role="alert" className="mt-2 text-xs text-rose-strong">
            {t('managerData.categoriesRequired')}
          </p>
        )}
      </fieldset>
      <div className="mt-5">
        <h3 className="text-sm font-semibold">{t('managerData.coverTitle')}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <StoryCover
            story={{ ...story, coverUrl: coverUrl || undefined, cover: undefined }}
            className="aspect-[2/3] w-20 rounded-xl"
          />
          <div className="flex flex-wrap gap-2">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseCover}
              className="sr-only"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                !canEditMetadata || coverBusy || bannerBusy || status === 'saving' || lifecycleBusy
              }
              onClick={() => coverInputRef.current?.click()}
            >
              {coverBusy
                ? t('chapterImages.uploading')
                : t(coverMediaId ? 'managerData.replaceCover' : 'managerData.uploadCover')}
            </Button>
            {coverMediaId && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={coverBusy || status === 'saving' || lifecycleBusy}
                onClick={() => {
                  setCoverMediaId(null)
                  setCoverUrl(null)
                  setStatus('idle')
                }}
              >
                {t('managerData.removeCover')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <h3 className="text-sm font-semibold">{t('managerData.bannerTitle')}</h3>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative aspect-[3/1] w-full max-w-sm overflow-hidden rounded-xl border border-line bg-elevated">
            {bannerUrl ? (
              <img
                src={bannerUrl}
                crossOrigin="use-credentials"
                alt={t('managerData.bannerAlt', { title: story.title })}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                <ImagePlus size={22} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseBanner}
              className="sr-only"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                !canEditMetadata || coverBusy || bannerBusy || status === 'saving' || lifecycleBusy
              }
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerBusy
                ? t('chapterImages.uploading')
                : t(coverBannerMediaId ? 'managerData.replaceBanner' : 'managerData.uploadBanner')}
            </Button>
            {coverBannerMediaId && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={coverBusy || bannerBusy || status === 'saving' || lifecycleBusy}
                onClick={() => {
                  setCoverBannerMediaId(null)
                  setBannerUrl(null)
                  setStatus('idle')
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
                {t('managerData.removeBanner')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <StoryTagEditor
          id="story-manager-tag"
          tags={tags}
          disabled={!canEditMetadata || status === 'saving' || lifecycleBusy}
          onChange={next => {
            setTags(next)
            setStatus('idle')
          }}
        />
      </div>
      {saveError && (
        <p role="alert" className="mt-3 text-sm text-rose-strong">
          {saveError}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <p role="status" className="mr-auto text-xs text-brand-strong">
          {status === 'saved' ? t('managerData.saved') : ''}
        </p>
        <Button
          type="submit"
          disabled={
            status === 'saving' || !canEditMetadata || lifecycleBusy || coverBusy || bannerBusy
          }
        >
          <Save size={16} aria-hidden="true" />
          {status === 'saving' ? t('managerData.saving') : t('managerData.save')}
        </Button>
      </div>
      {story.canUnpublish && (
        <div className="mt-6 border-t border-line pt-5">
          <Button
            type="button"
            variant="secondary"
            disabled={dirty || status === 'saving' || lifecycleBusy}
            onClick={() => setUnpublishOpen(true)}
          >
            {t('storyUnpublish.title')}
          </Button>
          {dirty && <p className="mt-2 text-xs text-muted">{t('storyUnpublish.dirty')}</p>}
        </div>
      )}
      {unpublishOpen && (
        <StoryUnpublishDialog
          story={story}
          version={version}
          onBusy={setLifecycleBusy}
          onClose={() => setUnpublishOpen(false)}
          onChanged={() => {
            setUnpublishOpen(false)
            onLifecycle()
          }}
        />
      )}
      <DraftLifecycle
        story={story}
        version={version}
        disabled={dirty || status === 'saving'}
        onBusy={setLifecycleBusy}
        onChanged={onLifecycle}
      />
    </Card>
  )
}

function DraftLifecycle({ story, version, disabled, onBusy, onChanged }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState('')
  const restore = story.status === 'archived'
  const allowed = restore ? story.canRestore : story.canArchive
  const submit = async () => {
    if (busyRef.current || disabled || !allowed) return
    busyRef.current = true
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      const response = await apiRequest(`/author/stories/${story.id}/lifecycle`, {
        method: 'POST',
        body: { action: restore ? 'restore' : 'archive', expectedVersion: version },
      })
      if (response?.story?.status !== (restore ? 'draft' : 'archived'))
        throw new Error(t('managerData.lifecycleError'))
      setOpen(false)
      onChanged()
    } catch (failure) {
      setError(failure.message || t('managerData.lifecycleError'))
    } finally {
      busyRef.current = false
      setBusy(false)
      onBusy(false)
    }
  }
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
          setError('')
          setOpen(true)
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
  )
}

function StoryHealth({ storyId, stats }) {
  const { t } = useLocale()
  return (
    <aside className="min-w-0 space-y-6 xl:sticky xl:top-24" aria-label="Sức khỏe truyện">
      <Card>
        <h2 className="flex items-center gap-2 border-b border-hairline pb-4 text-h3">
          <BarChart3 size={20} aria-hidden="true" className="text-brand" />
          Sức khỏe truyện và cột mốc
        </h2>
        <Metric label="Mức độ cập nhật đều đặn hằng tuần" />
        <Metric label="Tỷ lệ giữ chân độc giả" />
        <h3 className="mt-5 text-sm font-semibold">Cột mốc xuất bản</h3>
        <ul className="mt-3 space-y-3">
          {[
            [
              t('managerData.actualPublished', { count: stats.publishedChapters }),
              stats.publishedChapters > 0,
            ],
            [t('managerData.viewCount', { count: stats.reads }), stats.reads > 0],
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
        <ButtonLink
          to={ROUTES.authorAnalytics(storyId)}
          variant="secondary"
          className="mt-5 w-full"
        >
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
  )
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
  )
}
