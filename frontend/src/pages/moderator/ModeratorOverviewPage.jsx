import { Link } from 'react-router'
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Clock3,
  Gavel,
  RotateCcw,
} from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, ButtonLink, Card, EmptyState, Skeleton } from '../../components/ui'
import { formatDuration, vietnamToday } from './moderationFormat'

// Each counter opens its queue view (UC-MOD-08 step 6).
const counterLinks = () => {
  const today = vietnamToday()
  return [
    ['claimable', `${ROUTES.moderatorSubmissions}?view=available`],
    ['mine', `${ROUTES.moderatorSubmissions}?view=mine`],
    ['processing', `${ROUTES.moderatorSubmissions}?view=processing`],
    ['decidedToday', `${ROUTES.moderatorHistory}?scope=mine&from=${today}&to=${today}`],
    ['claimableReports', `${ROUTES.moderatorReports}?view=queue`],
  ]
}
const outcomeTone = { approved: 'green', rejected: 'red' }

export function ModeratorOverviewPage() {
  const { t, formatDateTime } = useLocale()
  const overview = useBackendDocument('/moderator/overview', null)
  const data = overview.status === 'ready' ? overview.data : null
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t('moderationOverview.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {t('moderationOverview.description')}
            </p>
            {data && (
              <p className="mt-1 text-caption text-muted">
                {t('moderationOverview.computedAt', { time: formatDateTime(data.computedAt) })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={ROUTES.moderatorStatistics} variant="secondary" size="sm">
              <BarChart3 size={15} />
              {t('moderationOverview.openStatistics')}
            </ButtonLink>
            <Button variant="secondary" size="sm" onClick={overview.retry}>
              <RotateCcw size={15} />
              {t('moderationOverview.reload')}
            </Button>
          </div>
        </div>

        {overview.status === 'loading' ? (
          <div aria-busy="true" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <p role="status" className="sr-only">
              {t('moderationOverview.loading')}
            </p>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-3xl" />
            ))}
          </div>
        ) : !data ? (
          // EX1: no partial counters when the overview cannot be computed.
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={RotateCcw}
              title={t('moderationOverview.error')}
              action={
                <Button variant="secondary" onClick={overview.retry}>
                  {t('moderationOverview.reload')}
                </Button>
              }
            />
          </Card>
        ) : (
          <OverviewContent data={data} />
        )}
      </div>
    </ModeratorLayout>
  )
}

function OverviewContent({ data }) {
  const { t, formatNumber, formatDateTime } = useLocale()
  return (
    <>
      <ul
        aria-label={t('moderationOverview.counters.label')}
        className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        {counterLinks().map(([key, to]) => (
          <li key={key}>
            <Link
              to={to}
              className="block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Card as="div" interactive className="flex h-full flex-col p-4 sm:p-5">
                <span className="text-xs font-semibold uppercase leading-4 tracking-[.06em] text-muted">
                  {t(`moderationOverview.counters.${key}`)}
                </span>
                <span
                  data-counter={key}
                  className="mt-auto pt-3 text-3xl font-bold tabular-nums tracking-tight"
                >
                  {formatNumber(data.counters[key])}
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeading icon={ClipboardCheck} title={t('moderationOverview.nextItems')}>
            <ButtonLink
              to={ROUTES.moderatorSubmissions}
              variant="secondary"
              size="sm"
              trailingIcon={ArrowRight}
            >
              {t('moderationOverview.openQueue')}
            </ButtonLink>
          </SectionHeading>
          <p className="mt-2 text-caption text-muted">{t('moderationOverview.nextItemsHint')}</p>
          <QueueList items={data.nextItems} />
        </Card>

        <Card>
          <SectionHeading icon={Clock3} title={t('moderationOverview.oldest')} />
          <QueueList items={data.oldestWaiting} />
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeading icon={Gavel} title={t('moderationOverview.recent')}>
            <ButtonLink
              to={ROUTES.moderatorHistory}
              variant="secondary"
              size="sm"
              trailingIcon={ArrowRight}
            >
              {t('moderationOverview.openHistory')}
            </ButtonLink>
          </SectionHeading>
          {!data.recentDecisions.length ? (
            <p className="mt-4 text-sm text-muted">{t('moderationOverview.empty')}</p>
          ) : (
            <ul className="mt-4 divide-y divide-hairline">
              {data.recentDecisions.map(item => (
                <li
                  key={item.historyId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                >
                  <span className="min-w-0 flex-1 break-words font-medium">{item.targetTitle}</span>
                  <Badge tone={outcomeTone[item.outcome] ?? 'neutral'}>
                    {t(`moderationFormat.outcomes.${item.outcome}`)}
                  </Badge>
                  <span className="text-caption text-muted">{formatDateTime(item.occurredAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function SectionHeading({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-h3">
        <Icon size={18} />
        {title}
      </h2>
      {children}
    </div>
  )
}

function QueueList({ items }) {
  const { t, formatDateTime } = useLocale()
  if (!items.length)
    return <p className="mt-4 text-sm text-muted">{t('moderationOverview.empty')}</p>
  return (
    <ul className="mt-4 divide-y divide-hairline">
      {items.map(item => (
        <li key={item.submissionId} className="py-3">
          <Link
            to={ROUTES.moderatorSubmission(item.submissionId)}
            className="break-words font-medium hover:text-brand-strong"
          >
            {item.title}
          </Link>
          <p className="mt-1 break-words text-caption text-muted">
            {[
              t(`moderationFormat.targetTypes.${item.targetType}`),
              item.storyTitle && t('moderationOverview.storyOf', { title: item.storyTitle }),
              item.author.displayName,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="orange">
              {t('moderationOverview.waiting', {
                age: formatDuration(t, item.waitingSeconds),
              })}
            </Badge>
            <Badge tone={item.claimState === 'mine' ? 'green' : 'neutral'}>
              {t(`moderationOverview.claimStates.${item.claimState}`, {
                time: item.claimExpiresAt ? formatDateTime(item.claimExpiresAt) : '',
              })}
            </Badge>
            <Badge tone={item.evidenceStatus === 'failed' ? 'red' : 'neutral'}>
              {t(`moderationFormat.evidence.${item.evidenceStatus}`)}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  )
}
