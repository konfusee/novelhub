import { useState } from 'react'
import * as icons from './index'
import { iconPaths } from './iconPaths'
import { useLocale } from '../../context/LocaleContext'
import { Input } from '../ui'

export function IconGallery() {
  const { t } = useLocale()
  const [query, setQuery] = useState('')
  const names = Object.keys(iconPaths).filter(name =>
    name.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <section id="icons" className="mt-10 border-t border-line pt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">{t('icons.title')}</h2>
          <p className="mt-2 text-sm text-muted">
            {t('icons.description', { count: Object.keys(iconPaths).length })}
          </p>
        </div>
        <Input
          icon={icons.Search}
          value={query}
          onChange={event => setQuery(event.target.value)}
          aria-label={t('icons.search')}
          placeholder={t('icons.search')}
          className="sm:w-64"
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <img src="/novelhub-mark.svg" width="64" height="64" alt={t('icons.brand')} />
        <div className="min-w-0 flex-1">
          <strong>NovelHub Folio</strong>
          <p className="text-sm text-muted">{t('icons.brandDescription')}</p>
        </div>
        <a
          href="/novelhub-icons.svg"
          download
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
        >
          <icons.Download size={18} />
          {t('icons.download')}
        </a>
      </div>
      <div className="nh-grid-12 nh-cols-2 nh-sm-cols-3 nh-lg-cols-6 mt-5 gap-3">
        {names.map(name => {
          const Icon = icons[name]
          return (
            <figure
              key={name}
              className="m-0 flex min-w-0 flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex h-12 items-center gap-3 text-ink">
                <Icon size={16} />
                <Icon size={24} />
                <Icon size={32} />
              </div>
              <figcaption className="w-full break-all text-center text-xs text-muted">
                {name}
              </figcaption>
            </figure>
          )
        })}
      </div>
      {!names.length && (
        <p className="mt-5 text-sm text-muted" role="status">
          {t('icons.empty')}
        </p>
      )}
    </section>
  )
}
