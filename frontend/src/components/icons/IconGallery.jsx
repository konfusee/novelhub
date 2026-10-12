import { useState } from 'react';
import * as icons from './index';
import { iconPaths } from './iconPaths';
import { useLocale } from '../../context/LocaleContext';
import { Card, EmptyState, Input } from '../ui';

export function IconGallery() {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const names = Object.keys(iconPaths).filter((name) =>
    name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section id="icons" className="mt-10 scroll-mt-6 border-t border-hairline pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-h3 md:text-h2">{t('icons.title')}</h2>
          <p className="mt-1 text-sm text-muted">
            {t('icons.description', { count: Object.keys(iconPaths).length })}
          </p>
        </div>
        <Input
          icon={icons.Search}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t('icons.search')}
          placeholder={t('icons.search')}
          className="w-full sm:w-64"
        />
      </div>
      <Card className="mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5">
        <img
          src="/novelhub-mark.svg"
          width="64"
          height="64"
          alt={t('icons.brand')}
          className="size-16 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <strong className="block text-base">NovelHub Folio</strong>
          <p className="mt-0.5 max-w-[60ch] text-sm text-muted">{t('icons.brandDescription')}</p>
        </div>
        <a
          href="/novelhub-icons.svg"
          download
          className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-full border border-brand/60 px-4 text-sm font-semibold text-brand-strong transition-[background-color,border-color,transform] duration-200 hover:border-brand hover:bg-brand/8 active:scale-[0.98]"
        >
          <icons.Download size={16} />
          {t('icons.download')}
        </a>
      </Card>
      {names.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {names.map((name) => {
            const Icon = icons[name];
            return (
              <figure
                key={name}
                className="m-0 flex min-w-0 flex-col items-center gap-3 rounded-2xl border border-hairline bg-surface p-4 shadow-whisper transition-[border-color] duration-200 hover:border-brand/40"
              >
                <div className="flex h-12 items-center gap-3 text-ink">
                  <Icon size={16} />
                  <Icon size={24} />
                  <Icon size={32} />
                </div>
                <figcaption className="w-full break-all text-center font-mono text-xs text-muted">
                  {name}
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : (
        <Card className="mt-5 p-0" role="status">
          <EmptyState icon={icons.Search} headingAs="h3" title={t('icons.empty')} />
        </Card>
      )}
    </section>
  );
}
