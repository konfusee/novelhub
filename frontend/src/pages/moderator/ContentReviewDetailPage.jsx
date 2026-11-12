import { useId, useState } from 'react'
import { useLocation, useParams } from 'react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSearch,
  Gavel,
  RotateCcw,
  Sparkles,
  UserPlus,
} from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { apiRequest } from '../../api/client'
import { moderatorMediaUrl } from '../../api/media'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, ButtonLink, Card, Modal, Skeleton } from '../../components/ui'
import { DraftReadingCanvas } from '../author/DraftReadingCanvas'
import { moderationErrorKey } from './moderationMessages'
import { similarityEmptyState } from './similarityState'

const historyActionKeys = {
  submitted: 'manualReview.actions.submitted',
  'manual-review.decided': 'manualReview.actions.decided',
  'revision-created': 'manualReview.actions.revisionCreated',
  'submission.cancelled': 'manualReview.actions.cancelled',
}
const historyOutcomeKeys = {
  validated: 'manualReview.statuses.validated',
  draft: 'manualReview.statuses.editable',
  approved: 'manualReview.statuses.approved',
  rejected: 'manualReview.statuses.rejected',
  cancelled: 'manualReview.statuses.cancelled',
}
const decisionKeys = { approve: 'manualReview.approve', reject: 'manualReview.reject' }
const decisionMessages = {
  'SYS-MSG-PUB-07': 'manualReview.approvedNotice',
  'SYS-MSG-PUB-08': 'manualReview.rejectedNotice',
}

