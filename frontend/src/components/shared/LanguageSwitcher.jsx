import { useLocale } from '../../context/LocaleContext'

export function LanguageSwitcher({ compact = false }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div
      className="flex items-center rounded-xl border border-line bg-surface p-1"
      role="group"
      aria-label={t('common.chooseLanguage')}
    >
      {['vi', 'en'].map(language => (
        <button
          key={language}
          type="button"
          onClick={() => setLocale(language)}
          aria-pressed={locale === language}
          className={`${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2.5 py-1.5 text-xs'} rounded-lg font-semibold transition-colors ${
            locale === language ? 'bg-brand text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
