import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderHeart,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UsersRound,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
import { SavedStoryCard, SavedStoryCardSkeleton } from '../../components/reader/SavedStoryCard';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Input,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

const tabs = [
  ['saved', 'following.savedStories'],
  ['authors', 'following.followedAuthors'],
  ['favorites', 'following.favorites'],
  ['collections', 'following.collections'],
];

const PAGE_SIZE = 4;

const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('');
const emptyFollowing = { savedStories: [], collections: [], authors: [] };

function CollectionCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <Skeleton className="h-2.5 w-24" />
        <span className="mt-2 flex h-7 items-center">
          <Skeleton className="h-5 w-3/4" />
        </span>
        <span className="mt-2 flex flex-col gap-2 py-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </span>
        <span className="mt-4 flex h-4 items-center">
          <Skeleton className="h-2.5 w-40" />
        </span>
      </div>
      <Skeleton className="aspect-[2/3] w-24 shrink-0 -rotate-3 rounded-2xl" />
    </Card>
  );
}

export function FollowingPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState('saved');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('latest');
  const [page, setPage] = useState(1);
  const feed = useBackendDocument('/reader/following', emptyFollowing);
  const loading = feed.status === 'loading';
  const ready = feed.status === 'ready';
  const stories = useMemo(
    () =>
      feed.data.savedStories
        .filter(
          (story) =>
            (tab !== 'favorites' || story.favorite) &&
            `${story.title} ${story.author}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : 0)),
    [feed.data, query, sort, tab],
  );
  const pageCount = Math.max(1, Math.ceil(stories.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStories = stories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const changeTab = (value) => {
    setTab(value);
    setPage(1);
  };
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <div className="nh-grid-12 grid gap-7 nh-layout-xl-8-4">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-xs text-muted">
                <li>
                  <Link to="/reader/library" className="transition-colors hover:text-ink">
                    {t('navigation.library')}
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight size={12} />
                </li>
                <li aria-current="page" className="font-medium text-brand-strong">
                  {t('following.title')}
                </li>
              </ol>
            </nav>
            <h1 className="mt-3 text-h2 sm:text-h1">{t('following.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t('readerData.followingDescription')}
            </p>
            <div className="mt-6">
              <Tabs
                singleRow
                label={t('following.title')}
                value={tab}
                onChange={changeTab}
                items={tabs.map(([value, label]) => ({
                  value,
                  label: `${t(label)} (${!ready ? '—' : value === 'saved' ? feed.data.savedStories.length : value === 'collections' ? feed.data.collections.length : '—'})`,
                }))}
              />
            </div>
            {(loading || ready) && (
              <section className="mt-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-h3 md:text-h2">{t('readerData.genreCollections')}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => changeTab('collections')}
                    className="text-brand-strong"
                  >
                    {t('readerData.viewGroups', { count: feed.data.collections.length })}
                    <ArrowRight size={14} />
                  </Button>
                </div>
                {loading ? (
                  <div
                    aria-busy="true"
                    aria-label="Đang tải bộ sưu tập"
                    className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2"
                  >
                    {Array.from({ length: 2 }, (_, index) => (
                      <CollectionCardSkeleton key={index} />
                    ))}
                  </div>
                ) : (
                  <div className="nh-fade-enter nh-grid-12 mt-4 grid gap-4 nh-md-cols-2">
                    {feed.data.collections.map((item) => (
                      <Card as="article" key={item.title} className="flex items-center gap-4 p-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-strong">
                            {t('readerData.fromLibrary')}
                          </p>
                          <h3 className="mt-2 text-h3">{item.title}</h3>
                          <p className="mt-2 text-sm leading-5 text-muted">
                            {t('readerData.groupDescription')}
                          </p>
                          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <BookOpen size={14} /> {item.count} truyện
                            </span>
                            <span aria-hidden="true">•</span>
                            <span className="whitespace-nowrap">{t('readerData.fromLibrary')}</span>
                          </p>
                        </div>
                        <StoryCover
                          story={item.story}
                          className="aspect-[2/3] w-24 shrink-0 -rotate-3 rounded-2xl shadow-soft"
                        />
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            )}
            <section className="mt-8">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <Select
                    aria-label={t('following.sortStories')}
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setPage(1);
                    }}
                    className="shrink-0"
                  >
                    <option value="latest">{t('following.latestUpdated')}</option>
                    <option value="title">{t('following.titleAz')}</option>
                  </Select>
                  {ready ? (
                    <span className="hidden text-xs text-muted md:block">
                      {t('following.showingSaved', {
                        shown: pageStories.length,
                        total: feed.data.savedStories.length,
                      })}
                    </span>
                  ) : (
                    loading && <Skeleton className="hidden h-3 w-40 md:block" />
                  )}
                </div>
                <Input
                  icon={Search}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t('following.searchSaved')}
                  aria-label={t('following.searchSaved')}
                  className="w-full sm:w-64"
                />
              </div>
              {loading ? (
                <div
                  aria-busy="true"
                  aria-label="Đang tải truyện đã lưu"
                  className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2"
                >
                  {Array.from({ length: PAGE_SIZE }, (_, index) => (
                    <SavedStoryCardSkeleton key={index} />
                  ))}
                </div>
              ) : feed.status === 'error' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    tone="rose"
                    icon={AlertTriangle}
                    title="Không tải được danh sách theo dõi"
                    description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                    action={
                      <Button variant="secondary" size="sm" onClick={feed.retry}>
                        <RefreshCw size={14} aria-hidden="true" />
                        Thử lại
                      </Button>
                    }
                  />
                </Card>
              ) : tab === 'saved' && !feed.data.savedStories.length ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    icon={BookOpen}
                    title="Bạn chưa lưu hay theo dõi truyện nào"
                    description="Lưu truyện và theo dõi tác giả để nhận chương mới ngay tại đây."
                    action={
                      <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                        Khám phá truyện
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : tab === 'authors' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    icon={UsersRound}
                    title={t('following.yourAuthors')}
                    description={t('readerData.noAuthorFollowing')}
                    action={
                      <ButtonLink to="/search" variant="secondary" size="sm">
                        {t('navigation.explore')}
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : tab === 'favorites' ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    icon={FolderHeart}
                    title={t('readerData.noFavoritesTitle')}
                    description={t('readerData.noFavorites')}
                  />
                </Card>
              ) : tab === 'collections' && !feed.data.collections.length ? (
                <Card className="mt-4 p-0">
                  <EmptyState
                    icon={FolderHeart}
                    title={t('readerData.noGroups')}
                    description={t('readerData.groupDescription')}
                  />
                </Card>
              ) : tab === 'collections' ? (
                <div className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2">
                  {feed.data.collections.map((item) => (
                    <Card as="article" key={item.title}>
                      <span className="grid size-10 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                        <FolderHeart size={18} />
                      </span>
                      <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm text-muted">{t('readerData.groupDescription')}</p>
                    </Card>
                  ))}
                </div>
              ) : pageStories.length ? (
                <div className="nh-fade-enter nh-grid-12 mt-4 grid gap-4 nh-md-cols-2">
                  {pageStories.map((story) => (
                    <SavedStoryCard key={story.id} story={story} />
                  ))}
                </div>
              ) : (
                <Card className="mt-4 p-0">
                  <EmptyState icon={Sparkles} title={t('following.noMatches')} />
                </Card>
              )}
              {ready && (tab === 'saved' || tab === 'favorites') && pageCount > 1 && (
                <nav aria-label="Phân trang" className="mt-7 flex justify-center gap-2">
                  <IconButton
                    label="Trang trước"
                    shape="circle"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </IconButton>
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                    <button
                      key={number}
                      type="button"
                      aria-current={currentPage === number ? 'page' : undefined}
                      onClick={() => setPage(number)}
                      className={`size-9 rounded-full border text-xs font-semibold tabular-nums ${currentPage === number ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface hover:border-brand'}`}
                    >
                      {number}
                    </button>
                  ))}
                  <IconButton
                    label="Trang sau"
                    shape="circle"
                    size="sm"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    className="disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </IconButton>
                </nav>
              )}
            </section>
          </div>
          <aside className="space-y-5">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-h3">{t('following.suggestedAuthors')}</h2>
                <Link
                  to="/search"
                  className="text-sm font-semibold text-brand-strong transition-colors hover:text-brand"
                >
                  {t('navigation.explore')}
                </Link>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted">
                {t('readerData.authorSuggestionNote')}
              </p>
              {loading ? (
                <ul
                  aria-busy="true"
                  aria-label="Đang tải tác giả gợi ý"
                  className="mt-4 divide-y divide-hairline"
                >
                  {Array.from({ length: 4 }, (_, index) => (
                    <li key={index} aria-hidden="true" className="flex items-center gap-3 py-3.5">
                      <Skeleton className="size-10 shrink-0" />
                      <span className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </span>
                      <Skeleton className="h-9 w-20 shrink-0" />
                    </li>
                  ))}
                </ul>
              ) : ready ? (
                <ul className="nh-fade-enter mt-4 divide-y divide-hairline">
                  {feed.data.authors.map((author) => {
                    return (
                      <li key={author.id} className="flex items-center gap-3 py-3.5">
                        <span
                          aria-hidden="true"
                          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong"
                        >
                          {initials(author.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="line-clamp-2 whitespace-normal text-sm font-semibold"
                            title={author.name}
                          >
                            {author.name}
                          </h3>
                          <p className="text-xs text-muted">{author.meta}</p>
                        </div>
                        <ButtonLink
                          to={`/stories/${author.storyId}`}
                          size="sm"
                          variant="outline"
                          className="px-3 text-xs"
                        >
                          {t('readerData.viewWork')}
                        </ButtonLink>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  {feed.status === 'error'
                    ? 'Chưa tải được gợi ý tác giả.'
                    : 'Chưa có gợi ý tác giả nào lúc này.'}
                </p>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">{t('following.weeklyGoal')}</h2>
                <strong className="text-sm tabular-nums text-brand-strong">—</strong>
              </div>
              <div aria-hidden="true" className="mt-4 h-1.5 rounded-full bg-elevated" />
              <p className="mt-3 text-xs leading-5 text-muted">{t('readerData.noWeeklyGoal')}</p>
              <ButtonLink to="/reader/history" variant="secondary" className="mt-4 w-full">
                <Target size={16} />
                {t('following.viewProgress')}
              </ButtonLink>
            </Card>
            <Card className="bg-elevated">
              <p className="text-lg font-medium leading-7 text-ink">
                “Những câu chuyện hay làm ngày mai thêm tử tế.”
              </p>
              <p className="mt-4 text-xs text-ink/70">— NovelHub Editorial</p>
            </Card>
          </aside>
        </div>
      </div>
    </ReaderLayout>
  );
}
