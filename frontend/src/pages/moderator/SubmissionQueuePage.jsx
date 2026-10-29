import { useState } from 'react'
import { useNavigate } from 'react-router'
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
import { moderationErrorKey } from './moderationMessages'

const columns = [
  'reviewClaims.submission',
  'reviewClaims.author',
  'reviewClaims.submittedAt',
  'reviewClaims.status',
  'reviewClaims.evidence',
  'reviewClaims.expiresAt',
  'reviewClaims.action',
]

export function SubmissionQueuePage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [view, setView] = useState('queue')
  const [page, setPage] = useState(1)
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const resource = useBackendDocument('/moderator/submissions?view=' + view + '&page=' + page, null)
  const items = resource.status === 'ready' ? (resource.data?.items ?? []) : []

  const open = (item, action) => {
    setError('')
    setPending({ item, action })
  }
  const close = () => {
    if (saving) return
    setPending(null)
    setError('')
  }
  const confirm = async () => {
    if (!pending || saving) return
    const { item, action } = pending
    setSaving(true)
    setError('')
    try {
      await apiRequest('/moderator/submissions/' + item.id + '/' + action, {
        method: 'POST',
        body: { expectedVersion: item.version },
      })
      if (action === 'claim') {
        navigate(ROUTES.moderatorSubmission(item.id))
        return
      }
      setPending(null)
      setNotice(t('reviewClaims.released'))
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
            items={[
              { value: 'queue', label: t('reviewClaims.available') },
              { value: 'mine', label: t('reviewClaims.mine') },
              { value: 'processing', label: t('reviewClaims.processing') },
            ]}
          />
        </div>

        {notice && (
          <p role="status" className="mt-4 text-sm text-brand-strong">
            {notice}
          </p>
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
              <table className="w-full min-w-[60rem] text-left text-sm">
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
                    <QueueRow key={item.id} item={item} view={view} onAction={open} />
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
            <p className="font-semibold">{pending.item.title}</p>
            <p className="mt-1 text-sm text-muted">{pending.item.storyTitle}</p>
            <p className="mt-4 text-sm leading-6">
              {t(
                pending.action === 'claim'
                  ? 'reviewClaims.acquireNote'
                  : 'reviewClaims.releaseNote',
              )}
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-strong">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={saving} onClick={close}>
                {t('reviewClaims.close')}
              </Button>
              <Button type="button" disabled={saving} onClick={confirm}>
                {t(saving ? 'reviewClaims.saving' : 'reviewClaims.confirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ModeratorLayout>
  )
}

function QueueRow({ item, view, onAction }) {
  const { t, formatDate } = useLocale()
  const { evidence, claim } = item
  return (
    <tr className="border-b border-hairline align-top last:border-b-0">
      <td className="px-4 py-3">
        <p className="break-words font-medium">{item.title}</p>
        <p className="mt-1 break-words text-caption text-muted">{item.storyTitle}</p>
      </td>
      <td className="px-4 py-3">{item.author.displayName}</td>
      <td className="whitespace-nowrap px-4 py-3">{formatDate(item.submittedAt)}</td>
      <td className="px-4 py-3">
        <Badge>{t('submissionData.status.' + item.status)}</Badge>
      </td>
      <td className="px-4 py-3">
        {evidence ? (
          <div className="flex flex-col gap-1">
            <span>{t('submissionData.evidenceStatus.' + evidence.status)}</span>
            <span className="text-caption text-muted">
              {t('reviewClaims.findings', { count: evidence.findingsCount })}
            </span>
            {evidence.status === 'failed' && (
              <span className="text-caption text-rose-strong">
                {t('reviewClaims.failedStage', {
                  stage: t('manualReview.evidence.stages.' + evidence.failedStage),
                })}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted">{t('reviewClaims.noEvidence')}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {claim ? (
          <div className="flex flex-col gap-1">
            <span>{formatDate(claim.expiresAt)}</span>
            {claim.expired && (
              <span className="text-caption text-orange-strong">{t('reviewClaims.expired')}</span>
            )}
          </div>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={ROUTES.moderatorSubmission(item.id)} size="sm" variant="secondary">
            {t('reviewClaims.openReview')}
          </ButtonLink>
          {view === 'queue' && (
            <Button size="sm" onClick={() => onAction(item, 'claim')}>
              <UserPlus size={15} />
              {t('reviewClaims.acquire')}
            </Button>
          )}
          {view === 'mine' && (
            <Button size="sm" variant="outline" onClick={() => onAction(item, 'release')}>
              {t('reviewClaims.release')}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
