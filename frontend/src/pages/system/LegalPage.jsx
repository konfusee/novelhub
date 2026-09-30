import { ShieldCheck } from 'lucide-react'
import { PublicHeader } from '../../components/public/PublicHeader'
import { Card } from '../../components/ui'

const legalDocuments = {
  terms: {
    title: 'Terms of Service',
    updated: 'Last updated: September 30, 2026',
    introduction:
      'These Terms explain the rules for using NovelHub to read, listen to, publish, and discuss stories.',
    sections: [
      ['Using NovelHub', 'You must provide accurate account information, keep your account secure, and use the platform only for lawful purposes.'],
      ['Content and publishing', 'Authors keep ownership of their original work while granting NovelHub the permission needed to store, display, distribute, and promote content through the service.'],
      ['Community standards', 'Harassment, impersonation, copyright infringement, harmful automation, and attempts to disrupt the service are not allowed.'],
      ['Payments and virtual coins', 'Prices, revenue shares, refunds, and virtual-item rules are shown before a transaction. Virtual coins have no cash value unless required by applicable law.'],
      ['Suspension and termination', 'We may restrict accounts or remove content that violates these Terms. Where appropriate, we will provide notice and an appeal path.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: September 30, 2026',
    introduction:
      'This Policy describes what information NovelHub collects, why we use it, and the choices available to you.',
    sections: [
      ['Information we collect', 'We collect account details, reading and listening activity, saved preferences, publishing records, and technical information needed to operate the service.'],
      ['How we use information', 'We use information to provide synced libraries, recommendations, moderation, analytics, security, customer support, and platform improvements.'],
      ['Sharing and processors', 'We share only the information necessary with service providers that support hosting, payments, analytics, and content delivery, subject to appropriate safeguards.'],
      ['Retention and security', 'Information is retained only as long as needed for the purposes described here, legal obligations, dispute resolution, and platform security.'],
      ['Your choices', 'You may update profile information, adjust preferences, request a copy of your data, or request deletion where applicable.'],
    ],
  },
}

export function LegalContent({ type }) {
  const document = legalDocuments[type] || legalDocuments.terms
  return (
    <article>
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{document.title}</h1>
          <p className="mt-1 text-xs text-muted">{document.updated}</p>
        </div>
      </div>
      <p className="mt-6 text-sm leading-7 text-muted">{document.introduction}</p>
      <div className="mt-7 space-y-6">
        {document.sections.map(([title, body], index) => (
          <section key={title}>
            <h2 className="font-semibold">{index + 1}. {title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{body}</p>
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
