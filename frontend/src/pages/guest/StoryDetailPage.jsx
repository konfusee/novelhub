import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronDown,
  Headphones,
  RefreshCw,
  Search,
  Share2,
  Star,
} from '../../components/icons';
import { PublicHeader } from '../../components/public/PublicHeader';
import { ChapterList, ChapterListSkeleton } from '../../components/public/ChapterList';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  Reveal,
  Skeleton,
  SkeletonText,
  Tabs,
} from '../../components/ui';
import { chapterPreview, storyDetail } from '../../data/mock/reader';
import { stories } from '../../data/mock/stories';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useMockResource } from '../../context/MockDataContext';

const tabs = [
  ['chapters', 'storyDetail.chapters'],
  ['synopsis', 'storyDetail.synopsis'],
  ['reviews', 'storyDetail.reviews'],
  ['audiobooks', 'storyDetail.relatedAudiobooks'],
];
const genreTones = ['green', 'orange', 'purple'];
const ratingBreakdown = [82, 12, 4, 1, 1];
/* Detail mock has no cover; reuse the catalogue entry so StoryCover renders the real artwork. */
const coverStory = stories.find((story) => story.title === storyDetail.title) ?? storyDetail;
const featuredReview =
  '“Văn phong ở chương 2 khiến tôi nổi da gà. Thế giới truyện rất sống động và mạch căng thẳng không hề ngắt quãng.”';

const isMissing = (value) => !value;

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
}

/* Hero placeholder on the same bezel grid: 2:3 cover, display title, meta strip, actions. */
function StoryHeroSkeleton({ note }) {
  return (
    <Card
      bezel
      aria-busy="true"
      aria-label="Đang tải thông tin truyện"
      className="-mt-4"
      innerClassName="nh-grid-12 grid gap-y-8 p-5 sm:p-8 lg:p-10 nh-layout-lg-3-9"
    >
      <Skeleton className="mx-auto aspect-[2/3] w-full max-w-44 self-start rounded-2xl sm:max-w-56 lg:max-w-none [@media(max-height:500px)]:max-w-36" />
      <div aria-hidden="true" className="min-w-0 lg:pl-4">
        <span className="flex h-[1.08em] items-center text-display">
          <Skeleton className="h-[0.72em] w-3/4" />
        </span>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Skeleton className="size-9" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="mt-6 grid grid-cols-2 items-center gap-x-4 gap-y-3 border-y border-hairline py-4 sm:flex sm:flex-wrap sm:gap-x-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="col-span-2 h-6 w-32 max-sm:order-1" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        {/* 4 clamped lines + "Xem thêm" on phones, 5 at the desktop column width (line box = leading-7). */}
        <span className="mt-5 flex max-w-[68ch] flex-col gap-4 py-2">
          {Array.from({ length: 5 }, (_, line) => (
            <Skeleton
              key={line}
              className={`h-3 ${line === 4 ? 'w-2/5 max-lg:hidden' : line === 3 ? 'w-3/4 lg:w-full' : 'w-full'}`}
            />
          ))}
        </span>
        <Skeleton className="mt-2 h-4 w-16 lg:hidden" />
        <div className="mt-5 flex flex-wrap items-center gap-3 lg:mt-7">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-12 w-40" />
          <Skeleton className="size-12 rounded-2xl" />
          <Skeleton className="size-12 rounded-2xl" />
        </div>
        <p className="mt-3 min-h-5" />
        {note}
      </div>
    </Card>
  );
}

