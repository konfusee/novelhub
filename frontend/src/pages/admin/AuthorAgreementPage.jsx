import { useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, RotateCcw } from '../../components/icons';
import { AdminLayout } from '../../layouts';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
} from '../../components/ui';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

export function AuthorAgreementPage() {
  const { userId } = useParams();
  const { t, formatDate, formatNumber } = useLocale();
  const resource = useBackendDocument(`/admin/authors/${userId}/agreement`, null);
  const current = resource.status === 'ready' ? resource.data : null;
  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl px-5 py-6">
        <ButtonLink to="/admin/users" variant="ghost" size="sm" className="-ml-3">
          <ArrowLeft size={16} />
          {t('agreement.back')}
        </ButtonLink>
        <p className="mt-4 text-caption text-ink/70">{t('agreement.breadcrumb')}</p>
        <h1 className="mt-1 text-h2 sm:text-h1">
          {current ? `${current.author.name} · ` : ''}
          {t('agreement.title')}
        </h1>
        {resource.status === 'loading' ? (
          <Card className="mt-6" aria-busy="true">
            <span className="sr-only">{t('agreement.loading')}</span>
            <Skeleton className="h-6 w-48" />
            <div className="nh-grid-12 mt-5 grid gap-5 nh-sm-cols-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
            <Skeleton className="mt-5 h-3 w-full" />
          </Card>
        ) : !current ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={AlertTriangle}
              tone="rose"
              title={t(resource.status === 'empty' ? 'agreement.missing' : 'agreement.error')}
              description={t('agreement.noFallback')}
              action={
                <Button variant="secondary" size="sm" onClick={resource.retry}>
                  <RotateCcw size={15} />
                  {t('agreement.retry')}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-ink/70">
              <Badge tone="green">{t(`agreement.source.${current.source}`)}</Badge>
              <span>
                #{current.author.id}
                {current.effectiveAt ? ` · ${formatDate(current.effectiveAt)}` : ''}
              </span>
            </p>
            <Card className="mt-6">
              <h2 className="text-h3">{t('agreement.split')}</h2>
              <p className="mt-1 text-caption text-muted">{t('agreement.readOnly')}</p>
              <div className="nh-grid-12 mt-5 grid gap-5 nh-sm-cols-2">
                {['author', 'platform'].map((part) => (
                  <div key={part}>
                    <p id={`share-${part}`} className="text-sm font-semibold">
                      {t(`agreement.${part}`)}
                    </p>
                    <output
                      aria-labelledby={`share-${part}`}
                      className="mt-2 flex min-h-11 items-center rounded-full border border-hairline bg-elevated px-4 text-sm text-ink/80"
                    >
                      {formatNumber(current[`${part}Share`])}%
                    </output>
                  </div>
                ))}
              </div>
              <ProgressBar
                value={current.authorShare}
                size="lg"
                label={t('agreement.author')}
                className="mt-5"
              />
              <p className="mt-4 text-caption text-ink/70">{t('agreement.total')}</p>
              <Button variant="secondary" className="mt-5" onClick={resource.retry}>
                <RotateCcw size={16} />
                {t('agreement.reload')}
              </Button>
            </Card>
            <Card className="mt-6">
              <h2 className="text-h3">{t('agreement.history')}</h2>
              <p className="mt-1 text-caption text-muted">{t('agreement.historyHint')}</p>
              {current.history.length ? (
                <ul className="mt-4 divide-y divide-hairline">
                  {current.history.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                    >
                      <span>
                        {formatDate(item.effectiveAt)} · {formatNumber(item.percentage)}%
                      </span>
                      <Badge tone={item.scheduled ? 'neutral' : 'green'}>
                        {t(item.scheduled ? 'agreement.scheduled' : 'agreement.recorded')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted">{t('agreement.noHistory')}</p>
              )}
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
