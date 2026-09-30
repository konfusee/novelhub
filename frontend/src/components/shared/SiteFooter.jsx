import { useEffect, useState } from 'react'
import { ArrowUp, BookOpen, Globe2, Headphones, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const discoverLinks = [
  ['Categories', '/categories'],
  ['New releases', '/search'],
  ['Rankings', '/rankings'],
  ['Audiobooks', '/search'],
  ['Authors', '/search'],
]

const informationLinks = [
  ['Terms of use', '/terms'],
  ['Privacy policy', '/privacy'],
  ['Copyright contact', '/'],
  ['Contact us', '/'],
  ['Become an author', '/author/apply'],
]

function FooterLinks({ title, links }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-[.12em] text-white">{title}</h2>
      <div className="mt-3 h-px w-20 bg-white/20" />
      <ul className="mt-5 space-y-3">
        {links.map(([label, path]) => (
          <li key={label} className="flex items-center gap-3 text-sm text-slate-300">
            <span className="size-1.5 shrink-0 rounded-full bg-brand" />
            <Link className="transition hover:text-white" to={path}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  const [showBackToTop, setShowBackToTop] = useState(false)
  useEffect(() => {
    const updateVisibility = () => setShowBackToTop(window.scrollY > 240)
    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])
  return (
    <footer className="relative mt-auto border-t-4 border-brand bg-[#080b10] text-slate-300">
      <div className="mx-auto grid max-w-[1360px] gap-12 px-6 py-14 md:grid-cols-[1.3fr_1fr_1fr] md:px-10 lg:px-14">
        <div>
          <Link to="/" className="inline-flex items-center gap-3 text-2xl font-bold text-white">
            <span className="grid size-11 place-items-center rounded-xl bg-brand text-white">
              <BookOpen size={23} />
            </span>
            Novel<span className="-ml-3 text-brand">Hub</span>
          </Link>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
            A modern home for reading and listening, where readers discover new stories and authors
            grow their communities.
          </p>
          <div className="mt-6 flex gap-3">
            {[Globe2, MessageCircle, Headphones].map((Icon, index) => (
              <span
                key={index}
                className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/5 text-slate-200"
              >
                <Icon size={18} />
              </span>
            ))}
          </div>
          <Link className="mt-7 inline-flex items-center gap-2 font-semibold text-brand" to="/">
            Back to home <span aria-hidden="true">→</span>
          </Link>
        </div>
        <FooterLinks title="Discover" links={discoverLinks} />
        <FooterLinks title="Information" links={informationLinks} />
      </div>
      <div className="mx-auto flex max-w-[1360px] items-center justify-between border-t border-white/15 px-6 py-6 text-xs text-slate-500 md:px-10 lg:px-14">
        <span>© 2026 NovelHub. All rights reserved.</span>
      </div>
      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-4 z-[99] grid size-12 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5"
          aria-label="Back to top"
        >
          <ArrowUp size={19} />
        </button>
      )}
    </footer>
  )
}
