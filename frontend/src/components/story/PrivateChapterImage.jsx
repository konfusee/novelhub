import { useState } from 'react'
import { privateMediaUrl, submittedMediaUrl, publishedMediaUrl } from '../../api/media'
import { useLocale } from '../../context/LocaleContext'
export function PrivateChapterImage({ block, submissionId, mediaUrl }) {
  const src = mediaUrl
    ? mediaUrl(block.mediaId)
    : submissionId
      ? submittedMediaUrl(submissionId, block.mediaId)
      : privateMediaUrl(block.mediaId)
  return <ChapterImage block={block} src={src} />
}
export function PublishedChapterImage({ block, target }) {
  return <ChapterImage block={block} src={publishedMediaUrl(target, block.mediaId)} />
}
function ChapterImage({ block, src }) {
  const { t } = useLocale()
  const [failed, setFailed] = useState(null)
  return (
    <figure className="my-6 rounded-2xl border border-hairline p-3">
      {failed === src ? (
        <p className="text-sm text-muted">{t('mediaData.unavailable')}</p>
      ) : (
        <img
          src={src}
          crossOrigin="use-credentials"
          alt={block.alt}
          loading="lazy"
          onError={() => setFailed(src)}
          className="mx-auto max-h-[70dvh] max-w-full object-contain"
        />
      )}
      {block.caption && (
        <figcaption className="mt-2 whitespace-pre-wrap break-words text-center text-sm text-muted">
          {block.caption}
        </figcaption>
      )}
    </figure>
  )
}
