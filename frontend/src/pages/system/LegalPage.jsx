import { ShieldCheck } from '../../components/icons'
import { PublicHeader } from '../../components/public/PublicHeader'
import { Card } from '../../components/ui'
import { useLocale } from '../../context/LocaleContext'

const legalDocuments = {
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

export function LegalContent({ type }) {
  const { t } = useLocale()
  const document = legalDocuments[type] || legalDocuments.terms
  return (
    <article>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t(document.title)}</h1>
          <p className="mt-1 text-xs text-muted">{t('legal.updated')}</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-7 text-muted">{t(document.introduction)}</p>
      <div className="mt-7 space-y-6">
        {document.sections.map(([title, body], index) => (
          <section key={title}>
            <h2 className="font-semibold">{index + 1}. {t(title)}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{t(body)}</p>
          </section>
        ))}
      </div>
    </article>
  )
}

export function LegalPage({ type, embedded = false }) {
  return (
    <div className="min-h-screen bg-page text-ink">
      {!embedded && <PublicHeader />}
      <main className="mx-auto max-w-4xl px-5 py-10 md:px-8 lg:py-14">
        <Card className="p-6 sm:p-9">
          <LegalContent type={type} />
        </Card>
      </main>
    </div>
  )
}
