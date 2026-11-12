import { useMemo, useState } from 'react'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument, useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import {
  BookOpen,
  Plus,
  RefreshCw,
  AlertTriangle,
  PenLine,
  Search,
  Trash2,
} from '../../components/icons'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Modal,
} from '../../components/ui'
import { apiRequest } from '../../api/client'
import { StoryCover } from '../../components/story/StoryCover'

const emptyWorkspace = { chapters: [] }
export function AuthorWorksPage({ editor = false }) {
  const { t } = useLocale()
  const works = useBackendResource('/author/stories')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('updated')
  const [selected, setSelected] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi')
    return works.data
      .filter(story => {
        const matchesQuery = `${story.title} ${story.description}`
          .toLocaleLowerCase('vi')
          .includes(normalized)
        return matchesQuery && (status === 'all' || story.status === status)
      })
      .sort((left, right) => {
        if (sort === 'title') return left.title.localeCompare(right.title, 'vi')
        if (sort === 'chapters') return (right.chapterCount ?? 0) - (left.chapterCount ?? 0)
        return new Date(right.updatedAt ?? 0) - new Date(left.updatedAt ?? 0)
      })
  }, [query, sort, status, works.data])
  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const response = await apiRequest(`/author/stories/${deleting.id}/lifecycle`, {
        method: 'POST',
        body: { action: 'delete', expectedVersion: deleting.version },
      })
      if (response?.story?.status !== 'archived') throw new Error(t('worksData.deleteError'))
      setDeleting(null)
      works.retry()
    } catch (failure) {
      setDeleteError(failure.message || t('worksData.deleteError'))
    } finally {
      setDeleteBusy(false)
    }
  }
  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <p className="nh-eyebrow">{t('worksData.studio')}</p>
            <h1 className="mt-2 text-h1">
              {t(editor ? 'worksData.editorTitle' : 'navigation.storyManager')}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {t(editor ? 'worksData.editorHint' : 'worksData.hint')}
            </p>
          </div>
          <ButtonLink to="/author/stories/new">
            <Plus size={16} />
            {t('navigation.newStory')}
          </ButtonLink>
        </header>
        <Card className="mt-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
            <Input
              icon={Search}
              type="search"
              aria-label={t('worksData.search')}
              placeholder={t('worksData.search')}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <Select
              aria-label={t('worksData.filterLabel')}
              value={status}
              onChange={event => setStatus(event.target.value)}
            >
              <option value="all">{t('worksData.filters.all')}</option>
              <option value="draft">{t('worksData.status.draft')}</option>
              <option value="submitted">{t('worksData.status.submitted')}</option>
              <option value="under-review">{t('worksData.status.under-review')}</option>
              <option value="approved">{t('worksData.status.approved')}</option>
              <option value="published">{t('worksData.status.published')}</option>
              <option value="unpublished">{t('worksData.status.unpublished')}</option>
              <option value="archived">{t('worksData.status.archived')}</option>
            </Select>
            <Select
              aria-label={t('worksData.sortLabel')}
              value={sort}
              onChange={event => setSort(event.target.value)}
            >
              <option value="updated">{t('worksData.sort.updated')}</option>
              <option value="title">{t('worksData.sort.title')}</option>
              <option value="chapters">{t('worksData.sort.chapters')}</option>
            </Select>
          </div>
          {works.status === 'loading' ? (
            <div aria-busy="true" className="mt-5 space-y-4">
              {[0, 1, 2].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : works.status === 'error' ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('worksData.error')}
              action={
                <Button variant="secondary" onClick={works.retry}>
                  <RefreshCw size={16} />
                  {t('common.retry')}
                </Button>
              }
            />
          ) : matches.length ? (
            <ul className="mt-5 divide-y divide-hairline">
              {matches.map(story => (
                <li
                  key={story.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <StoryCover story={story} className="aspect-[2/3] w-16 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-h3">{story.title}</h2>
                      <Badge className="mt-2">{t(`worksData.status.${story.status}`)}</Badge>
                      <p className="mt-2 line-clamp-2 text-sm text-muted">{story.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                        <span>
                          {t('worksData.chapterCount', { count: story.chapterCount ?? 0 })}
                        </span>
                        {story.reviewStatus && (
                          <Badge tone={story.reviewStatus === 'approved' ? 'green' : 'purple'}>
                            {t('worksData.reviewLabel')}:{' '}
                            {t(`worksData.review.${story.reviewStatus}`)}
                          </Badge>
                        )}
                        {story.category && <Badge tone="blue">{story.category.name}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editor ? (
                      <Button variant="secondary" onClick={() => setSelected(story)}>
                        <PenLine size={16} />
                        {t('worksData.chooseChapter')}
                      </Button>
                    ) : (
                      <ButtonLink to={`/author/stories/${story.id}`} variant="secondary">
                        <BookOpen size={16} />
                        {t('worksData.manage')}
                      </ButtonLink>
                    )}
                    {story.canDelete && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteError('')
                          setDeleting(story)
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        {t('worksData.delete')}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={BookOpen}
              title={t(works.data.length ? 'worksData.noMatches' : 'worksData.empty')}
            />
          )}
        </Card>
        {editor && selected && <ChapterPicker key={selected.id} story={selected} />}
        <Modal
          open={Boolean(deleting)}
          title={t('worksData.deleteTitle')}
          onClose={() => !deleteBusy && setDeleting(null)}
        >
          <p className="font-semibold">{deleting?.title}</p>
          <p className="mt-3 text-sm leading-6 text-muted">{t('worksData.deleteHint')}</p>
          {deleteError && (
            <p className="mt-3 text-sm text-rose-strong" role="alert">
              {deleteError}
            </p>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>
              {t('worksData.cancel')}
            </Button>
            <Button variant="danger" disabled={deleteBusy} onClick={confirmDelete}>
              {deleteBusy ? t('worksData.deleting') : t('worksData.confirmDelete')}
            </Button>
          </div>
        </Modal>
      </div>
    </AuthorLayout>
  )
}
function ChapterPicker({ story }) {
  const { t } = useLocale()
  const workspace = useBackendDocument(`/author/stories/${story.id}/workspace`, emptyWorkspace)
  return (
    <Card className="mt-6">
      <h2 className="break-words text-h3">{story.title}</h2>
      {workspace.status === 'loading' ? (
        <Skeleton className="mt-4 h-24 w-full" />
      ) : workspace.status === 'error' ? (
        <EmptyState
          icon={AlertTriangle}
          title={t('worksData.error')}
          action={<Button onClick={workspace.retry}>{t('common.retry')}</Button>}
        />
      ) : workspace.data.chapters.length ? (
        <ul className="mt-4 divide-y divide-hairline">
          {workspace.data.chapters.map(chapter => (
            <li key={chapter.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <span className="min-w-0 flex-1 break-words">
                {t('worksData.chapter', { number: chapter.number, title: chapter.title })}
              </span>
              <ButtonLink
                to={`/author/stories/${story.id}/chapters/${chapter.id}/edit`}
                variant="secondary"
                size="sm"
              >
                {t(chapter.status === 'draft' ? 'worksData.edit' : 'worksData.read')}
              </ButtonLink>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={PenLine}
          title={t('worksData.noChapters')}
          action={
            <ButtonLink to={`/author/stories/${story.id}`}>
              {t('worksData.createChapter')}
            </ButtonLink>
          }
        />
      )}
    </Card>
  )
}
