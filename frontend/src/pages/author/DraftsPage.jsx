import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cloud,
  Copy,
  Eye,
  FilePlus2,
  Grid2X2,
  History,
  List,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  WandSparkles,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { ChapterLifecycleDialog } from './ChapterLifecycleDialog'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Reveal,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'

const editorRoute = draft => `/author/stories/${draft.storyId}/chapters/${draft.id}/edit`
const emptyDrafts = { items: [], stories: [], history: [] }
const WORDS_PER_MINUTE = 250
const filterLabels = [
  ['All Drafts', 'Tất cả bản nháp'],
  ['Story Chapters', 'Chương truyện'],
]
const matchesFilter = (draft, filter) =>
  filter === 'All Drafts' ||
  (filter === 'Story Chapters' && draft.type.includes('Chapter')) ||
  false
const draftTypeLabels = {
  'Story Chapter': 'Chương truyện',
  'Chapter Draft': 'Bản nháp chương',
  'Standalone Concept': 'Ý tưởng độc lập',
  'Special Edition': 'Phiên bản đặc biệt',
}
const wordCount = draft => Number(String(draft.words).replace(/[^\d]/g, '')) || 0
const formatNumber = value => value.toLocaleString('vi-VN')
const readMinutes = words =>
  (words ? Math.max(0.1, Math.round((words / WORDS_PER_MINUTE) * 10) / 10) : 0).toLocaleString(
    'vi-VN',
  )

