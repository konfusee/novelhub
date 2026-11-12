import { Link } from 'react-router'
import { ROUTES } from '../../app/routes'
import { authorAgreements } from '../../content/authorAgreements'
import { ShieldCheck } from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { Card } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

const legalDocuments = {
  ...Object.fromEntries(authorAgreements.map(document => [document.type, document])),
  terms: {
    title: 'legal.termsTitle',
    introduction: 'legal.termsIntro',
    sections: [
      ['legal.termsUsingTitle', 'legal.termsUsingBody'],
      ['legal.termsContentTitle', 'legal.termsContentBody'],
      ['legal.termsCommunityTitle', 'legal.termsCommunityBody'],
      ['legal.termsPaymentsTitle', 'legal.termsPaymentsBody'],
      ['legal.termsTerminationTitle', 'legal.termsTerminationBody'],
    ],
  },
  privacy: {
    title: 'legal.privacyTitle',
    introduction: 'legal.privacyIntro',
    sections: [
      ['legal.privacyCollectTitle', 'legal.privacyCollectBody'],
      ['legal.privacyUseTitle', 'legal.privacyUseBody'],
      ['legal.privacySharingTitle', 'legal.privacySharingBody'],
      ['legal.privacyRetentionTitle', 'legal.privacyRetentionBody'],
      ['legal.privacyChoicesTitle', 'legal.privacyChoicesBody'],
    ],
  },
}

const getDocument = type => legalDocuments[type] || legalDocuments.terms

/* `compact` omits the document heading for hosts that already title it (e.g. a Modal). */
export function LegalContent({ type, compact = false, anchorPrefix }) {
  const { t } = useLocale()
  const document = getDocument(type)
  const SectionHeading = compact ? 'h3' : 'h2'
  return (
    <article>
      {compact ? (
        <p className="text-xs text-muted">{t('legal.updated')}</p>
      ) : (
        <header className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
            <ShieldCheck size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-h2 sm:text-h1">{t(document.title)}</h1>
            <p className="mt-1 text-sm text-muted">{t('legal.updated')}</p>
          </div>
        </header>
      )}
      <p className={`${compact ? 'mt-4' : 'mt-8'} max-w-[65ch] text-base leading-7 text-ink/80`}>
        {t(document.introduction)}
      </p>
      <ol className="mt-8 divide-y divide-hairline border-t border-hairline">
        {document.sections.map(([title, body], index) => (
          <li
            key={title}
            id={anchorPrefix ? `${anchorPrefix}-${index + 1}` : undefined}
            className="flex scroll-mt-28 gap-4 py-6 sm:gap-5"
          >
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/12 text-xs font-semibold tabular-nums text-brand-strong"
            >
              {index + 1}
            </span>
            <section className="min-w-0">
              <SectionHeading className="text-base font-semibold sm:text-lg">
                <span className="sr-only">{index + 1}. </span>
                {t(title)}
              </SectionHeading>
              <p className="mt-2 max-w-[65ch] text-sm leading-7 text-muted">{t(body)}</p>
            </section>
          </li>
        ))}
      </ol>
    </article>
  )
}

function LegalNavigation({ type }) {
  const { t } = useLocale()
  const document = getDocument(type)
  const pages = [
    { type: 'terms', title: 'legal.termsTitle', path: '/terms' },
    { type: 'privacy', title: 'legal.privacyTitle', path: '/privacy' },
    ...authorAgreements.map(item => ({ ...item, path: ROUTES.authorAgreement(item.type) })),
  ]
  const links = (
    <>
      <nav aria-label={t('legal.quickNavigation')}>
        <h2 className="text-sm font-semibold">{t('legal.relatedPages')}</h2>
        <ul className="mt-3 space-y-1">
          {pages.map(page => (
            <li key={page.type}>
              <Link
                to={page.path}
                aria-current={type === page.type ? 'page' : undefined}
                className={
                  'flex min-h-11 items-center rounded-2xl px-3 py-2 text-sm leading-6 transition-colors ' +
                  (type === page.type
                    ? 'bg-brand-soft font-semibold text-brand-strong'
                    : 'text-muted hover:bg-elevated hover:text-ink')
                }
              >
                {t(page.title)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <nav aria-label={t('legal.tableOfContents')} className="mt-5 border-t border-line pt-5">
        <h2 className="text-sm font-semibold">{t('legal.tableOfContents')}</h2>
        <ol className="mt-3 space-y-1">
          {document.sections.map(([title], index) => (
            <li key={title}>
              <a
                href={'#legal-' + type + '-' + (index + 1)}
                className="flex min-h-10 items-start gap-2 rounded-xl px-3 py-2 text-sm leading-6 text-muted hover:bg-elevated hover:text-brand-strong"
              >
                <span className="shrink-0 font-semibold tabular-nums text-brand-strong">
                  {index + 1}.
                </span>
                {t(title)}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
  return (
    <aside className="order-first min-w-0 self-start lg:sticky lg:top-24 lg:order-last">
      <Card className="p-5 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
        <div className="hidden lg:block">{links}</div>
        <details className="lg:hidden">
          <summary className="cursor-pointer text-sm font-semibold text-brand-strong">
            {t('legal.quickNavigation')}
          </summary>
          <div className="mt-5">{links}</div>
        </details>
      </Card>
    </aside>
  )
}

export function LegalPage({ type, embedded = false }) {
  const content = (
    <div className="mx-auto grid w-full max-w-[1360px] items-start gap-6 px-4 py-8 sm:px-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 lg:py-14">
      <Card bezel className="min-w-0" innerClassName="p-6 sm:p-10 lg:p-12">
        <LegalContent key={type} type={type} anchorPrefix={'legal-' + type} />
      </Card>
      <LegalNavigation type={type} />
    </div>
  )
  if (embedded) return content
  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main>{content}</main>
    </div>
  )
}
