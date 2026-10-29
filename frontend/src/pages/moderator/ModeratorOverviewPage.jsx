import { Link } from 'react-router'
import { ArrowRight, ClipboardCheck, Gavel, RotateCcw } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, ButtonLink, Card, Skeleton } from '../../components/ui'

const counts = [
  ['queue', 'reviewClaims.overview.queue'],
  ['mine', 'reviewClaims.overview.mine'],
  ['processing', 'reviewClaims.overview.processing'],
  ['decidedToday', 'reviewClaims.overview.decidedToday'],
]

export function ModeratorOverviewPage() {
  const { t, formatDate, formatNumber } = useLocale()
  const summary = useBackendDocument('/moderator/summary', null)
  const queue = useBackendDocument('/moderator/submissions?view=queue&page=1', null)
  const decisions = useBackendDocument('/moderator/decisions?outcome=all&scope=mine&page=1', null)
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="min-w-0">
          <h1 className="text-h2 sm:text-h1">{t('reviewClaims.overview.title')}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {t('reviewClaims.overview.description')}
          </p>
        </div>

        <section className="mt-6">
          {summary.status === 'loading' ? (
            <div aria-busy="true" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <p role="status" className="sr-only">
                {t('reviewClaims.loading')}
              </p>
              {counts.map(([key]) => (
                <Skeleton key={key} className="h-28 w-full rounded-3xl" />
              ))}
            </div>
          ) : summary.status !== 'ready' || !summary.data ? (
            <SectionError message={t('reviewClaims.error')} onRetry={summary.retry} />
          ) : (
            <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {counts.map(([key, label]) => (
                <Card key={key} as="div" className="flex flex-col p-4 sm:p-5">
                  <dt className="text-xs font-semibold uppercase leading-4 tracking-[.06em] text-muted">
                    {t(label)}
                  </dt>
                  <dd className="mt-auto pt-3 text-3xl font-bold tabular-nums tracking-tight">
                    {formatNumber(summary.data[key])}
                  </dd>
                </Card>
              ))}
            </dl>
          )}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-h3">
                <ClipboardCheck size={18} />
                {t('reviewClaims.overview.oldest')}
              </h2>
              <ButtonLink
                to={ROUTES.moderatorSubmissions}
                variant="secondary"
                size="sm"
                trailingIcon={ArrowRight}
              >
                {t('reviewClaims.overview.openQueue')}
              </ButtonLink>
            </div>
            {queue.status === 'loading' ? (
              <ListLoading label={t('reviewClaims.loading')} />
            ) : queue.status !== 'ready' || !queue.data ? (
              <SectionError message={t('reviewClaims.error')} onRetry={queue.retry} />
            ) : !queue.data.items.length ? (
              <p className="mt-4 text-sm text-muted">{t('reviewClaims.empty')}</p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline">
                {queue.data.items.slice(0, 5).map(item => (
                  <li key={item.id} className="py-3">
                    <Link
                      to={ROUTES.moderatorSubmission(item.id)}
                      className="break-words font-medium hover:text-brand-strong"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 break-words text-caption text-muted">
                      {item.storyTitle} · {formatDate(item.submittedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-h3">
                <Gavel size={18} />
                {t('reviewClaims.overview.recent')}
              </h2>
              <ButtonLink
                to={ROUTES.moderatorDecisions}
                variant="secondary"
                size="sm"
                trailingIcon={ArrowRight}
              >
                {t('reviewClaims.overview.openHistory')}
              </ButtonLink>
            </div>
            {decisions.status === 'loading' ? (
              <ListLoading label={t('reviewHistory.loading')} />
            ) : decisions.status !== 'ready' || !decisions.data ? (
              <SectionError message={t('reviewHistory.error')} onRetry={decisions.retry} />
            ) : !decisions.data.items.length ? (
              <p className="mt-4 text-sm text-muted">{t('reviewHistory.empty')}</p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline">
                {decisions.data.items.slice(0, 5).map(item => (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                    <span className="min-w-0 flex-1 break-words font-medium">{item.title}</span>
                    <Badge tone={item.outcome === 'approved' ? 'green' : 'red'}>
                      {t('reviewHistory.' + item.outcome)}
                    </Badge>
                    <span className="text-caption text-muted">{formatDate(item.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </ModeratorLayout>
  )
}

function ListLoading({ label }) {
  return (
    <div aria-busy="true" className="mt-4 space-y-3">
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-2xl" />
      ))}
    </div>
  )
}

function SectionError({ message, onRetry }) {
  const { t } = useLocale()
  return (
    <div className="mt-4">
      <p role="alert" className="text-sm text-rose-strong">
        {message}
      </p>
      <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
        <RotateCcw size={15} />
        {t('reviewClaims.reload')}
      </Button>
    </div>
  )
}
