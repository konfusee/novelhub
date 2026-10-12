import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  RefreshCw,
  Search,
  Sparkles,
} from '../../components/icons';
import { PublicHeader } from '../../components/public/PublicHeader';
import { CategoryCard, CategoryCardSkeleton } from '../../components/public/CategoryCard';
import { StoryShelf } from '../../components/public/StoryShelf';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Reveal,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { useMockResource } from '../../context/MockDataContext';
import { categories, popularTags } from '../../data/mock/categories';
import { extendedStories, hiddenGems } from '../../data/mock/stories';

const filters = [
  ['All', 'Tất cả'],
  ['Popular', 'Phổ biến'],
  ['New', 'Mới'],
  ['Trending', 'Thịnh hành'],
  ['Completed', 'Đã hoàn thành'],
];

/* Mock ordering derived from the catalogue counts until the API exposes category stats. */
const storyCount = (category) => parseFloat(category.count) || 0;
const orderings = {
  Popular: (list) => [...list].sort((a, b) => storyCount(b) - storyCount(a)),
  New: (list) => [...list].reverse(),
  Trending: (list) =>
    list.filter((item) => storyCount(item) >= 10).sort((a, b) => storyCount(b) - storyCount(a)),
};

const gemTones = { Adventure: 'orange', Mystery: 'purple' };
const stagger = (index) => Math.min(index, 5) * 80;

/* Genre shelves and editor picks load as one curated-collections payload. */
const collections = {
  fantasy: extendedStories.filter((story) => story.genre === 'Fantasy').slice(0, 4),
  romance: extendedStories
    .filter((story) => story.genre === 'Romance' || story.genre === 'Drama')
    .slice(0, 4),
  scifi: extendedStories.filter((story) => story.genre === 'Sci-Fi').slice(0, 4),
  gems: hiddenGems,
};
const isCollectionsEmpty = (value) => Object.values(value).every((list) => !list.length);

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
}

function GemCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <span className="mt-4 flex h-7 items-center">
        <Skeleton className="h-5 w-3/4" />
      </span>
      <SkeletonLines />
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-14" />
      </div>
    </Card>
  );
}

/* Gem blurbs run ~6 lines on phones (full-width card) and ~3 in the desktop three-up grid. */
function SkeletonLines() {
  return (
    <span className="mt-2 flex flex-col gap-3 py-1.5">
      {Array.from({ length: 6 }, (_, line) => (
        <Skeleton
          key={line}
          className={`h-3 ${line === 5 ? 'w-2/3' : line === 2 ? 'w-full md:w-2/3' : 'w-full'} ${line > 2 ? 'md:hidden' : ''}`}
        />
      ))}
    </span>
  );
}

