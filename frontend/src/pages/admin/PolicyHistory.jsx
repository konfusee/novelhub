import { useState } from 'react';
import { Badge, Button, Skeleton } from '../../components/ui';
import { useBackendDocument } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';

export function PolicyHistory() {
  const { t, formatNumber, formatDate } = useLocale();
  const [page, setPage] = useState(1);
  const resource = useBackendDocument(`/admin/policy/history?page=${page}&pageSize=5`, null);
  const document =
    resource.status === 'ready' && Array.isArray(resource.data?.items) ? resource.data : null;
  return (
    <section className="mt-6 border-t border-hairline pt-5" aria-label={t('policyHistory.title')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('policyHistory.title')}</h3>
          <p className="mt-1 text-caption text-muted">{t('policyHistory.description')}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={resource.status === 'loading'}
          onClick={resource.retry}
        >
          {t('policyHistory.reload')}
        </Button>
      </div>
      {resource.status === 'loading' ? (
        <div className="mt-4" role="status">
          <span className="sr-only">{t('policyHistory.loading')}</span>
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !document ? (
        <p role="alert" className="mt-4 text-caption text-rose-strong">
          {t('policyHistory.error')}
        </p>
      ) : (
        <>
          {!document.items.length ? (
            <p role="status" className="mt-4 text-caption text-muted">
              {t(document.total ? 'policyHistory.emptyPage' : 'policyHistory.empty')}
            </p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {document.items.map((item) => (
                <li key={item.id} className="min-w-0 rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-caption font-semibold">
                      {item.effectiveAt ? formatDate(item.effectiveAt) : t('policyHistory.noDate')}
                    </p>
                    <Badge tone={item.current ? 'green' : undefined}>
                      {t(
                        `policyHistory.${item.current ? 'current' : item.future ? 'future' : item.status === 'draft' ? 'draft' : item.status === 'superseded' ? 'superseded' : 'earlier'}`,
                      )}
                    </Badge>
                  </div>
                  <p className="mt-2 break-all text-xs text-muted">
                    {t('policyHistory.identity', { id: item.id })}
                  </p>
                  <dl className="nh-grid-12 mt-3 grid gap-3 text-caption nh-sm-cols-2">
                    <div>
                      <dt className="text-muted">{t('policyHistory.price')}</dt>
                      <dd>
                        {t('policyHistory.coinRange', {
                          min: formatNumber(item.priceMinCoins),
                          max: formatNumber(item.priceMaxCoins),
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t('policyHistory.duration')}</dt>
                      <dd>
                        {t('policyHistory.dayRange', {
                          min: formatNumber(item.durationMinDays),
                          max: formatNumber(item.durationMaxDays),
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t('policyHistory.share')}</dt>
                      <dd>
                        {t('policyHistory.percentages', {
                          author: formatNumber(item.authorSharePercent),
                          platform: formatNumber(item.platformSharePercent),
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">{t('policy.withdrawalThresholdCoins')}</dt>
                      <dd>{formatNumber(item.withdrawalThresholdCoins)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 whitespace-pre-wrap break-words text-caption text-muted">
                    {item.reason || t('policyHistory.noReason')}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {document.total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-caption text-muted">
                {t('policyHistory.page', {
                  page: document.page,
                  pages: document.totalPages,
                  total: formatNumber(document.total),
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  {t('policyHistory.previous')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= document.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  {t('policyHistory.next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