export function ContentReviewDetailPage() {
  const { submissionId } = useParams()
  const location = useLocation()
  const { t, formatDateTime } = useLocale()
  const fieldId = useId()
  const resource = useBackendDocument('/moderator/submissions/' + submissionId, null)
  const [notice, setNotice] = useState(() => location.state?.notice ?? '')
  const [claimBusy, setClaimBusy] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [decision, setDecision] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const data = resource.status === 'ready' ? resource.data : null

  const claim = async () => {
    if (!data || claimBusy) return
    setClaimBusy(true)
    setClaimError('')
    setNotice('')
    try {
      const claimed = await apiRequest('/moderator/submissions/' + data.submission.id + '/claim', {
        method: 'POST',
        body: { expectedVersion: data.submission.version },
      })
      setNotice(
        t('reviewClaims.claimed', {
          dateTime: formatDateTime(claimed.submission.claimExpiresAt),
          timeZone: t('reviewClaims.timeZone'),
        }),
      )
      resource.retry()
    } catch (failure) {
      setClaimError(moderationErrorKey(failure.code))
      if (failure.status === 409) resource.retry()
    } finally {
      setClaimBusy(false)
    }
  }
  const release = async () => {
    if (!data || claimBusy) return
    setClaimBusy(true)
    setClaimError('')
    setNotice('')
    try {
      await apiRequest('/moderator/submissions/' + data.submission.id + '/release', {
        method: 'POST',
        body: {
          expectedVersion: data.submission.version,
          claimToken: data.submission.claimToken,
        },
      })
      setNotice(t('reviewClaims.released'))
      resource.retry()
    } catch (failure) {
      setClaimError(moderationErrorKey(failure.code))
      if (failure.status === 409) resource.retry()
    } finally {
      setClaimBusy(false)
    }
  }
  const openDecision = value => {
    setDecision(value)
    setFeedback('')
    setError('')
  }
  const closeDecision = () => {
    if (saving) return
    setDecision(null)
    setError('')
  }
  const confirmDecision = async event => {
    event.preventDefault()
    const trimmed = feedback.trim()
    if (!data?.evidence || saving || (decision === 'reject' && !trimmed)) return
    const { submission, revision, evidence } = data
    setSaving(true)
    setError('')
    try {
      const result = await apiRequest('/moderator/submissions/' + submission.id + '/decision', {
        method: 'POST',
        body: {
          outcome: decision,
          feedback: trimmed,
          expectedVersion: submission.version,
          revisionId: revision.id,
          revisionVersion: revision.version,
          evidenceBatchId: evidence.batch.id,
          evidenceVersion: evidence.batch.version,
          claimToken: submission.claimToken,
        },
      })
      setDecision(null)
      setFeedback('')
      setNotice(t(decisionMessages[result.messageId] ?? 'manualReview.approvedNotice'))
      resource.retry()
    } catch (failure) {
      setError(t(moderationErrorKey(failure.code)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <ButtonLink to={ROUTES.moderatorSubmissions} variant="ghost" size="sm">
          <ArrowLeft size={15} />
          {t('manualReview.back')}
        </ButtonLink>
        {notice && (
          <p role="status" className="mt-4 text-sm text-brand-strong">
            {notice}
          </p>
        )}
        {resource.status === 'loading' ? (
          <div aria-busy="true" className="mt-6 space-y-4">
            <p role="status" className="text-sm text-muted">
              {t('manualReview.loading')}
            </p>
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        ) : !data ? (
          <Card className="mt-6">
            <p role="alert" className="text-sm text-rose-strong">
              {t(resource.status === 'empty' ? 'manualReview.notFound' : 'manualReview.error')}
            </p>
            <Button className="mt-3" variant="secondary" onClick={resource.retry}>
              <RotateCcw size={15} />
              {t('manualReview.reload')}
            </Button>
          </Card>
        ) : (
          <ReviewContent
            data={data}
            claimBusy={claimBusy}
            claimError={claimError}
            onClaim={claim}
            onRelease={release}
            onDecide={openDecision}
          />
        )}
      </div>

      <Modal
        open={Boolean(decision)}
        title={t('manualReview.confirmTitle')}
        onClose={closeDecision}
      >
        {decision && (
          <form onSubmit={confirmDecision}>
            <p className="font-semibold">{t(decisionKeys[decision])}</p>
            <label htmlFor={`${fieldId}-feedback`} className="mb-2 mt-4 block text-sm font-medium">
              {t('manualReview.reason')}
            </label>
            <textarea
              id={`${fieldId}-feedback`}
              value={feedback}
              maxLength={4000}
              disabled={saving}
              onChange={event => setFeedback(event.target.value)}
              className="min-h-32 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink"
            />
            <p className="mt-2 text-caption text-muted">{t('manualReview.feedbackHint')}</p>
            <p className="mt-3 text-sm leading-6">{t('manualReview.decisionNote')}</p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-strong">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={saving} onClick={closeDecision}>
                {t('manualReview.close')}
              </Button>
              <Button
                type="submit"
                disabled={saving || (decision === 'reject' && !feedback.trim())}
              >
                {t(saving ? 'manualReview.saving' : 'manualReview.confirm')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </ModeratorLayout>
  )
}

function ReviewContent({ data, claimBusy, claimError, onClaim, onRelease, onDecide }) {
  const { t, formatDateTime } = useLocale()
  const { submission, author, revision, rights, actions } = data
  // The package, rights and evidence are present only while the account holds the live claim.
  const packageOpen = Boolean(revision)
  return (
    <>
      <header className="mt-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="purple">{t('manualReview.statuses.' + submission.status)}</Badge>
          <Badge>{t('reviewClaims.targetTypes.' + submission.type)}</Badge>
          {packageOpen && (
            <span className="text-sm text-muted">
              {t('manualReview.revision', { number: revision.number })}
            </span>
          )}
        </div>
        <h1 className="mt-2 break-words text-h2 sm:text-h1">{data.title}</h1>
        {submission.type === 'chapter' && (
          <p className="mt-1 break-words text-sm text-muted">{data.story.title}</p>
        )}
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('manualReview.author')}</dt>
            <dd className="font-medium">{author.displayName}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('manualReview.submittedAt')}</dt>
            <dd className="font-medium">{formatDateTime(submission.submittedAt)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('manualReview.evidenceState')}</dt>
            <dd className="font-medium">
              {t('reviewClaims.evidenceStates.' + data.evidenceStatus)}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="text-muted">{t('manualReview.claimState')}</dt>
            <dd className="font-medium">
              {t('reviewClaims.claimStates.' + submission.claimState, {
                dateTime: submission.claimExpiresAt
                  ? formatDateTime(submission.claimExpiresAt)
                  : '',
              })}
            </dd>
          </div>
        </dl>
        {submission.decisionSummary && (
          <p className="mt-3 whitespace-pre-wrap break-words text-sm">
            <span className="text-muted">{t('manualReview.feedback')} </span>
            {submission.decisionSummary}
          </p>
        )}
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {!packageOpen ? (
            <Card>
              <p className="text-sm leading-6 text-muted">
                {t(
                  submission.claimResumeRequired
                    ? 'reviewClaims.resumeNote'
                    : submission.status === 'validated'
                      ? 'manualReview.evidencePending'
                      : 'manualReview.claimToView',
                )}
              </p>
            </Card>
          ) : (
            <>
              <EvidenceCard submission={submission} evidence={data.evidence} />
              {data.chapter ? (
                <DraftReadingCanvas
                  document={data.chapter.document}
                  storyTitle={data.story.title}
                  mediaUrl={mediaId => moderatorMediaUrl(submission.id, mediaId)}
                  headingLevel={2}
                />
              ) : (
                <StoryMetadata metadata={data.metadata} />
              )}
              <HistoryCard history={data.history} />
            </>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            {submission.status === 'validated' && packageOpen && (
              <p className="text-sm leading-6 text-muted">{t('manualReview.evidencePending')}</p>
            )}
            {submission.claimState === 'other' && (
              <p className="text-sm leading-6 text-orange-strong">{t('reviewClaims.claimHeld')}</p>
            )}
            {!author.active && (
              <p className="text-sm leading-6 text-orange-strong">
                {t('manualReview.authorUnavailable')}
              </p>
            )}
            {claimError && (
              <p role="alert" className="mt-2 text-sm text-rose-strong">
                {t(claimError)}
              </p>
            )}
            <div className="mt-3 grid gap-2">
              {actions.canClaim && (
                <Button disabled={claimBusy} onClick={onClaim}>
                  <UserPlus size={15} />
                  {t('reviewClaims.acquire')}
                </Button>
              )}
              {/* A live claim from before claim tokens is resumed through the claim mutation;
                  release and decision appear once the refreshed detail carries the token. */}
              {submission.claimResumeRequired && (
                <Button disabled={claimBusy} onClick={onClaim}>
                  <UserPlus size={15} />
                  {t('reviewClaims.resume')}
                </Button>
              )}
              {actions.canDecide && (
                <>
                  <Button onClick={() => onDecide('approve')}>
                    <CheckCircle2 size={15} />
                    {t('manualReview.approve')}
                  </Button>
                  <Button variant="danger" onClick={() => onDecide('reject')}>
                    <Gavel size={15} />
                    {t('manualReview.reject')}
                  </Button>
                </>
              )}
              {actions.canRelease && (
                <Button variant="secondary" disabled={claimBusy} onClick={onRelease}>
                  {t('reviewClaims.release')}
                </Button>
              )}
            </div>
          </Card>

          {packageOpen && (
            <Card>
              <h2 className="text-h3">{t('manualReview.rights')}</h2>
              <p className="mt-2 text-sm">
                {t(rights.basis === 'licensed' ? 'manualReview.licensed' : 'manualReview.original')}
              </p>
              {rights.sourceLicenceNote && (
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                  {rights.sourceLicenceNote}
                </p>
              )}
              <p className="mt-4 text-caption text-muted">{t('manualReview.digest')}</p>
              <code className="mt-1 block break-all text-xs">{data.packageDigest}</code>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}

function StoryMetadata({ metadata }) {
  const { t } = useLocale()
  return (
    <Card>
      <h2 className="break-words text-h2">{metadata.title}</h2>
      <p className="mt-4 whitespace-pre-wrap break-words leading-7">{metadata.description}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <dt className="text-muted">{t('manualReview.storyCategory')}</dt>
          <dd className="font-medium">{metadata.category?.name ?? '—'}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <dt className="text-muted">{t('manualReview.storyTags')}</dt>
          {metadata.tags?.length ? (
            metadata.tags.map(tag => (
              <dd key={tag}>
                <Badge tone="blue">#{tag}</Badge>
              </dd>
            ))
          ) : (
            <dd className="font-medium">{t('manualReview.storyNoTags')}</dd>
          )}
        </div>
      </dl>
    </Card>
  )
}

function EvidenceCard({ submission, evidence }) {
  const { t } = useLocale()
  const batch = evidence?.batch
  return (
    <Card>
      <h2 className="text-h3">{t('manualReview.evidence.title')}</h2>
      {!evidence ? (
        <p className="mt-3 text-sm text-muted">{t('manualReview.evidence.none')}</p>
      ) : (
        <>
          {batch.status === 'failed' ? (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-2xl bg-rose/12 p-3 text-sm text-rose-strong"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {t('manualReview.evidence.failed', {
                stage: t('manualReview.evidence.stages.' + batch.failedStage),
              })}
            </p>
          ) : (
            batch.status !== 'available-for-human-review' && (
              <p className="mt-3 text-sm text-muted">
                {t('manualReview.evidence.processing', {
                  status: t('submissionData.evidenceStatus.' + batch.status),
                })}
              </p>
            )
          )}
          <FindingsBlock submission={submission} evidence={evidence} />
          {evidence.llmReview && <LlmReviewBlock review={evidence.llmReview} />}
        </>
      )}
    </Card>
  )
}

function FindingsBlock({ submission, evidence }) {
  const { t } = useLocale()
  return (
    <div className="mt-4 rounded-2xl border border-hairline p-4">
      {evidence.findingsCount > 0 ? (
        <>
          <p className="text-sm font-medium">
            {t('manualReview.evidence.findings', {
              count: evidence.findingsCount,
              score: Math.round(evidence.maxScore * 100),
            })}
          </p>
          {evidence.findingsTruncated && (
            <p className="mt-1 text-caption text-muted">
              {t('manualReview.evidence.findingsShown', {
                shown: evidence.findings.length,
                total: evidence.findingsCount,
              })}
            </p>
          )}
          <ButtonLink
            to={ROUTES.moderatorSimilarity(submission.id)}
            variant="secondary"
            size="sm"
            className="mt-3"
          >
            <FileSearch size={15} />
            {t('manualReview.evidence.openSimilarity')}
          </ButtonLink>
        </>
      ) : (
        <p className="text-sm text-muted">{t(similarityEmptyState(submission, evidence))}</p>
      )}
    </div>
  )
}

function LlmReviewBlock({ review }) {
  const { t, formatNumber } = useLocale()
  const partial =
    review.reviewedChars != null &&
    review.totalChars != null &&
    review.reviewedChars < review.totalChars
  return (
    <section className="mt-4 rounded-2xl border border-purple/30 bg-purple/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles size={16} className="text-purple-strong" />
        <h3 className="text-sm font-semibold">{t('manualReview.evidence.llmTitle')}</h3>
      </div>
      <Badge tone="purple" className="mt-2 whitespace-normal">
        {t('manualReview.evidence.advisory')}
      </Badge>
      {partial ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm">
            {t('manualReview.evidence.partialCoverage', {
              reviewed: formatNumber(review.reviewedChars),
              total: formatNumber(review.totalChars),
            })}
          </p>
          <Badge tone="orange">{t('manualReview.evidence.insufficientData')}</Badge>
        </div>
      ) : (
        review.riskLevel && (
          <p className="mt-3 text-sm font-medium">
            {t('manualReview.evidence.riskLevel', {
              level: t('manualReview.evidence.riskLevels.' + review.riskLevel),
            })}
          </p>
        )
      )}
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{review.summary}</p>
      {review.riskReasons.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-semibold">{t('manualReview.evidence.riskReasons')}</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {review.riskReasons.map((reason, index) => (
              <li key={index} className="whitespace-pre-wrap break-words">
                {reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {review.suggestions.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-semibold">{t('manualReview.evidence.suggestions')}</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {review.suggestions.map((suggestion, index) => (
              <li key={index} className="whitespace-pre-wrap break-words">
                {suggestion}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function HistoryCard({ history }) {
  const { t, formatDateTime } = useLocale()
  return (
    <Card>
      <h2 className="text-h3">{t('manualReview.history')}</h2>
      <ol className="mt-3 space-y-3">
        {history.map((entry, index) => (
          <li key={entry.id ?? index} className="border-b border-hairline pb-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted">{formatDateTime(entry.occurredAt)}</span>
              <span className="font-medium">
                {historyActionKeys[entry.action]
                  ? t(historyActionKeys[entry.action])
                  : entry.action}
              </span>
              {entry.outcome && (
                <Badge>
                  {historyOutcomeKeys[entry.outcome]
                    ? t(historyOutcomeKeys[entry.outcome])
                    : entry.outcome}
                </Badge>
              )}
            </div>
            {entry.feedback && (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{entry.feedback}</p>
            )}
          </li>
        ))}
      </ol>
    </Card>
  )
}
