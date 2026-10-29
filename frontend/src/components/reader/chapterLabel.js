/* "Chương N: Title" for a chapter or neighbour link ({ orderKey, title }). */
export const chapterLabel = (t, info) =>
  info?.orderKey
    ? t('reader.chapterHeading', { number: info.orderKey, title: info.title || '' })
    : info?.title || t('reader.chapterFallback')
