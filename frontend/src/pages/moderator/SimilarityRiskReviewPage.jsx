import { useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, RotateCcw, Sparkles } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, ButtonLink, Card, Skeleton } from '../../components/ui'
import { similarityEmptyState } from './similarityState'

/** Read-only view of one submission's stored similarity findings; never writes or calls a provider. */
export function SimilarityRiskReviewPage() {
  const { reviewId } = useParams()
  const { t } = useLocale()
  const resource = useBackendDocument('/moderator/submissions/' + reviewId, null)
  const data = resource.status === 'ready' ? resource.data : null
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t('manualReview.similarity.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {t('manualReview.similarity.description')}
            </p>
            {data && <p className="mt-2 break-words font-semibold">{data.title}</p>}
          </div>
          <ButtonLink to={ROUTES.moderatorSubmission(reviewId)} variant="secondary">
            <ArrowLeft size={15} />
            {t('manualReview.similarity.back')}
          </ButtonLink>
        </div>
        {resource.status === 'loading' ? (
          <div aria-busy="true" className="mt-6 space-y-4">
            <p role="status" className="text-sm text-muted">
              {t('manualReview.loading')}
            </p>
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        ) : !data ? (
          <Card className="mt-6">
            <p role="alert" className="text-sm text-rose-strong">
              {t('manualReview.error')}
            </p>
            <Button className="mt-3" variant="secondary" onClick={resource.retry}>
              <RotateCcw size={15} />
              {t('manualReview.reload')}
            </Button>
          </Card>
        ) : !data.revision ? (
          <Card className="mt-6">
            <p className="text-sm leading-6 text-muted">{t('manualReview.claimToView')}</p>
          </Card>
        ) : (
          <SimilarityFindings submission={data.submission} evidence={data.evidence} />
        )}
      </div>
    </ModeratorLayout>
  )
}

function SimilarityFindings({ submission, evidence }) {
  const { t } = useLocale()
  if (!evidence)
    return (
      <Card className="mt-6">
        <p className="text-sm text-muted">{t('manualReview.evidence.none')}</p>
      </Card>
    )
  const assessments = new Map(
    (evidence.llmReview?.findingAssessments ?? []).map(item => [item.findingId, item.assessment]),
  )
  const findings = [...evidence.findings].sort((a, b) => b.score - a.score)
  return (
    <div className="mt-6 space-y-4">
      {evidence.batch.status === 'failed' && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-rose/12 p-3 text-sm text-rose-strong"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {t('manualReview.evidence.failed', {
            stage: t('manualReview.evidence.stages.' + evidence.batch.failedStage),
          })}
        </p>
      )}
      {!findings.length ? (
        <Card>
          <p className="text-sm text-muted">{t(similarityEmptyState(submission, evidence))}</p>
        </Card>
      ) : (
        <>
          {evidence.findingsTruncated && (
            <p className="text-sm text-muted">
              {t('manualReview.evidence.findingsShown', {
                shown: evidence.findings.length,
                total: evidence.findingsCount,
              })}
            </p>
          )}
          {findings.map(finding => (
            <Card key={finding.id} as="article" className="p-5">
              <Badge tone="orange">
                {t('manualReview.similarity.score', { score: Math.round(finding.score * 100) })}
              </Badge>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">
                    {t('manualReview.similarity.queryPassage')}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-elevated p-3 text-sm leading-6">
                    {finding.queryText}
                  </p>
                </div>
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold">
                    {t('manualReview.similarity.sourcePassage', {
                      story: finding.sourceStoryTitle,
                      chapter: finding.sourceChapterTitle,
                    })}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-2xl bg-elevated p-3 text-sm leading-6">
                    {finding.sourceText}
                  </p>
                </div>
              </div>
              {assessments.has(finding.id) && (
                <div className="mt-4 rounded-2xl border border-purple/30 bg-purple/5 p-3">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={15} className="text-purple-strong" />
                    {t('manualReview.similarity.assessment')}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                    {assessments.get(finding.id)}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  )
}
