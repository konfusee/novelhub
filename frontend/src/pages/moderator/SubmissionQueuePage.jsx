import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ClipboardCheck, RotateCcw, UserPlus } from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { Pagination } from '../../components/ui/Pagination'
import { moderationErrorKey, waitingAge } from './moderationMessages'

const VIEWS = ['available', 'mine', 'processing']
const columns = [
  'reviewClaims.submission',
  'reviewClaims.author',
  'reviewClaims.submittedAt',
  'reviewClaims.waiting',
  'reviewClaims.evidence',
  'reviewClaims.claimState',
  'reviewClaims.action',
]

export function SubmissionQueuePage() {
  const { t, formatDateTime } = useLocale()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [view, setView] = useState(() =>
    VIEWS.includes(searchParams.get('view')) ? searchParams.get('view') : 'available',
  )
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const resource = useBackendDocument('/moderator/submissions?view=' + view + '&page=' + page, null)
  const items = resource.status === 'ready' ? (resource.data?.items ?? []) : []

  const close = () => {
    if (saving) return
    setPending(null)
    setError('')
  }
  const confirmClaim = async () => {
    if (!pending || saving) return
    setSaving(true)
    setError('')
    try {
      const claimed = await apiRequest(
        '/moderator/submissions/' + pending.submissionId + '/claim',
        { method: 'POST', body: { expectedVersion: pending.version } },
      )
      navigate(ROUTES.moderatorSubmission(pending.submissionId), {
        state: {
          notice: t('reviewClaims.claimed', {
            dateTime: formatDateTime(claimed.submission.claimExpiresAt),
            timeZone: t('reviewClaims.timeZone'),
          }),
        },
      })
    } catch (failure) {
      setError(t(moderationErrorKey(failure.code)))
      setSaving(false)
    }
  }

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t('reviewClaims.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              {t('reviewClaims.description')}
            </p>
          </div>
          <Button variant="secondary" onClick={resource.retry}>
            <RotateCcw size={15} />
            {t('reviewClaims.reload')}
          </Button>
        </div>

        <div className="mt-6">
          <Tabs
            label={t('reviewClaims.title')}
            value={view}
            onChange={value => {
              setView(value)
              setPage(1)
            }}
            items={VIEWS.map(value => ({ value, label: t('reviewClaims.views.' + value) }))}
          />
        </div>
        {view === 'processing' && (
          <p className="mt-4 text-sm text-muted">{t('reviewClaims.processingNote')}</p>
        )}

        <Card className="mt-4 p-0">
          {resource.status === 'loading' ? (
            <div aria-busy="true" className="space-y-3 p-5">
              <p role="status" className="text-sm text-muted">
                {t('reviewClaims.loading')}
              </p>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-2xl" />
              ))}
            </div>
          ) : resource.status === 'error' ? (
            <EmptyState
              tone="rose"
              icon={RotateCcw}
              title={t('reviewClaims.error')}
              action={
                <Button variant="secondary" onClick={resource.retry}>
                  {t('reviewClaims.reload')}
                </Button>
              }
            />
          ) : !items.length ? (
            <EmptyState icon={ClipboardCheck} title={t('reviewClaims.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {columns.map(key => (
                      <th key={key} scope="col" className="px-4 py-3 font-semibold">
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <QueueRow
                      key={item.submissionId}
                      item={item}
                      view={view}
                      onClaim={() => {
                        setError('')
                        setPending(item)
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {resource.status === 'ready' && resource.data && (
          <Pagination page={page} pageCount={resource.data.pageCount} onChange={setPage} />
        )}
      </div>

      <Modal open={Boolean(pending)} title={t('reviewClaims.title')} onClose={close}>
        {pending && (
          <div>
            <p className="font-semibold">{pending.title}</p>
            <p className="mt-1 text-sm text-muted">{pending.storyTitle}</p>
            <p className="mt-4 text-sm leading-6">{t('reviewClaims.acquireNote')}</p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-strong">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={saving} onClick={close}>
                {t('reviewClaims.close')}
              </Button>
              <Button type="button" disabled={saving} onClick={confirmClaim}>
                {t(saving ? 'reviewClaims.saving' : 'reviewClaims.confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ModeratorLayout>
  )
}

function QueueRow({ item, view, onClaim }) {
  const { t, formatDateTime } = useLocale()
  const { evidence } = item
  return (
    <tr className="border-b border-hairline align-top last:border-b-0">
      <td className="px-4 py-3">
        <p className="break-words font-medium">{item.title}</p>
        <p className="mt-1 break-words text-caption text-muted">
          {t('reviewClaims.targetTypes.' + item.targetType)} · {item.storyTitle}
        </p>
      </td>
      <td className="px-4 py-3">{item.author.displayName}</td>
      <td className="whitespace-nowrap px-4 py-3">{formatDateTime(item.submittedAt)}</td>
      <td className="whitespace-nowrap px-4 py-3">{t(...waitingAge(item.waitingSeconds))}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <Badge tone={item.evidenceStatus === 'failed' ? 'red' : 'neutral'}>
            {t('reviewClaims.evidenceStates.' + item.evidenceStatus)}
          </Badge>
          {evidence && item.evidenceStatus !== 'processing' && (
            <span className="text-caption text-muted">
              {t('reviewClaims.findings', { count: evidence.findingsCount })}
            </span>
          )}
          {item.evidenceStatus === 'failed' && evidence?.failedStage && (
            <span className="text-caption text-rose-strong">
              {t('reviewClaims.failedStage', {
                stage: t('manualReview.evidence.stages.' + evidence.failedStage),
              })}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {t('reviewClaims.claimStates.' + item.claimState, {
          dateTime: item.claimExpiresAt ? formatDateTime(item.claimExpiresAt) : '',
        })}
      </td>
      <td className="px-4 py-3">
        {view === 'processing' ? (
          <span className="text-caption text-muted">{t('reviewClaims.notOpenable')}</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              to={ROUTES.moderatorSubmission(item.submissionId)}
              size="sm"
              variant="secondary"
            >
              {t('reviewClaims.openReview')}
            </ButtonLink>
            {view === 'available' && (
              <Button size="sm" onClick={onClaim}>
                <UserPlus size={15} />
                {t('reviewClaims.acquire')}
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
