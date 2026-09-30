import { BookOpen, LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { getAccountHome, useAuth } from '../../context/AuthContext'
import { useLocale } from '../../context/LocaleContext'
export function PublicHeader() {
  const { resolvedTheme, setTheme } = useTheme()
  const { currentUser, isAuthenticated, hasRole, logout } = useAuth()
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const links = [
    [t('navigation.discover'), '//'],
    [t('navigation.categories'), '/categories'],
    [t('navigation.rankings'), '/rankings'],
  ].map(([label, to]) => [label, to === '//' ? '/' : to])
  if (isAuthenticated) links.push([t('navigation.library'), '/reader/library'])
  if (hasRole('author')) links.push([t('navigation.authorStudio'), '/author'])
  if (hasRole('moderator')) links.push([t('navigation.moderator'), '/moderator'])
  if (hasRole('admin')) links.push([t('navigation.admin'), '/admin'])
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
        <Link to="/search" aria-label={t('navigation.explore')} className="ml-auto hidden text-muted md:block">
          <Search size={19} />
        </Link>
        <button
          className="grid size-10 place-items-center rounded-full text-muted"
          aria-label={t('common.toggleTheme')}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        {isAuthenticated ? (
          <>
            <Link
              className="hidden sm:grid size-9 place-items-center rounded-full bg-brand text-sm font-semibold text-white"
              to={getAccountHome(currentUser)}
              aria-label={`${t('common.openProfile')}: ${currentUser.name}`}
            >
              {currentUser.name[0]}
            </Link>
            <button onClick={logout} className="hidden text-muted sm:block" aria-label={t('auth.logOut')}>
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <div className="hidden items-center gap-2 sm:flex">
            <Link className="text-xs font-semibold" to="/login">
              {t('auth.logIn')}
            </Link>
            <Link
              className="rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white"
              to="/register"
            >
              {t('auth.signUp')}
            </Link>
          </div>
        )}
        <button
          className="grid size-10 place-items-center lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label={t('common.openMenu')}
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
              {t('auth.logIn')} / {t('auth.signUp')}
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
