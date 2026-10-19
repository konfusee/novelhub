import { useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useLocale } from '../../context/LocaleContext'
import { Button, Modal } from '../../components/ui'

export function StoryUnpublishDialog({ story, version, onClose, onChanged, onBusy }) {
  const { t } = useLocale()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = useRef(false)
  const submit = async event => {
    event.preventDefault()
    event.stopPropagation()
    if (locked.current || !reason.trim() || error) return
    locked.current = true
    setBusy(true)
    onBusy?.(true)
    try {
      const result = await apiRequest(`/author/stories/${story.id}/lifecycle`, {
        method: 'POST',
        body: {
          action: 'unpublish',
          expectedVersion: version,
          expectedPublishedRevisionId: story.publishedRevisionId,
          reason: reason.trim(),
        },
      })
      if (
        result?.story?.id !== story.id ||
        result.story.status !== 'unpublished' ||
        !Number.isSafeInteger(result.story.version) ||
        result.story.version <= version
      )
        throw new Error(t('storyUnpublish.failed'))
      onChanged()
    } catch (failure) {
      setError(failure.message || t('storyUnpublish.failed'))
    } finally {
      locked.current = false
      setBusy(false)
      onBusy?.(false)
    }
  }
  return (
    <Modal open title={t('storyUnpublish.title')} onClose={() => !locked.current && onClose()}>
      <form onSubmit={submit}>
        <h3 className="break-words text-base font-semibold">{story.title}</h3>
        <p className="mt-3 text-sm leading-6 text-muted">{t('storyUnpublish.hint')}</p>
        <label htmlFor="story-unpublish-reason" className="mt-4 block text-sm font-semibold">
          {t('storyUnpublish.reason')}
        </label>
        <textarea
          id="story-unpublish-reason"
          required
          maxLength={1000}
          value={reason}
          disabled={busy || Boolean(error)}
          onChange={event => setReason(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-3xl border border-line bg-surface p-4 text-ink"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error} {t('storyUnpublish.reload')}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            {t('submissionData.cancel')}
          </Button>
          {error ? (
            <Button type="button" onClick={onChanged}>
              {t('storyUnpublish.refresh')}
            </Button>
          ) : (
            <Button type="submit" disabled={busy || !reason.trim()}>
              {t(busy ? 'storyUnpublish.busy' : 'storyUnpublish.title')}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