export function CategoriesPage({ embedded = false }) {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedGenre, setSelectedGenre] = useState(() => params.get('genre') ?? '');
  const catalog = useMockResource('catalog:categories', categories);
  const curated = useMockResource('catalog:collections', collections, {
    isEmpty: isCollectionsEmpty,
  });
  const visibleCategories = useMemo(() => {
    const matches = catalog.data.filter((category) =>
      `${category.name} ${category.description}`.toLowerCase().includes(query.toLowerCase()),
    );
    return orderings[filter]?.(matches) ?? matches;
  }, [catalog.data, query, filter]);
  const collectionsLoading = curated.status === 'loading';
  const { fantasy, romance, scifi, gems } = curated.data;
  const Root = embedded ? 'div' : 'main';
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-14 pb-20 pt-6 lg:space-y-16 lg:pt-10">
        <header className="max-w-3xl">
          <p className="nh-eyebrow">Khám phá thế giới tiếp theo</p>
          <h1 className="mt-4 text-h1 md:text-4xl">Khám phá thể loại</h1>
          <p className="mt-3 max-w-[60ch] text-base leading-7 text-muted">
            Khám phá những thế giới tưởng tượng theo thể loại, cảm xúc và lựa chọn của độc giả.
          </p>
        </header>
        <section className="-mt-4 flex flex-col gap-3 md:flex-row md:items-center lg:-mt-6">
          <Input
            icon={Search}
            placeholder="Tìm thể loại..."
            aria-label="Lọc theo từ khóa hoặc thể loại phụ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="md:w-80 md:shrink-0"
          />
          <div className="min-w-0">
            <Tabs
              label="Sắp xếp thể loại"
              singleRow
              value={filter}
              onChange={setFilter}
              items={filters.map(([value, label]) => ({ value, label }))}
            />
          </div>
        </section>
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-h3 md:text-h2">Tất cả thể loại</h2>
              {selectedGenre && (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  Đã chọn: <Badge tone="green">{selectedGenre}</Badge>
                  <Link
                    to={`/search?q=${encodeURIComponent(selectedGenre)}`}
                    className="inline-flex items-center gap-1 font-semibold text-brand-strong"
                  >
                    Xem truyện <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </p>
              )}
            </div>
            {catalog.status === 'ready' ? (
              <span className="text-sm text-muted" aria-live="polite">
                {visibleCategories.length} thể loại chính
              </span>
            ) : (
              catalog.status === 'loading' && (
                <span className="flex h-5 items-center">
                  <Skeleton className="h-3 w-24" />
                </span>
              )
            )}
          </div>
          {catalog.status === 'loading' ? (
            <div
              aria-busy="true"
              aria-label="Đang tải thể loại"
              className="nh-grid-12 grid gap-4 nh-sm-cols-2 nh-lg-cols-3"
            >
              {categories.map((category) => (
                <CategoryCardSkeleton key={category.name} />
              ))}
            </div>
          ) : catalog.status === 'error' ? (
            <Card className="p-0">
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được danh sách thể loại"
                description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                action={<RetryButton onClick={catalog.retry} />}
              />
            </Card>
          ) : catalog.status === 'empty' ? (
            <Card className="p-0">
              <EmptyState
                icon={BookOpen}
                title="Chưa có thể loại nào"
                description="Danh mục đang được ban biên tập cập nhật. Bạn vẫn có thể tìm truyện theo tên."
                action={
                  <ButtonLink to="/search" size="sm" trailingIcon={ArrowRight}>
                    Tìm truyện
                  </ButtonLink>
                }
              />
            </Card>
          ) : visibleCategories.length ? (
            <div className="nh-fade-enter nh-grid-12 grid gap-4 nh-sm-cols-2 nh-lg-cols-3">
              {visibleCategories.map((category) => (
                <CategoryCard
                  key={category.name}
                  category={category}
                  selected={selectedGenre === category.name}
                  onSelect={(name) => setSelectedGenre((current) => (current === name ? '' : name))}
                />
              ))}
            </div>
          ) : (
            <Card className="p-0">
              <EmptyState
                icon={Search}
                title={`Không có thể loại phù hợp “${query}”`}
                description="Hãy thử một từ khóa khác hoặc xóa bộ lọc."
              />
            </Card>
          )}
        </section>
        {(catalog.status === 'ready' || catalog.status === 'loading') && (
          <Reveal>
            <Card className="p-6 md:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-orange-strong">
                    Bộ sưu tập tuyển chọn
                  </p>
                  <h2 className="mt-1.5 text-h3 md:text-h2">Phổ biến tuần này</h2>
                </div>
                <ButtonLink to="/search" variant="outline" size="sm" trailingIcon={ArrowRight}>
                  Khám phá tất cả
                </ButtonLink>
              </div>
              {catalog.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label="Đang tải thẻ phổ biến"
                  className="nh-grid-12 mt-6 grid nh-cols-2 gap-3 nh-sm-cols-3 nh-lg-cols-6"
                >
                  {popularTags.map((tag) => (
                    <span
                      key={tag}
                      aria-hidden="true"
                      className="flex flex-col items-center rounded-2xl border border-hairline bg-elevated px-2 py-4"
                    >
                      <span className="flex h-5 w-full items-center justify-center">
                        <Skeleton className="h-3.5 w-3/4" />
                      </span>
                      <span className="mt-1 flex h-4 w-full items-center justify-center">
                        <Skeleton className="h-2.5 w-1/2" />
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="nh-fade-enter nh-grid-12 mt-6 grid nh-cols-2 gap-3 nh-sm-cols-3 nh-lg-cols-6">
                  {popularTags.map((tag, index) => (
                    <Link
                      to={`/search?q=${encodeURIComponent(tag.replace('#', ''))}`}
                      className="group rounded-2xl border border-hairline bg-elevated px-2 py-4 text-center transition-[transform,border-color] duration-200 ease-spring hover:-translate-y-0.5 hover:border-brand/60 sm:px-3 lg:px-2 xl:px-3"
                      key={tag}
                    >
                      <strong className="block whitespace-normal break-words text-sm font-semibold group-hover:text-brand-strong">
                        {/* Break long hashtags between their words, never mid-word. */}
                        {tag.split(/(?<=[a-z])(?=[A-Z])/).map((part, partIndex) => (
                          <Fragment key={partIndex}>
                            {partIndex > 0 && <wbr />}
                            {part}
                          </Fragment>
                        ))}
                      </strong>
                      <span className="mt-1 block text-xs tabular-nums text-ink/70">
                        {420 + index * 175} truyện
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </Reveal>
        )}
        {curated.status === 'error' ? (
          <Card className="p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được bộ sưu tập truyện"
              description="Các kệ truyện theo thể loại tạm thời chưa hiển thị được. Hãy thử lại."
              action={<RetryButton onClick={curated.retry} />}
            />
          </Card>
        ) : curated.status === 'empty' ? (
          <Card className="p-0">
            <EmptyState
              icon={BookOpen}
              title="Bộ sưu tập đang được tuyển chọn"
              description="Ban biên tập sẽ sớm cập nhật các kệ truyện mới. Trong lúc chờ, hãy xem bảng xếp hạng."
              action={
                <ButtonLink to="/rankings" size="sm" trailingIcon={ArrowRight}>
                  Xem bảng xếp hạng
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <>
            <StoryShelf
              title="Kỳ ảo — Thế giới sử thi & phép thuật"
              stories={fantasy}
              loading={collectionsLoading}
              placeholders={collections.fantasy.length}
            />
            <StoryShelf
              title="Lãng mạn — Hành trình cảm xúc"
              stories={romance}
              loading={collectionsLoading}
              placeholders={collections.romance.length}
            />
            <StoryShelf
              title="Khoa học viễn tưởng & Cyberpunk — Chân trời tương lai"
              stories={scifi}
              loading={collectionsLoading}
              placeholders={collections.scifi.length}
            />
          </>
        )}
        {(curated.status === 'ready' || collectionsLoading) && (
          <section>
            <p className="nh-eyebrow">
              <Sparkles size={12} aria-hidden="true" />
              Ban biên tập tuyển chọn
            </p>
            <h2 className="mt-3 text-h3 md:text-h2">Viên ngọc ẩn</h2>
            <p className="mt-1.5 max-w-[60ch] text-sm text-muted">
              Những tác phẩm có văn phong đặc sắc đã được tuyển chọn kỹ và đang chờ bạn khám phá.
            </p>
            {collectionsLoading ? (
              <div
                aria-busy="true"
                aria-label="Đang tải viên ngọc ẩn"
                className="nh-grid-12 mt-6 grid gap-4 nh-md-cols-3"
              >
                {hiddenGems.map((item) => (
                  <GemCardSkeleton key={item.title} />
                ))}
              </div>
            ) : (
              <div className="nh-grid-12 mt-6 grid gap-4 nh-md-cols-3">
                {gems.map((item, index) => (
                  <Reveal key={item.title} delay={stagger(index)}>
                    <Card
                      as={Link}
                      to="/stories/demo"
                      interactive
                      className="group flex h-full flex-col whitespace-normal"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={gemTones[item.genre] ?? 'green'}>{item.genre}</Badge>
                        <span className="text-xs tabular-nums text-muted">
                          {item.chapters} chương
                        </span>
                      </div>
                      <h3 className="mt-4 text-h3">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4 text-xs">
                        <span className="min-w-0 text-muted">Tác giả {item.author}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-strong">
                          Đọc thử
                          <ArrowRight
                            size={14}
                            aria-hidden="true"
                            className="transition-transform duration-200 ease-spring group-hover:translate-x-0.5"
                          />
                        </span>
                      </div>
                    </Card>
                  </Reveal>
                ))}
              </div>
            )}
          </section>
        )}
        {!embedded && (
          <Reveal>
            <Card
              as="section"
              bezel
              innerClassName="flex flex-col items-start justify-between gap-6 p-7 md:flex-row md:items-center md:p-10"
            >
              <div>
                <h2 className="text-h2">Tham gia NovelHub hôm nay</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  Mở khóa đề xuất cá nhân, đồng bộ tiến độ đọc và xây dựng thư viện số trên mọi
                  thiết bị.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <ButtonLink to="/register" trailingIcon={ArrowRight}>
                  Tạo tài khoản
                </ButtonLink>
                <ButtonLink to="/join" variant="secondary">
                  Tìm hiểu thêm
                </ButtonLink>
              </div>
            </Card>
          </Reveal>
        )}
      </Root>
    </div>
  );
}
