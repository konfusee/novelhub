import { ShieldCheck } from '../../components/icons';
import { PublicHeader } from '../../components/public/PublicHeader';
import { Card } from '../../components/ui';
import { useLocale } from '../../context/LocaleContext';

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
};

const getDocument = (type) => legalDocuments[type] || legalDocuments.terms;

/* `compact` omits the document heading for hosts that already title it (e.g. a Modal). */
export function LegalContent({ type, compact = false }) {
  const { t } = useLocale();
  const document = getDocument(type);
  const SectionHeading = compact ? 'h3' : 'h2';
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
          <li key={title} className="flex gap-4 py-6 sm:gap-5">
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
  );
}

export function LegalPage({ type, embedded = false }) {
  const content = (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 md:px-8 lg:py-14">
      <Card bezel innerClassName="p-6 sm:p-10 lg:p-12">
        <LegalContent type={type} />
      </Card>
    </div>
  );
  if (embedded) return content;
  return (
    <div className="min-h-screen bg-page text-ink">
      <PublicHeader />
      <main>{content}</main>
    </div>
  );
}
