import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Filter,
  Flame,
  RefreshCw,
  Search,
  Star,
} from '../../components/icons';
import { PublicHeader } from '../../components/public/PublicHeader';
import { SearchFilters } from '../../components/public/SearchFilters';
import {
  SearchResultItem,
  SearchResultItemSkeleton,
} from '../../components/public/SearchResultItem';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  Drawer,
  EmptyState,
  Input,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { searchResults, trendingSearches } from '../../data/mock/search';
import { stories } from '../../data/mock/stories';
import { useLocale } from '../../context/LocaleContext';
import { useMockResource } from '../../context/MockDataContext';

const resultTabs = ['all', 'stories', 'audiobooks', 'authors'];
const PAGE_SIZE = 2;
const INITIAL_FILTERS = [
  'Stories',
  'Audiobooks',
  'Authors',
  'Fantasy',
  'Romance',
  'Text Story',
  'Audiobook Edition',
];
const filterGenres = {
  Fantasy: ['Fantasy'],
  Romance: ['Romance'],
  'Mystery & Thriller': ['Mystery'],
  'Sci-Fi': ['Sci-Fi'],
  Adventure: ['Adventure'],
};
const featuredStory = stories[0];

/* Applies the sidebar filters (content type/format, genre, publication status) to mock results. */
function matchesFilters(result, { checked, status }) {
  const formats = new Set();
  if (checked.includes('Stories') || checked.includes('Text Story')) formats.add('Story');
  if (checked.includes('Audiobooks') || checked.includes('Audiobook Edition')) formats.add('Audio');
  if (formats.size && !formats.has(result.format)) return false;
  const genres = Object.keys(filterGenres)
    .filter((key) => checked.includes(key))
    .flatMap((key) => filterGenres[key]);
  if (genres.length && !result.genres.some((genre) => genres.includes(genre))) return false;
  if (status === 'ongoing') return result.status === 'Ongoing';
  if (status === 'completedOnly') return result.status === 'Completed';
  return true;
}