export function DraftsPage() {
  const [filter, setFilter] = useState('All Drafts')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('Last Edited')
  const [view, setView] = useState('grid')
  const { t } = useLocale()
  const resource = useBackendDocument('/author/drafts', emptyDrafts)
  const [storyId, setStoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [requestError, setRequestError] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('Bản thảo chưa đặt tên')
  const [newTouched, setNewTouched] = useState(false)
  const [deleting, setDeleting] = useState(null)
  async function openDelete(draft) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setRequestError('')
    try {
      const workspace = await apiRequest(`/author/stories/${draft.storyId}/workspace`)
      const chapter = workspace.chapters.find(item => item.id === draft.id)
      if (!chapter?.canDelete || chapter.version !== draft.version)
        throw new Error(t('draftsData.stale'))
      setDeleting({ story: workspace.story, chapter, action: 'delete' })
    } catch (failure) {
      setRequestError(failure.message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const draftsResource = {
    ...resource,
    data: resource.data.items,
    status: resource.status === 'ready' && !resource.data.items.length ? 'empty' : resource.status,
  }
  const source = draftsResource.data
  const ready = resource.status === 'ready'

  const shown = useMemo(
    () =>
      source
        .filter(
          draft =>
            matchesFilter(draft, filter) &&
            `${draft.title} ${draft.story}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'Word Count'
            ? wordCount(b) - wordCount(a)
            : sort === 'Title'
              ? a.title.localeCompare(b.title)
              : a.order - b.order,
        ),
    [source, filter, query, sort],
  )
  const tabItems = filterLabels.map(([value, label]) => ({
    value,
    label: ready
      ? `${label} (${['Standalone Concepts', 'Ready for Review'].includes(value) ? '—' : source.filter(draft => matchesFilter(draft, value)).length})`
      : label,
  }))
  const newTitleError = newTouched && !newTitle.trim()

  const openNew = () => {
    setRequestError('')
    setNewTitle('Bản thảo chưa đặt tên')
    setNewTouched(false)
    setNewOpen(true)
  }
  const addDraft = async event => {
    event.preventDefault()
    setNewTouched(true)
    if (
      busyRef.current ||
      !newTitle.trim() ||
      !resource.data.stories.some(story => story.id === storyId)
    )
      return
    busyRef.current = true
    setBusy(true)
    setRequestError('')
    try {
      const result = await apiRequest(`/author/stories/${storyId}/chapters`, {
        method: 'POST',
        body: { title: newTitle.trim(), paragraphs: [''] },
      })
      if (!result.chapter?.id) throw new Error(t('draftsData.error'))
      setNewOpen(false)
      setFilter('All Drafts')
      setQuery('')
      resource.retry()
    } catch (error) {
      setRequestError(error.message || t('draftsData.error'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const duplicate = async draft => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setRequestError('')
    try {
      const path = `/author/stories/${draft.storyId}/chapters/${draft.id}`
      let response
      try {
        response = await apiRequest(path)
      } catch (failure) {
        if (failure.code !== 'unsupported_editor_format') throw failure
        response = await apiRequest(`${path}?format=rich`)
      }
      const { chapter } = response
      if (!chapter.canEdit || chapter.version !== draft.version)
        throw new Error(t('draftsData.stale'))
      const result = await apiRequest(`/author/stories/${draft.storyId}/chapters`, {
        method: 'POST',
        body: chapter.document
          ? {
              document: {
                ...chapter.document,
                title: `${chapter.title.slice(0, 180)} (${t('draftsData.copy')})`,
              },
            }
          : {
              title: `${chapter.title.slice(0, 180)} (${t('draftsData.copy')})`,
              paragraphs: chapter.paragraphs.length ? chapter.paragraphs : [''],
            },
      })
      if (!result.chapter?.id) throw new Error(t('draftsData.error'))
      resource.retry()
    } catch (error) {
      setRequestError(error.message || t('draftsData.error'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="nh-eyebrow">Kho bản thảo · Phiên soạn thảo trực tiếp</p>
            <h1 className="mt-3 text-h2 sm:text-h1">Bản nháp và bản thảo đang viết</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">{t('draftsData.hint')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/author/import" variant="secondary">
              <Upload size={16} aria-hidden="true" />
              Nhập bản thảo
            </ButtonLink>
            <Button onClick={openNew}>
              <FilePlus2 size={16} aria-hidden="true" />
              Bản nháp mới
            </Button>
          </div>
        </header>

        {requestError && (
          <p role="alert" className="mt-4 text-sm text-rose-strong">
            {requestError}
          </p>
        )}
        <Card className="mt-6 p-4">
          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
            <div className="min-w-0 max-w-full">
              <Tabs
                singleRow
                label="Lọc bản nháp"
                value={filter}
                onChange={setFilter}
                items={tabItems}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center 2xl:ml-auto">
              <Input
                icon={Search}
                type="search"
                enterKeyHint="search"
                aria-label="Tìm bản nháp"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Tìm bản nháp, truyện..."
                className="sm:flex-1 2xl:w-64 2xl:flex-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Sắp xếp bản nháp"
                  value={sort}
                  onChange={event => setSort(event.target.value)}
                  className="min-w-44 flex-1 sm:flex-none"
                >
                  <option value="Last Edited">Chỉnh sửa gần nhất</option>
                  <option value="Word Count">Số từ</option>
                  <option value="Title">Tiêu đề</option>
                </Select>
                <div
                  role="group"
                  aria-label="Chế độ hiển thị"
                  className="flex shrink-0 gap-1 rounded-full border border-hairline bg-elevated p-1"
                >
                  {[
                    ['grid', 'Chế độ lưới', Grid2X2],
                    ['list', 'Chế độ danh sách', List],
                  ].map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={label}
                      aria-pressed={view === value}
                      onClick={() => setView(value)}
                      className={`grid size-9 place-items-center rounded-full transition-[background-color,color] duration-200 pointer-coarse:size-11 ${view === value ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-surface hover:text-ink'}`}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {draftsResource.status === 'loading' ? (
          <section
            aria-busy="true"
            aria-label="Đang tải bản nháp"
            className={`nh-grid-12 mt-6 grid gap-5 ${view === 'grid' ? 'nh-md-cols-2' : 'nh-cols-1'}`}
          >
            {[0, 1, 2, 3].map(item => (
              <DraftCardSkeleton key={item} featured={item === 0 && view === 'grid'} />
            ))}
          </section>
        ) : draftsResource.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được bản nháp"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
              action={<RetryButton onClick={draftsResource.retry} />}
            />
          </Card>
        ) : draftsResource.status === 'empty' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={BookOpen}
              title="Chưa có bản nháp nào"
              description={t('documentImport.draftsEmpty')}
              action={
                <Button size="sm" onClick={openNew}>
                  <FilePlus2 size={14} aria-hidden="true" />
                  Bản nháp mới
                </Button>
              }
            />
          </Card>
        ) : shown.length ? (
          <section
            aria-label="Danh sách bản nháp"
            className={`nh-fade-enter nh-grid-12 mt-6 grid gap-5 ${view === 'grid' ? 'nh-md-cols-2' : 'nh-cols-1'}`}
          >
            {shown.map((draft, index) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                featured={index === 0 && view === 'grid'}
                onDelete={() => openDelete(draft)}
                onDuplicate={() => duplicate(draft)}
                busy={busy}
              />
            ))}
          </section>
        ) : (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={Search}
              title="Không tìm thấy bản nháp"
              description="Hãy thử bộ lọc khác hoặc tạo bản thảo mới."
              action={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFilter('All Drafts')
                      setQuery('')
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                  <Button size="sm" onClick={openNew}>
                    <FilePlus2 size={14} aria-hidden="true" />
                    Bản nháp mới
                  </Button>
                </>
              }
            />
          </Card>
        )}

        <Reveal>
          <Card className="mt-8">
            <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-center">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-h3">
                  <History size={20} className="shrink-0 text-brand" />
                  {t('draftsData.history')}
                </h2>
                <p className="mt-1 max-w-[65ch] text-sm text-muted">
                  {t('draftsData.historyHint')}
                </p>
              </div>
              <div className="w-full shrink-0 md:w-56">
                <p className="flex justify-between text-xs text-muted">
                  <span>Bộ nhớ đám mây</span>
                  <span className="tabular-nums">—</span>
                </p>
                <div aria-hidden="true" className="mt-2 h-1.5 rounded-full bg-elevated" />
              </div>
            </div>
            <ul className="nh-grid-12 mt-5 grid gap-3 nh-sm-cols-2 nh-xl-cols-4">
              {resource.data.history.map(item => (
                <li
                  key={item.id}
                  className="flex flex-col rounded-2xl border border-hairline bg-elevated p-4"
                >
                  <span className="text-xs text-ink/70">
                    {new Date(item.createdAt).toLocaleString('vi-VN')}
                  </span>
                  <strong className="mt-1.5 text-sm">{item.title}</strong>
                  <p className="mt-1 text-xs text-muted">
                    {t('draftsData.version', { number: item.number })}
                  </p>
                  <ButtonLink
                    to={editorRoute({ id: item.chapterId, storyId: item.storyId })}
                    variant="ghost"
                    size="sm"
                    className="mt-4 self-start"
                  >
                    {t('draftsData.current')}
                  </ButtonLink>
                </li>
              ))}
            </ul>
            {!resource.data.history.length && (
              <p className="mt-4 text-sm text-muted">{t('draftsData.noHistory')}</p>
            )}
          </Card>
        </Reveal>

        <Modal open={newOpen} title="Tạo bản nháp mới" onClose={() => !busy && setNewOpen(false)}>
          <form noValidate onSubmit={addDraft}>
            {requestError && <p className="text-sm text-rose-strong">{requestError}</p>}
            <p className="text-sm text-muted">{t('draftsData.chooseStory')}</p>
            <label htmlFor="draft-story" className="mt-4 block text-sm font-semibold">
              {t('draftsData.story')}
            </label>
            <Select
              id="draft-story"
              value={storyId}
              disabled={busy}
              onChange={event => setStoryId(event.target.value)}
            >
              <option value="">{t('draftsData.chooseStory')}</option>
              {resource.data.stories.map(story => (
                <option key={story.id} value={story.id}>
                  {story.title}
                </option>
              ))}
            </Select>
            {!resource.data.stories.length && (
              <ButtonLink to="/author/stories/new" className="mt-3">
                {t('navigation.newStory')}
              </ButtonLink>
            )}
            <label htmlFor="new-draft-title" className="mt-5 block text-sm font-semibold">
              Tên bản nháp
            </label>
            <Input
              id="new-draft-title"
              disabled={busy}
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              onBlur={() => setNewTouched(true)}
              maxLength={120}
              aria-invalid={newTitleError}
              aria-describedby={newTitleError ? 'new-draft-error' : undefined}
              className="mt-2"
            />
            {newTitleError && (
              <p id="new-draft-error" className="mt-2 text-xs text-rose-strong">
                Hãy nhập tên cho bản nháp.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={busy || !storyId}>
                <FilePlus2 size={16} aria-hidden="true" />
                Tạo bản nháp
              </Button>
            </div>
          </form>
        </Modal>

        {deleting && (
          <ChapterLifecycleDialog
            {...deleting}
            onClose={() => setDeleting(null)}
            onReload={() => {
              setDeleting(null)
              resource.retry()
            }}
            onSaved={() => {
              setDeleting(null)
              resource.retry()
            }}
          />
        )}
      </div>
    </AuthorLayout>
  )
}

function DraftCard({ draft, featured, onDelete, onDuplicate, busy }) {
  const { t } = useLocale()
  const words = wordCount(draft)
  const synced = draft.meta === 'Stored'
  const ready = draft.meta === 'Ready for Review'
  return (
    <Card as="article" className={`flex flex-col ${featured ? 'md:min-h-96' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={draft.tone}>{draftTypeLabels[draft.type] ?? draft.type}</Badge>
        {synced && (
          <Badge>
            <Cloud size={12} aria-hidden="true" />
            {t('draftsData.stored')}
          </Badge>
        )}
        {ready && (
          <Badge tone="green">
            <CheckCircle2 size={12} aria-hidden="true" />
            Sẵn sàng xét duyệt
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted">
          Sửa lần cuối: {new Date(draft.updatedAt).toLocaleString('vi-VN')}
        </span>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-brand-strong">
        <BookOpen size={14} aria-hidden="true" />
        Truyện: {draft.story}
      </p>
      <h2 className={`mt-2 ${featured ? 'text-h2' : 'text-h3'}`}>{draft.title}</h2>
      <p className="mt-3 line-clamp-3 max-w-[65ch] text-sm leading-6 text-muted">{draft.excerpt}</p>
      {!synced && !ready && <p className="mt-2 text-xs text-muted">{draft.meta}</p>}
      <dl className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-hairline bg-elevated p-4">
        <div>
          <dt className="text-xs text-ink/70">Số từ</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatNumber(words)} từ</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/70">Thời lượng đọc</dt>
          <dd className="text-sm font-semibold tabular-nums">~{readMinutes(words)} phút</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/70">Mục tiêu</dt>
          <dd className="text-sm font-semibold text-brand-strong tabular-nums">—</dd>
        </div>
        <div aria-hidden="true" className="col-span-3 h-1.5 rounded-full bg-elevated" />
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-hairline pt-5">
          <IconButton
            label={`Nhân bản ${draft.title}`}
            size="sm"
            disabled={busy}
            onClick={onDuplicate}
          >
            <Copy size={16} />
          </IconButton>
          <IconButton
            label={`Xóa ${draft.title}`}
            size="sm"
            tone="rose"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </IconButton>
          <div className="ml-auto flex flex-wrap gap-2">
            <ButtonLink
              variant="secondary"
              size="sm"
              to={`/author/stories/${draft.storyId}/chapters/${draft.id}/preview`}
            >
              <Eye size={14} aria-hidden="true" />
              Xem trước
            </ButtonLink>
            <ButtonLink to={editorRoute(draft)} size="sm">
              <WandSparkles size={14} aria-hidden="true" />
              Tiếp tục chỉnh sửa
            </ButtonLink>
          </div>
        </div>
      </div>
    </Card>
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

function DraftCardSkeleton({ featured }) {
  return (
    <Card as="div" aria-hidden="true" className={`flex flex-col ${featured ? 'md:min-h-96' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="ml-auto h-3 w-32" />
      </div>
      <Skeleton className="mt-5 h-3 w-40" />
      <Skeleton className={`mt-2 w-3/5 ${featured ? 'my-1.5 h-6' : 'my-1 h-5'}`} />
      <div className="mt-3 max-w-[65ch]">
        <Skeleton className="mt-1.5 h-3 w-full" />
        <Skeleton className="mt-3 h-3 w-11/12" />
        <Skeleton className="mb-1.5 mt-3 h-3 w-2/3" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-hairline bg-elevated p-4">
        {[0, 1, 2].map(item => (
          <div key={item}>
            <Skeleton className="mt-0.5 h-3 w-16" />
            <Skeleton className="mb-1 mt-2.5 h-3.5 w-20" />
          </div>
        ))}
        <Skeleton className="col-span-3 h-1.5 w-full" />
      </div>
      <div className="mt-auto pt-5">
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-hairline pt-5">
          <Skeleton className="size-9 rounded-2xl" />
          <Skeleton className="size-9 rounded-2xl" />
          <div className="ml-auto flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-44" />
          </div>
        </div>
      </div>
    </Card>
  )
}
