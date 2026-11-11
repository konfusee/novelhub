import { useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { privateMediaUrl } from '../../api/media'
import { useLocale } from '../../context/LocaleContext'
import { Button, Input, Modal } from '../../components/ui'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export function ChapterImagePicker({ storyId, onClose, onAdd }) {
  const { t } = useLocale()
  const fileRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [alt, setAlt] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const chooseFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
      setError(t('chapterImages.invalidFile'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const query = new URLSearchParams({ name: file.name, kind: 'image', storyId })
      const result = await apiRequest(`/author/media?${query}`, {
        method: 'POST',
        body: file,
        binary: true,
      })
      if (!result.asset?.id) throw new Error(t('chapterImages.uploadError'))
      setSelected({ id: result.asset.id, name: file.name })
    } catch (failure) {
      setError(failure.message || t('chapterImages.uploadError'))
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    if (!selected) return
    if (!alt.trim()) {
      setError(t('chapterImages.altRequired'))
      return
    }
    if (!onAdd({ type: 'image', mediaId: selected.id, alt: alt.trim(), caption }))
      setError(t('chapterImages.limit'))
  }

  return (
    <Modal open title={t('chapterImages.title')} onClose={onClose}>
      <p className="text-sm leading-6 text-muted">{t('chapterImages.hint')}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={chooseFile}
        className="sr-only"
      />
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? t('chapterImages.uploading') : t('chapterImages.upload')}
      </Button>
      {selected && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-elevated p-2">
          <img
            src={privateMediaUrl(selected.id)}
            crossOrigin="use-credentials"
            alt=""
            className="max-h-64 w-full object-contain"
          />
          <p className="mt-2 truncate text-xs text-muted">{selected.name}</p>
        </div>
      )}
      <label className="mt-4 block text-sm font-semibold">
        {t('chapterImages.alt')}
        <Input
          className="mt-2 w-full"
          value={alt}
          maxLength={500}
          onChange={event => setAlt(event.target.value)}
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        {t('chapterImages.caption')}
        <textarea
          rows={2}
          maxLength={1000}
          value={caption}
          onChange={event => setCaption(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-line bg-surface p-3 text-sm text-ink"
        />
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-strong">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('mediaData.cancel')}
        </Button>
        <Button disabled={!selected || busy} onClick={add}>
          {t('chapterImages.add')}
        </Button>
      </div>
    </Modal>
  )
}
