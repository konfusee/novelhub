import { Link } from 'react-router'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Headphones,
  Leaf,
  RefreshCw,
} from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { StoryCard, StoryCardSkeleton } from '../../components/public/StoryCard'
import { SectionTitle } from '../../components/public/SectionTitle'
import { useCatalogCategories, useCatalogStories } from '../../components/public/catalog'
import { Button, ButtonLink, Card, EmptyState, Reveal, Skeleton } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

const stagger = index => Math.min(index, 5) * 80
const SHELF_SIZE = 6

/*
 * The page root is one 12-column grid. Every band spans all 12 columns and re-exposes them
 * as a subgrid, so cards in every section snap to the same column lines and gutters.
 */
const band = 'col-span-12 grid grid-cols-subgrid'

/* Error / empty panel for one home data band; spans the full 12-column band. */
function BandState({ resource, errorTitle, emptyTitle, emptyDescription, emptyAction }) {
  const { t } = useLocale()
  return (
    <Card className="col-span-12 p-0">
      {resource.status === 'error' ? (
        <EmptyState
          tone="rose"
          headingAs="h3"
          icon={AlertTriangle}
          title={errorTitle}
          description={resource.error?.message}
          action={
            <Button variant="secondary" size="sm" onClick={resource.retry}>
              <RefreshCw size={14} aria-hidden="true" />
              {t('search.retry')}
            </Button>
          }
        />
      ) : (
        <EmptyState
          headingAs="h3"
          icon={BookOpen}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      )}
    </Card>
  )
}

function Hero() {
  const { t } = useLocale()
  return (
    <section aria-labelledby="home-hero-title" className={`nh-bezel ${band}`}>
      <div className={`nh-bezel-core ${band} overflow-hidden`}>
        <div className="col-span-12 flex flex-col justify-center px-6 pb-10 pt-8 sm:px-10 sm:pt-12 lg:px-12 lg:py-16">
          <p className="nh-eyebrow w-fit">{t('home.eyebrow')}</p>
          <h1 id="home-hero-title" className="mt-5 break-words text-display text-balance">
            {t('home.heroLineOne')} <span className="text-brand">{t('home.heroHighlight')}</span>{' '}
            {t('home.heroLineTwo')}
          </h1>
          <p className="mt-5 max-w-[46ch] text-base leading-7 text-muted">
            {t('home.heroDescription')}
          </p>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <ButtonLink to="/search" size="lg" trailingIcon={ArrowRight}>
              {t('home.exploreStories')}
            </ButtonLink>
            <ButtonLink to="/rankings" size="lg" variant="secondary">
              {t('home.viewRankings')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}

/** One shelf of published stories ordered by `sort`, linking to the full ranking. */
function Shelf({ sort, title, to }) {
  const { t } = useLocale()
  const resource = useCatalogStories({ sort, pageSize: SHELF_SIZE })
  return (
    <section className={band}>
      <div className="col-span-12">
        <SectionTitle to={to}>{title}</SectionTitle>
      </div>
      {resource.status === 'loading' ? (
        <div aria-busy="true" aria-label={title} className={`${band} gap-y-8`}>
          {Array.from({ length: SHELF_SIZE }, (_, index) => (
            <div key={index} className="col-span-6 @2xl:col-span-4 @5xl:col-span-2">
              <StoryCardSkeleton />
            </div>
          ))}
        </div>
      ) : resource.status !== 'ready' ? (
        <BandState
          resource={resource}
          errorTitle={t('home.shelfFailed')}
          emptyTitle={t('home.shelfEmpty')}
          emptyDescription={t('home.shelfEmptyDescription')}
          emptyAction={
            <ButtonLink to="/categories" size="sm" trailingIcon={ArrowRight}>
              {t('home.browseCategory')}
            </ButtonLink>
          }
        />
      ) : (
        <div className={`${band} gap-y-8`}>
          {resource.data.items.map((story, index) => (
            <Reveal
              key={story.id}
              delay={stagger(index)}
              className="col-span-6 @2xl:col-span-4 @5xl:col-span-2"
            >
              <StoryCard story={story} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}

function Categories() {
  const { t } = useLocale()
  const resource = useCatalogCategories()
  return (
    <section className={band}>
      <div className="col-span-12">
        <SectionTitle to="/categories">{t('home.browseCategory')}</SectionTitle>
      </div>
      {resource.status === 'loading' ? (
        <div aria-busy="true" aria-label={t('home.browseCategory')} className={`${band} gap-y-4`}>
          {[0, 1, 2, 3].map(index => (
            <Skeleton key={index} className="col-span-6 h-20 rounded-3xl @4xl:col-span-3" />
          ))}
        </div>
      ) : resource.status !== 'ready' ? (
        <BandState
          resource={resource}
          errorTitle={t('search.categoriesFailed')}
          emptyTitle={t('search.noCategories')}
          emptyDescription={t('search.noCategoriesDescription')}
        />
      ) : (
        <ul className={`${band} gap-y-4`}>
          {resource.data.map((category, index) => (
            <Reveal
              as="li"
              key={category.id}
              delay={stagger(index)}
              className="col-span-6 @4xl:col-span-3"
            >
              <Link
                to={`/categories?category=${encodeURIComponent(category.id)}`}
                className="group flex h-full items-center justify-between gap-3 rounded-3xl border border-line bg-surface p-5 shadow-whisper transition-[transform,border-color,box-shadow] duration-[420ms] ease-spring hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-lift"
              >
                <strong className="min-w-0 truncate font-semibold group-hover:text-brand-strong">
                  {category.name}
                </strong>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {t('search.storyCount', { count: category.storyCount })}
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      )}
    </section>
  )
}

function JoinCta() {
  const { t } = useLocale()
  return (
    <Reveal className={band}>
      <Card
        as="section"
        bezel
        className={band}
        innerClassName={`nh-join-motif ${band} overflow-hidden p-0`}
      >
        <div className="relative col-span-12 p-7 sm:p-10 @4xl:col-span-8 lg:p-12">
          <h2 className="text-h2 text-rose-strong">{t('home.joinTitle')}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted">{t('home.joinDescription')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/register" trailingIcon={ArrowRight}>
              {t('home.createAccount')}
            </ButtonLink>
            <ButtonLink to="/join" variant="secondary">
              {t('home.learnMore')}
            </ButtonLink>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="relative col-span-4 m-2 hidden place-items-center rounded-[calc(var(--radius-bezel)-var(--bezel-gap)-0.5rem)] bg-brand-soft @4xl:grid"
        >
          <div className="flex items-end gap-4 text-brand-strong">
            <BookOpen size={64} />
            <Headphones size={44} className="text-orange-strong" />
            <Leaf size={48} />
          </div>
        </div>
      </Card>
    </Reveal>
  )
}

export function GuestHomePage({ embedded = false }) {
  const { t } = useLocale()
  const Root = embedded ? 'div' : 'main'
  return (
    <div className="@container min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <Root className="page-public grid grid-cols-12 gap-x-4 gap-y-14 pb-20 pt-4 sm:pt-6 md:gap-y-16 lg:gap-x-6 lg:gap-y-20">
        <Hero />
        <Shelf sort="popular" title={t('home.popular')} to="/rankings" />
        <Categories />
        <Shelf sort="newest" title={t('home.newest')} to="/rankings?sort=newest" />
        <Shelf sort="rating" title={t('home.topRated')} to="/rankings?sort=rating" />
        {!embedded && <JoinCta />}
      </Root>
    </div>
  )
}
