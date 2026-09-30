import { BookOpen, LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getAccountHome, useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
import { LanguageSwitcher } from '../shared/LanguageSwitcher'
export function PublicHeader() {
  const { resolvedTheme, setTheme } = useTheme()
  const { currentUser, isAuthenticated, hasRole, logout } = useAuth()
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const links = [
    [t('discover'), '//'],
    [t('categories'), '/categories'],
    [t('rankings'), '/rankings'],
  ].map(([label, to]) => [label, to === '//' ? '/' : to])
  if (isAuthenticated) links.push([t('library'), '/reader/library'])
  if (hasRole('author')) links.push([t('authorDashboard'), '/author'])
  if (hasRole('moderator')) links.push(['Moderator Dashboard', '/moderator'])
  if (hasRole('admin')) links.push(['Admin Dashboard', '/admin'])
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95">
      <div className="mx-auto flex min-h-18 max-w-[1360px] items-center gap-5 px-5 md:px-8 lg:px-12">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <BookOpen size={19} />
          </span>
          Novel<span className="-ml-2 text-brand">Hub</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map(([label, to]) => (
            <NavLink
              className={({ isActive }) =>
                `border-b-2 px-3 py-6 text-xs font-medium ${isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`
              }
              to={to}
              key={to}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <Link to="/search" aria-label="Search" className="ml-auto hidden text-muted md:block">
          <Search size={19} />
        </Link>
        <LanguageSwitcher />
        <button
          className="grid size-10 place-items-center rounded-full text-muted"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        {isAuthenticated ? (
          <>
            <Link
              className="hidden sm:grid size-9 place-items-center rounded-full bg-brand text-sm font-semibold text-white"
              to={getAccountHome(currentUser)}
              aria-label={`${currentUser.name} profile`}
            >
              {currentUser.name[0]}
            </Link>
            <button onClick={logout} className="hidden text-muted sm:block" aria-label="Log out">
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <div className="hidden items-center gap-2 sm:flex">
            <Link className="text-xs font-semibold" to="/login">
              {t('login')}
            </Link>
            <Link
              className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white"
              to="/register"
            >
              {t('signup')}
            </Link>
          </div>
        )}
        <button
          className="grid size-10 place-items-center lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <nav className="grid border-t border-line bg-surface px-5 py-3 lg:hidden">
          {links.map(([label, to]) => (
            <Link onClick={() => setOpen(false)} className="py-2 text-sm" to={to} key={to}>
              {label}
            </Link>
          ))}
          {!isAuthenticated && (
            <Link to="/login" className="py-2 text-sm text-brand">
              {t('login')} / {t('signup')}
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
