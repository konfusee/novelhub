import { useState } from 'react';
import { ReaderRange } from '../../components/reader/ReaderSettings';
import {
  DEFAULT_READER_FONT,
  READER_FONT_SIZES,
  READER_WIDTH,
  READER_LINE_HEIGHTS,
} from '../../components/reader/readerOptions';
import { Button } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';
import { ChapterInlineText } from '../../components/reader/ChapterInlineText';
import { PrivateChapterImage } from '../../components/story/PrivateChapterImage';

// Same reading font, width limits, spacing options and surface geometry as the reader.
// Preview settings stay local; preview never records a read, view, purchase or progress.
export function DraftReadingCanvas({ document, storyTitle, submissionId, headingLevel = 1 }) {
  const { t } = useLocale();
  const Heading = headingLevel === 2 ? 'h2' : 'h1';
  const [fontSize, setFontSize] = useState(20);
  const [width, setWidth] = useState(800);
  const [lineHeight, setLineHeight] = useState(1.8);
  return (
    <div className="min-w-0 bg-reader pb-10 text-ink">
      <div className="mx-auto grid max-w-4xl gap-4 rounded-3xl border border-hairline bg-surface p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold">
            {t('reader.fontSize')} · {fontSize}px
          </p>
          <ReaderRange
            label={t('reader.fontSize')}
            min={READER_FONT_SIZES[0]}
            max={READER_FONT_SIZES.at(-1)}
            step={2}
            value={fontSize}
            onChange={setFontSize}
          />
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold">
            {t('reader.contentWidth')} · {width}px
          </p>
          <ReaderRange
            label={t('reader.contentWidth')}
            min={READER_WIDTH.min}
            max={READER_WIDTH.max}
            step={READER_WIDTH.step}
            value={width}
            onChange={setWidth}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <span className="text-sm font-semibold">{t('reader.lineHeight')}</span>
          {READER_LINE_HEIGHTS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={lineHeight === value ? 'primary' : 'secondary'}
              aria-pressed={lineHeight === value}
              onClick={() => setLineHeight(value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>
      <div className="mx-auto w-full" style={{ maxWidth: width }}>
        <header className="px-4 py-8 text-center sm:px-6 sm:py-12">
          <p className="break-words text-sm text-brand-strong">{storyTitle}</p>
          <Heading className="mt-3 break-words text-h2">{document.title}</Heading>
        </header>
        <article
          aria-label={t('authorDraftActions.manuscript')}
          className="mx-4 text-pretty sm:mx-6 sm:rounded-3xl sm:border sm:border-hairline sm:bg-surface sm:px-10 sm:py-12 sm:shadow-whisper lg:px-14"
          style={{ fontFamily: DEFAULT_READER_FONT, fontSize, lineHeight }}
        >
          {document.blocks.map((block, index) => {
            if (block.type === 'image')
              return <PrivateChapterImage key={index} block={block} submissionId={submissionId} />;
            const className = 'mb-[22px] whitespace-pre-wrap break-words last:mb-0';
            if (
              block.type === 'scene-break' ||
              (block.type === 'paragraph' &&
                block.inlines
                  .map((item) => item.text)
                  .join('')
                  .trim() === '*     *     *')
            )
              return <hr key={index} className="my-8 border-hairline" />;
            const text = <ChapterInlineText inlines={block.inlines} />;
            if (block.type === 'heading') {
              const Heading = block.level === 2 ? 'h2' : 'h3';
              return (
                <Heading key={index} className={`${className} font-bold`}>
                  {text}
                </Heading>
              );
            }
            if (block.type === 'quote')
              return (
                <blockquote
                  key={index}
                  className={`${className} border-l-2 border-brand pl-4 italic`}
                >
                  {text}
                </blockquote>
              );
            return (
              <p key={index} className={className}>
                {text}
              </p>
            );
          })}
        </article>
      </div>
    </div>
  );
}