/* Author + community rating cards at their final heights. */
function StoryAsideSkeleton() {
  return (
    <aside aria-busy="true" aria-label="Đang tải tác giả và đánh giá" className="space-y-5">
      <Card as="div" aria-hidden="true">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <span className="mt-4 flex flex-col gap-3 py-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </span>
        <div className="mt-4 grid grid-cols-3 border-y border-hairline py-3">
          {[0, 1, 2].map((item) => (
            <span key={item} className="flex flex-col items-center gap-2 py-0.5">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3 w-14" />
            </span>
          ))}
        </div>
        <Skeleton className="mt-4 h-11 w-full" />
      </Card>
      <Card as="div" aria-hidden="true">
        <div className="flex h-9 items-center justify-between gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mt-5 flex gap-5">
          <div className="flex w-20 shrink-0 flex-col items-center gap-2">
            <Skeleton className="h-9 w-14 rounded-2xl" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex-1 space-y-2">
            {ratingBreakdown.map((value) => (
              <span key={value} className="flex h-4 items-center gap-2">
                <Skeleton className="h-2.5 w-6" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-2.5 w-8" />
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 border-t border-hairline pt-4">
          <Skeleton className="h-3 w-24" />
          <SkeletonText lines={3} className="mt-3" />
        </div>
      </Card>
    </aside>
  );
}
export function StoryDetailPage({ embedded = false }) {
  const { t } = useLocale();
  const { isAuthenticated } = useAuth();
  const { storyId = 'demo' } = useParams();
  const [tab, setTab] = useState('chapters');
  const [bookmarked, setBookmarked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [oldestFirst, setOldestFirst] = useState(true);
  const [notice, setNotice] = useState('');
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const story = useMockResource(`story:${storyId}`, storyDetail, { isEmpty: isMissing });
  const chapterFeed = useMockResource(`story:${storyId}:chapters`, chapterPreview);
  const storyLoading = story.status === 'loading';
  const storyReady = story.status === 'ready';
  const chapters = oldestFirst ? chapterFeed.data : [...chapterFeed.data].reverse();
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNotice('Đã sao chép liên kết truyện để chia sẻ.');
    } catch {
      setNotice('Không thể sao chép liên kết. Hãy sao chép địa chỉ trang trong trình duyệt.');
    }
  };
  const Root = embedded ? 'div' : 'main';
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public space-y-10 pb-20 pt-6 lg:space-y-12">
        <nav aria-label="Breadcrumb" className="text-xs text-muted">
          <Link to="/" className="inline-flex min-h-8 items-center hover:text-brand-strong">
            Trang chủ
          </Link>
          <span aria-hidden="true"> / </span>
          <Link
            to="/categories?genre=K%E1%BB%B3%20%E1%BA%A3o"
            className="inline-flex min-h-8 items-center hover:text-brand-strong"
          >
            Kỳ ảo
          </Link>
          <span aria-hidden="true"> / </span>
          {storyReady ? (
            <strong aria-current="page" className="font-semibold text-ink">
              {storyDetail.title}
            </strong>
          ) : (
            storyLoading && <Skeleton className="inline-block h-3 w-28 align-middle" />
          )}
        </nav>
        {storyLoading && (
          <StoryHeroSkeleton
            note={
              !isAuthenticated && (
                <div className="mt-3 rounded-2xl border border-brand/25 bg-brand-soft p-4 text-sm leading-6">
                  <strong className="font-semibold text-brand-strong">
                    {t('storyDetail.guestMode')}
                  </strong>{' '}
                  {t('storyDetail.guestModeDescription')}
                </div>
              )
            }
          />
        )}
        {story.status === 'error' && (
          <Card className="-mt-4 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được thông tin truyện"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
              action={<RetryButton onClick={story.retry} />}
            />
          </Card>
        )}
        {story.status === 'empty' && (
          <Card className="-mt-4 p-0">
            <EmptyState
              headingAs="h1"
              icon={Search}
              title="Không tìm thấy truyện"
              description="Truyện có thể đã bị gỡ hoặc đường dẫn không còn đúng. Hãy tìm một tác phẩm khác."
              action={
                <ButtonLink to="/search" size="sm" trailingIcon={ArrowRight}>
                  Tìm truyện
                </ButtonLink>
              }
            />
          </Card>
        )}
        {storyReady && (
          <Card
            bezel
            className="nh-fade-enter -mt-4"
            innerClassName="nh-grid-12 grid gap-y-8 p-5 sm:p-8 lg:p-10 nh-layout-lg-3-9"
          >
            <StoryCover
              story={coverStory}
              eager
              className="mx-auto aspect-[2/3] w-full max-w-44 self-start rounded-2xl border border-hairline shadow-soft sm:max-w-56 lg:max-w-none [@media(max-height:500px)]:max-w-36"
              badge={
                <span className="absolute left-3 top-3 rounded-full bg-surface/95 px-3 py-1 text-xs font-semibold text-brand-strong shadow-whisper">
                  {t('storyDetail.freePreview')}
                </span>
              }
            />
            <div className="min-w-0 lg:pl-4">
              <h1 className="text-display text-balance">{storyDetail.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                <span className="grid size-9 place-items-center rounded-full bg-brand/12 text-xs font-semibold text-brand-strong">
                  ML
                </span>
                <strong className="font-semibold">{storyDetail.author}</strong>
                <Badge tone="green">{t('storyDetail.verifiedAuthor')}</Badge>
                <span className="text-muted">
                  {storyDetail.followers} {t('storyDetail.followers')}
                </span>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-hairline py-4 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
                <div className="flex items-center gap-1.5">
                  <dt className="sr-only">Đánh giá</dt>
                  <Star size={15} className="fill-orange text-orange" aria-hidden="true" />
                  <dd className="font-semibold tabular-nums">
                    {storyDetail.rating}{' '}
                    <span className="font-normal text-muted">({storyDetail.ratings})</span>
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dd className="font-semibold tabular-nums">{storyDetail.reads}</dd>
                  <dt className="text-muted">{t('storyDetail.reads')}</dt>
                </div>
                <div className="flex gap-1.5">
                  <dd className="font-semibold tabular-nums">{storyDetail.chapters}</dd>
                  <dt className="text-muted">{t('storyDetail.chapters')}</dt>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 max-sm:order-1">
                  <dt className="text-muted">{t('storyDetail.status')}</dt>
                  <dd>
                    <Badge tone="purple">{storyDetail.status}</Badge>
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="sr-only">Ngôn ngữ</dt>
                  <dd className="text-muted">{storyDetail.language}</dd>
                </div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {storyDetail.genres.map((genre, index) => (
                  <Badge tone={genreTones[index] ?? 'green'} key={genre}>
                    {genre}
                  </Badge>
                ))}
              </div>
              <p
                id="story-synopsis"
                className={`mt-5 max-w-[68ch] text-base leading-7 text-muted lg:line-clamp-none ${synopsisOpen ? '' : 'line-clamp-4'}`}
              >
                {storyDetail.synopsis}
              </p>
              <button
                type="button"
                aria-expanded={synopsisOpen}
                aria-controls="story-synopsis"
                onClick={() => setSynopsisOpen((open) => !open)}
                className="-ml-2 mt-1 inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-brand-strong hover:bg-brand/8 lg:hidden"
              >
                {t(synopsisOpen ? 'storyDetail.synopsisLess' : 'storyDetail.synopsisMore')}
              </button>
              <div className="mt-5 flex flex-wrap items-center gap-3 lg:mt-7">
                <ButtonLink
                  to={
                    isAuthenticated
                      ? `/read/${storyId}/chapter-1`
                      : `/stories/${storyId}/preview/chapter-1`
                  }
                  size="lg"
                  trailingIcon={ArrowRight}
                >
                  <BookOpen size={18} aria-hidden="true" />
                  {t('storyDetail.readPreview')}
                </ButtonLink>
                <ButtonLink to={`/listen/${storyId}/chapter-1`} size="lg" variant="secondary">
                  <Headphones size={18} aria-hidden="true" />
                  {t('storyDetail.listenPreview')}
                </ButtonLink>
                <IconButton
                  label={t('storyDetail.bookmark')}
                  tone="purple"
                  size="lg"
                  aria-pressed={bookmarked}
                  onClick={() => setBookmarked(!bookmarked)}
                >
                  <Bookmark size={18} className={bookmarked ? 'fill-current' : ''} />
                </IconButton>
                <IconButton label={t('storyDetail.share')} size="lg" onClick={share}>
                  <Share2 size={18} />
                </IconButton>
              </div>
              <p role="status" className="mt-3 min-h-5 text-sm text-brand-strong">
                {notice}
              </p>
              {!isAuthenticated && (
                <div className="mt-3 rounded-2xl border border-brand/25 bg-brand-soft p-4 text-sm leading-6">
                  <strong className="font-semibold text-brand-strong">
                    {t('storyDetail.guestMode')}
                  </strong>{' '}
                  {t('storyDetail.guestModeDescription')}
                </div>
              )}
            </div>
          </Card>
        )}
        {(storyReady || storyLoading) && (
          <div className="nh-grid-12 grid gap-y-6 nh-layout-lg-8-4">
            <Card
              as="section"
              className="overflow-hidden p-0"
              aria-label={t('storyDetail.chapters')}
            >
              <div className="border-b border-hairline p-3 sm:p-4">
                <Tabs
                  label={storyDetail.title}
                  singleRow
                  value={tab}
                  onChange={setTab}
                  items={tabs.map(([value, labelKey]) => ({
                    value,
                    label: `${t(labelKey)}${value === 'chapters' && storyReady ? ` · ${storyDetail.chapters}` : ''}`,
                  }))}
                />
              </div>
              <div className="p-4 sm:p-6">
                {tab === 'chapters' && (
                  <>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                      <span>{t('storyDetail.displayingChapters', { count: 148 })}</span>
                      <button
                        type="button"
                        onClick={() => setOldestFirst((value) => !value)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 font-semibold text-brand-strong transition-colors duration-200 hover:bg-brand/8 pointer-coarse:min-h-11"
                      >
                        {t(oldestFirst ? 'storyDetail.oldestFirst' : 'storyDetail.newestFirst')}
                        <ChevronDown
                          size={15}
                          aria-hidden="true"
                          className={`transition-transform duration-200 ease-spring ${oldestFirst ? '' : 'rotate-180'}`}
                        />
                      </button>
                    </div>
                    {chapterFeed.status === 'loading' ? (
                      <div aria-busy="true" aria-label="Đang tải danh sách chương">
                        <ChapterListSkeleton count={chapterPreview.length} />
                      </div>
                    ) : chapterFeed.status === 'error' ? (
                      <EmptyState
                        tone="rose"
                        icon={AlertTriangle}
                        headingAs="h3"
                        title="Không tải được danh sách chương"
                        description="Hãy thử lại để xem các chương mới nhất."
                        action={<RetryButton onClick={chapterFeed.retry} />}
                        className="rounded-2xl border border-hairline"
                      />
                    ) : chapterFeed.status === 'empty' ? (
                      <EmptyState
                        icon={BookOpen}
                        headingAs="h3"
                        title="Truyện chưa có chương nào"
                        description="Lưu truyện vào thư viện để nhận thông báo khi tác giả phát hành chương đầu tiên."
                        action={
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-pressed={bookmarked}
                            onClick={() => setBookmarked(!bookmarked)}
                          >
                            <Bookmark
                              size={14}
                              aria-hidden="true"
                              className={bookmarked ? 'fill-current' : ''}
                            />
                            {bookmarked ? 'Đã lưu vào thư viện' : 'Lưu vào thư viện'}
                          </Button>
                        }
                        className="rounded-2xl border border-hairline"
                      />
                    ) : (
                      <div className="nh-fade-enter">
                        <ChapterList chapters={chapters} storyId={storyId} />
                      </div>
                    )}
                  </>
                )}
                {tab === 'synopsis' && (
                  <div className="rounded-2xl bg-reader p-6 text-base leading-8 text-ink/80">
                    {storyDetail.synopsis}
                  </div>
                )}
                {tab === 'reviews' && (
                  <figure className="rounded-2xl bg-reader p-6">
                    <blockquote className="text-base italic leading-8 text-ink/80">
                      {featuredReview}
                    </blockquote>
                    <figcaption className="mt-3 text-sm font-semibold">Kaelen_Reader</figcaption>
                  </figure>
                )}
                {tab === 'audiobooks' && (
                  <div className="flex flex-col items-start gap-4 rounded-2xl bg-reader p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{storyDetail.title}</p>
                      <p className="text-sm text-muted">{t('storyDetail.relatedAudiobooks')}</p>
                    </div>
                    <ButtonLink to={`/listen/${storyId}/chapter-1`} variant="accent" size="sm">
                      <Headphones size={14} aria-hidden="true" />
                      {t('storyDetail.listenPreview')}
                    </ButtonLink>
                  </div>
                )}
              </div>
              {!isAuthenticated && (
                <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline bg-elevated px-5 py-4 text-sm text-ink/70 sm:flex-row">
                  <span>{t('storyDetail.signInRemaining', { count: 143 })}</span>
                  <ButtonLink to="/register" trailingIcon={ArrowRight}>
                    {t('storyDetail.unlockFree')}
                  </ButtonLink>
                </div>
              )}
            </Card>
            {storyLoading ? (
              <StoryAsideSkeleton />
            ) : (
              <aside className="space-y-5">
                <Reveal>
                  <Card>
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand/12 font-semibold text-brand-strong">
                        ML
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold">Giới thiệu Mira Lane</h2>
                        <p className="text-xs text-muted">Tác giả kỳ ảo &amp; giả tưởng suy đoán</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted">
                      Người kể chuyện kiến tạo những thế giới phủ ánh hoàng hôn và tàn tích cổ xưa.
                      Chủ nhân Giải thưởng Hội Kỳ ảo NovelHub 2024.
                    </p>
                    <dl className="nh-grid-12 mt-4 grid nh-cols-3 border-y border-hairline py-3 text-center">
                      {[
                        ['4', 'storyDetail.works'],
                        ['15.2K', 'storyDetail.followers'],
                        ['3.4M', 'storyDetail.reads'],
                      ].map(([value, labelKey]) => (
                        <div key={labelKey} className="flex flex-col-reverse">
                          <dt className="text-xs text-muted">{t(labelKey)}</dt>
                          <dd className="font-semibold tabular-nums">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Button
                      type="button"
                      variant={following ? 'primary' : 'secondary'}
                      aria-pressed={following}
                      onClick={() => setFollowing(!following)}
                      className="mt-4 w-full"
                    >
                      {t(following ? 'storyDetail.following' : 'storyDetail.followAuthor')}
                    </Button>
                  </Card>
                </Reveal>
                <Reveal delay={80}>
                  <Card>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-semibold">
                        {t('storyDetail.communityRating')}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setTab('reviews')}
                        className="min-h-9 rounded-full px-3 text-xs font-semibold text-brand-strong hover:bg-brand/8 pointer-coarse:min-h-11"
                      >
                        {t('storyDetail.viewAll', { count: '1.2K' })}
                      </button>
                    </div>
                    <div className="mt-5 flex gap-5">
                      <div className="shrink-0 text-center">
                        <strong className="block text-4xl font-bold tabular-nums">4.8</strong>
                        <span
                          className="mt-1 flex justify-center gap-0.5 text-orange"
                          aria-label="4.8 / 5"
                        >
                          {[0, 1, 2, 3, 4].map((index) => (
                            <Star
                              key={index}
                              size={13}
                              className="fill-orange"
                              aria-hidden="true"
                            />
                          ))}
                        </span>
                        <small className="mt-1 block text-xs text-muted">
                          {t('storyDetail.ratings', { count: '12,450' })}
                        </small>
                      </div>
                      <div className="flex-1 space-y-2">
                        {ratingBreakdown.map((value, index) => (
                          <div
                            className="flex items-center gap-2 text-xs tabular-nums text-muted"
                            key={5 - index}
                          >
                            <span className="flex w-6 shrink-0 items-center gap-0.5">
                              {5 - index}
                              <Star
                                size={11}
                                className="fill-orange text-orange"
                                aria-hidden="true"
                              />
                            </span>
                            <ProgressBar
                              value={value}
                              size="sm"
                              label={`${5 - index} sao: ${value}%`}
                              className="flex-1"
                            />
                            <span className="w-8 shrink-0 text-right">{value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <figure className="mt-5 border-t border-hairline pt-4">
                      <figcaption className="text-xs font-semibold">Kaelen_Reader</figcaption>
                      <blockquote className="mt-2 text-sm italic leading-6 text-muted">
                        {featuredReview}
                      </blockquote>
                    </figure>
                  </Card>
                </Reveal>
              </aside>
            )}
          </div>
        )}
      </Root>
    </div>
  );
}
