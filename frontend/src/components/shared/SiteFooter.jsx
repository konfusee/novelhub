import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, NovelHubMark, Globe2, Headphones, MessageCircle } from '../icons';
import { Link } from 'react-router';
import { useLocale } from '../../context/LocaleContext';

const discoverLinks = [
  ['navigation.categories', '/categories'],
  ['footer.newReleases', '/search'],
  ['navigation.rankings', '/rankings'],
  ['footer.audiobooks', '/search'],
  ['footer.authors', '/search'],
];

const informationLinks = [
  ['footer.termsOfUse', '/terms'],
  ['footer.privacyPolicy', '/privacy'],
  ['footer.copyrightContact', '/'],
  ['footer.contactUs', '/'],
  ['footer.becomeAuthor', '/author/apply'],
];

function FooterLinks({ title, links }) {
  const { t } = useLocale();
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[.16em] text-white/90">{t(title)}</h2>
      <ul className="mt-4 space-y-1">
        {links.map(([label, path]) => (
          <li key={label}>
            <Link
              className="group/link inline-flex min-h-10 items-center gap-2.5 text-sm text-white/60 transition-colors hover:text-white pointer-coarse:min-h-11"
              to={path}
            >
              <span className="size-1.5 shrink-0 rounded-full bg-brand/70 transition-transform duration-200 ease-spring group-hover/link:scale-125" />
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
    <footer className="relative mt-auto border-t-4 border-brand bg-footer text-white/70">
      {sentinel}
      <div className="nh-grid-12 mx-auto grid max-w-[1360px] gap-12 px-6 pb-14 pt-16 nh-layout-md-6-3-3 md:px-10 lg:px-14">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 text-2xl font-bold text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand text-on-brand">
              <NovelHubMark size={23} />
            </span>
            <span>
              Novel<span className="text-brand">Hub</span>
            </span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/60">{t('footer.description')}</p>
          <div className="mt-7 flex gap-2.5" aria-hidden="true">
            {[Globe2, MessageCircle, Headphones].map((Icon, index) => (
              <span
                key={index}
                className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/75"
              >
                <Icon size={18} />
              </span>
            ))}
          </div>
        </div>
        <FooterLinks title="footer.discover" links={discoverLinks} />
        <FooterLinks title="footer.information" links={informationLinks} />
      </div>
      <div className="mx-auto max-w-[1360px] px-6 md:px-10 lg:px-14">
        <div className="flex items-center justify-between border-t border-white/10 py-6 text-xs text-white/55">
          <span>{t('footer.copyright')}</span>
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
