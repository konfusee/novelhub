import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowRight, NovelHubMark } from '../icons';
import { Link } from 'react-router';
import { ROUTES } from '../../app/routes';
import { useLocale } from '../../context/LocaleContext';

const discoverLinks = [
  ['navigation.categories', ROUTES.categories],
  ['navigation.explore', ROUTES.search],
  ['navigation.rankings', ROUTES.rankings],
  ['navigation.library', ROUTES.library],
];
const authorLinks = [
  ['navigation.becomeAuthor', ROUTES.authorApply],
  ['legal.author.authorGuidelines.title', ROUTES.authorAgreement('authorGuidelines')],
  ['legal.author.publishing.title', ROUTES.authorAgreement('publishing')],
  ['legal.author.revenue.title', ROUTES.authorAgreement('revenue')],
];
const informationLinks = [
  ['footer.termsOfUse', '/terms'],
  ['footer.privacyPolicy', '/privacy'],
  ['legal.author.rights.title', ROUTES.authorAgreement('rights')],
];
function FooterLinks({ title, links, className }) {
  const { t } = useLocale();
  return (
    <div className={className}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--footer-ink)]">
        {t(title)}
      </h2>
      <ul className="mt-5 space-y-1">
        {links.map(([label, path]) => (
          <li key={label}>
            <Link
              to={path}
              className="inline-flex min-h-10 items-center text-sm leading-6 text-[var(--footer-muted)] transition-colors hover:text-[var(--footer-ink)]"
            >
              {t(label)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Back-to-top visibility from an IntersectionObserver sentinel 240px below the document top. */
function useScrolledPastTop() {
  const [sentinel, setSentinel] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setScrolled(!entry.isIntersecting && entry.boundingClientRect.top < 0),
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);
  const marker = createPortal(
    <span
      ref={setSentinel}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-[240px] h-px w-px"
    />,
    document.body,
  );
  return [scrolled, marker];
}

export function SiteFooter() {
  const { t } = useLocale();
  const [showBackToTop, sentinel] = useScrolledPastTop();
  return (
    <footer className="relative mt-auto border-t border-[var(--footer-line)] bg-footer text-[var(--footer-muted)]">
      {sentinel}
      <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-12 gap-x-8 gap-y-10 py-12 sm:py-16 lg:gap-x-12">
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <Link
              to={ROUTES.home}
              className="inline-flex items-center gap-3 text-2xl font-bold text-[var(--footer-ink)]"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-brand text-on-brand">
                <NovelHubMark size={23} />
              </span>
              <span>
                Novel<span className="text-brand">Hub</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-7">{t('footer.description')}</p>
            <Link
              to={ROUTES.search}
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--footer-ink)] hover:text-brand"
            >
              {t('footer.startExploring')}
              <ArrowRight size={16} />
            </Link>
          </div>
          <FooterLinks
            title="footer.discover"
            links={discoverLinks}
            className="col-span-12 sm:col-span-6 lg:col-span-2"
          />
          <FooterLinks
            title="footer.forAuthors"
            links={authorLinks}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          />
          <FooterLinks
            title="footer.informationSupport"
            links={informationLinks}
            className="col-span-12 sm:col-span-6 lg:col-span-3"
          />
        </div>
        <div className="flex flex-col gap-4 border-t border-[var(--footer-line)] py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{t('footer.copyright')}</p>
          <nav aria-label={t('footer.policyLinks')} className="flex flex-wrap gap-x-6 gap-y-3">
            {informationLinks.map(([label, path]) => (
              <Link key={label} to={path} className="hover:text-[var(--footer-ink)]">
                {t(label)}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="nh-fade-enter fixed bottom-20 right-4 z-[99] grid size-12 place-items-center rounded-full bg-brand text-on-brand shadow-lift transition-transform duration-200 ease-spring hover:-translate-y-0.5 active:scale-[0.96]"
          aria-label={t('common.backToTop')}
        >
          <ArrowUp size={19} />
        </button>
      )}
    </footer>
  );
}
