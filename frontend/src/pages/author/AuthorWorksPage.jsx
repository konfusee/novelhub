import { useState } from 'react'
import { AuthorLayout } from '../../layouts'
import { useBackendDocument, useBackendResource } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { BookOpen, Plus, RefreshCw, AlertTriangle, PenLine, Search } from '../../components/icons'
import { Badge, Button, ButtonLink, Card, EmptyState, Input, Skeleton } from '../../components/ui'

const emptyWorkspace = { chapters: [] }
export function AuthorWorksPage({ editor = false }) {
  const { t } = useLocale()
  const works = useBackendResource('/author/stories')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const matches = works.data.filter(story =>
    story.title.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')),
  )
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
          <Input
            icon={Search}
            type="search"
            aria-label={t('worksData.search')}
            placeholder={t('worksData.search')}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
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
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-h3">{story.title}</h2>
                    <Badge className="mt-2">{t(`worksData.status.${story.status}`)}</Badge>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{story.description}</p>
                  </div>
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