export function SearchResultsPage({ embedded = false }) {
  const { t } = useLocale();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? (params.has('format') ? '' : 'moon'));
  const [sort, setSort] = useState('Relevance');
  const [tab, setTab] = useState(() => (params.get('format') === 'audio' ? 'audiobooks' : 'all'));
  const [checked, setChecked] = useState(INITIAL_FILTERS);
  const [status, setStatus] = useState('allStatuses');
  const [applied, setApplied] = useState({ checked: INITIAL_FILTERS, status: 'allStatuses' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const appliedCount = applied.checked.length + (applied.status === 'allStatuses' ? 0 : 1);
  const catalog = useMockResource('search:results', searchResults);
  const loading = catalog.status === 'loading';
  const results = useMemo(
    () =>
      catalog.data.filter(
        (result) =>
          `${result.title} ${result.author} ${result.genres.join(' ')}`
            .toLowerCase()
            .includes(query.toLowerCase()) && matchesFilters(result, applied),
      ),
    [catalog.data, query, applied],
  );
  const visibleResults = useMemo(() => {
    const filtered = results.filter((result) =>
      tab === 'stories'
        ? result.format === 'Story'
        : tab === 'audiobooks'
          ? result.format === 'Audio'
          : true,
    );
    if (sort === 'Top Rated') filtered.sort((a, b) => Number(b.rating) - Number(a.rating));
    if (sort === 'Most Popular') filtered.sort((a, b) => parseFloat(b.reads) - parseFloat(a.reads));
    return tab === 'authors'
      ? [...new Map(filtered.map((result) => [result.author, result])).values()]
      : filtered;
  }, [results, tab, sort]);
  const pageCount = Math.max(1, Math.ceil(visibleResults.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageResults = visibleResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const updateQuery = (value) => {
    setQuery(value);
    setPage(1);
  };
  const updateTab = (value) => {
    setTab(value);
    setPage(1);
  };
  const changePage = (value) => {
    setPage(value);
    document
      .querySelector('[data-search-tabs]')
      ?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const toggle = (item) =>
    setChecked((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  const apply = () => {
    setApplied({ checked, status });
    setPage(1);
  };
  const reset = () => {
    setChecked([]);
    setStatus('allStatuses');
    setApplied({ checked: [], status: 'allStatuses' });
    setPage(1);
  };
  const filterProps = {
    checked,
    status,
    onToggle: toggle,
    onStatusChange: setStatus,
    onReset: reset,
  };
  const Root = embedded ? 'div' : 'main';
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <section className="mt-4 bg-transparent">
        <div className="mx-auto grid max-w-[1360px] gap-6 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-12">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="text-xs text-muted">
              <Link to="/" className="inline-flex min-h-8 items-center hover:text-brand-strong">
                {t('navigation.home')}
              </Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{t('common.search')}</span>
            </nav>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h1 className="text-h1 md:text-4xl">{t('search.results')}</h1>
              {catalog.status === 'ready' ? (
                <span className="text-sm text-muted" aria-live="polite">
                  {t('search.showingFor', {
                    count: visibleResults.length,
                    query: query || t('search.allStories'),
                  })}
                </span>
              ) : (
                loading && (
                  <span className="flex h-5 items-center">
                    <Skeleton className="h-3 w-40" />
                  </span>
                )
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              icon={Search}
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              aria-label={t('common.searchStoriesAuthorsTags')}
              placeholder={t('common.searchStoriesAuthorsTags')}
              className="w-full sm:w-72"
            />
            <div className="flex gap-2">
              <Select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                aria-label={t('search.sortResults')}
                className="min-w-0 flex-1"
              >
                <option value="Relevance">{t('search.relevance')}</option>
                <option value="Most Popular">{t('search.mostPopular')}</option>
                <option value="Newest">{t('search.newest')}</option>
                <option value="Top Rated">{t('search.topRated')}</option>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFiltersOpen(true)}
                aria-expanded={filtersOpen}
                className="shrink-0 gap-1.5 px-3 lg:hidden"
              >
                <Filter size={16} aria-hidden="true" />
                <span className="max-[359px]:sr-only">{t('search.filters')}</span>
                {appliedCount > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold tabular-nums text-on-brand">
                    {appliedCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
      <Root className="nh-grid-12 page-public grid gap-y-6 pb-20 pt-8 nh-layout-lg-3-9 nh-layout-xl-3-6-3">
        <aside className="hidden self-start lg:block">
          <Card className="p-5">
            <SearchFilters {...filterProps} onApply={apply} />
          </Card>
        </aside>
        <section className="min-w-0">
          <div data-search-tabs className="mb-5 scroll-mt-32 sm:scroll-mt-24">
            <Tabs
              label={t('search.results')}
              singleRow
              value={tab}
              onChange={updateTab}
              items={resultTabs.map((item) => ({
                value: item,
                label: `${t(`search.tabs.${item}`)}${item === 'all' && catalog.status === 'ready' ? ` (${results.length})` : ''}`,
              }))}
            />
          </div>
          {loading ? (
            <div aria-busy="true" aria-label="Đang tải kết quả tìm kiếm">
              <div className="space-y-4">
                {Array.from({ length: PAGE_SIZE }, (_, index) =>
                  tab === 'authors' ? (
                    <Card
                      as="div"
                      key={index}
                      aria-hidden="true"
                      className="flex flex-wrap items-center justify-between gap-4 p-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Skeleton className="size-12 shrink-0" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-44" />
                        </div>
                      </div>
                      <Skeleton className="h-9 w-28" />
                    </Card>
                  ) : (
                    <SearchResultItemSkeleton key={index} />
                  ),
                )}
              </div>
              <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <span className="flex h-5 items-center">
                  <Skeleton className="h-3 w-48" />
                </span>
                <Skeleton className="h-[3.125rem] w-36" />
              </div>
            </div>
          ) : catalog.status === 'error' ? (
            <Card className="p-0">
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được kết quả tìm kiếm"
                description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                action={
                  <Button variant="secondary" size="sm" onClick={catalog.retry}>
                    <RefreshCw size={14} aria-hidden="true" />
                    Thử lại
                  </Button>
                }
              />
            </Card>
          ) : catalog.status === 'empty' ? (
            <Card className="p-0">
              <EmptyState
                icon={BookOpen}
                title="Thư viện truyện đang được cập nhật"
                description="Chưa có truyện nào để tìm kiếm. Hãy khám phá theo thể loại trong lúc chờ."
                action={
                  <ButtonLink to="/categories" size="sm" trailingIcon={ArrowRight}>
                    Khám phá thể loại
                  </ButtonLink>
                }
              />
            </Card>
          ) : visibleResults.length ? (
            <div className="nh-fade-enter">
              <div className="space-y-4">
                {tab === 'authors'
                  ? pageResults.map((result) => (
                      <Card
                        as="article"
                        key={result.author}
                        className="flex flex-wrap items-center justify-between gap-4 p-5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={result.author} className="size-12" />
                          <div className="min-w-0 break-words">
                            <h3 className="text-base font-semibold">{result.author}</h3>
                            <p className="mt-0.5 text-xs text-muted">
                              {t('search.authorOf', { title: result.title })}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updateQuery(result.author);
                            updateTab('all');
                          }}
                        >
                          {t('search.viewStories')}
                        </Button>
                      </Card>
                    ))
                  : pageResults.map((result) => (
                      <SearchResultItem result={result} key={result.id} />
                    ))}
              </div>
              <div className="mt-6 flex flex-col items-center justify-between gap-4 sm:flex-row">
                <p className="text-sm text-muted">
                  Hiển thị <strong className="text-ink">{(currentPage - 1) * PAGE_SIZE + 1}</strong>{' '}
                  đến{' '}
                  <strong className="text-ink">
                    {Math.min(currentPage * PAGE_SIZE, visibleResults.length)}
                  </strong>{' '}
                  trong <strong className="text-ink">{visibleResults.length}</strong> kết quả
                </p>
                {pageCount > 1 && (
                  <nav
                    aria-label="Trang kết quả tìm kiếm"
                    className="flex gap-2 rounded-full border border-hairline bg-elevated p-1"
                  >
                    {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
                      <button
                        type="button"
                        onClick={() => changePage(item)}
                        aria-label={`Trang ${item}`}
                        aria-current={currentPage === item ? 'page' : undefined}
                        className={`grid size-11 place-items-center rounded-full text-sm font-semibold tabular-nums transition-[background-color,color] duration-200 ease-spring ${currentPage === item ? 'bg-brand text-on-brand shadow-[0_6px_16px_-10px_var(--primary)]' : 'text-ink/70 hover:bg-surface hover:text-ink'}`}
                        key={item}
                      >
                        {item}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            </div>
          ) : (
            <Card className="p-0">
              <EmptyState
                icon={Search}
                title={t('search.noResults')}
                description={t('search.tryAnother')}
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={reset}>
                    {t('search.resetFilters')}
                  </Button>
                }
              />
            </Card>
          )}
        </section>
        <aside className="hidden space-y-5 xl:block">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Flame size={16} className="text-orange" aria-hidden="true" />
              {t('search.trending')}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {trendingSearches.map((item) => (
                <button
                  type="button"
                  onClick={() => updateQuery(item.slice(1))}
                  className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink/75 transition-[border-color,color,background-color] duration-200 ease-spring hover:border-brand hover:bg-brand/8 hover:text-brand-strong"
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-orange-strong">
              {t('search.storyOfMonth')}
            </span>
            <div className="mt-4 flex gap-3">
              <StoryCover
                story={featuredStory}
                className="aspect-[2/3] w-16 shrink-0 rounded-xl border border-hairline"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{featuredStory.title}</h3>
                <p className="text-xs text-muted">tác giả {featuredStory.author}</p>
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold tabular-nums">
                  <Star size={13} className="fill-orange text-orange" aria-hidden="true" />
                  {featuredStory.rating}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted">
              The wind moved gently through the ancient trees, carrying whispers of forgotten
              stories.
            </p>
            <ButtonLink
              to={`/stories/${featuredStory.id}`}
              size="sm"
              trailingIcon={ArrowRight}
              className="mt-4 w-full"
            >
              {t('search.readFeature')}
            </ButtonLink>
          </Card>
          <Card className="bg-elevated p-5 text-center">
            <p className="font-medium italic leading-relaxed">
              “Những câu chuyện hay làm ngày mai thêm tử tế.”
            </p>
            <p className="mt-3 text-xs text-ink/70">— NovelHub</p>
          </Card>
        </aside>
      </Root>
      <Drawer
        open={filtersOpen}
        title={t('search.searchFilters')}
        onClose={() => setFiltersOpen(false)}
      >
        <SearchFilters
          {...filterProps}
          showHeading={false}
          onApply={() => {
            apply();
            setFiltersOpen(false);
          }}
        />
      </Drawer>
    </div>
  );
}
