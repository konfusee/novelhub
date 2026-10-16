import { useState } from 'react';
import { privateMediaUrl } from '../../api/media';
import { useLocale } from '../../context/LocaleContext';
export function PrivateChapterImage({ block }) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(null);
  return (
    <figure className="my-6 rounded-2xl border border-hairline p-3">
      {failed === block.mediaId ? (
        <p className="text-sm text-muted">{t('mediaData.unavailable')}</p>
      ) : (
        <img
          src={privateMediaUrl(block.mediaId)}
          crossOrigin="use-credentials"
          alt={block.alt}
          loading="lazy"
          onError={() => setFailed(block.mediaId)}
          className="mx-auto max-h-[70dvh] max-w-full object-contain"
        />
      )}
      {block.caption && (
        <figcaption className="mt-2 whitespace-pre-wrap break-words text-center text-sm text-muted">
          {block.caption}
        </figcaption>
      )}
    </figure>
  );
}
