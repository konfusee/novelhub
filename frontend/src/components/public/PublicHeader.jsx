import { NovelHubMark, LogOut, Menu, Moon, Search, Sun, X } from '../icons';
import { Link, NavLink, useLocation } from 'react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { getAccountHome, useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { ROUTES } from '../../app/routes';
import { ButtonLink } from '../ui';

export function PublicHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const { currentUser, isAuthenticated, hasRole, logout } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);
  const { pathname } = useLocation();
  // The auth page has its own login/register switch; repeating it in the header is noise.
  const onAuthRoute = ['/join', '/login', '/register'].includes(pathname);
  const menuId = useId();
  // Close the mobile menu when the route changes (render-phase sync, no effect needed).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // A tap anywhere outside the header island and its menu closes the menu.
    const onPointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);
  const links = [
    [t('navigation.discover'), '/'],
    [t('navigation.categories'), '/categories'],
    [t('navigation.rankings'), '/rankings'],
  ];
  if (isAuthenticated) links.push([t('navigation.library'), '/reader/library']);
  if (hasRole('reader') && !hasRole('author'))
    links.push([t('navigation.becomeAuthor'), ROUTES.authorApply]);
  if (hasRole('author')) links.push([t('navigation.authorStudio'), '/author']);
  if (hasRole('moderator')) links.push([t('navigation.moderator'), '/moderator']);
  if (hasRole('admin')) links.push([t('navigation.admin'), '/admin']);
  return (
    <header ref={headerRef} className="sticky top-0 z-40 px-3 pt-3 sm:px-4 md:px-6 lg:px-10">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-2 rounded-full border border-hairline bg-surface/80 pl-3 pr-2 shadow-soft backdrop-blur-xl sm:gap-3 sm:pl-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-bold sm:text-xl">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-on-brand shadow-[0_8px_20px_-12px_var(--primary)]">
            <NovelHubMark size={19} />
          </span>
          <span>
            Novel<span className="text-brand">Hub</span>
          </span>
        </Link>
        <nav
          aria-label={t('common.mainNavigation')}
          className="ml-2 hidden items-center gap-1 lg:flex"
        >
          {links.map(([label, to]) => (
            <NavLink
              className={({ isActive }) =>
                `rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${isActive ? 'bg-brand/10 font-semibold text-brand-strong' : 'text-muted hover:bg-elevated hover:text-ink'}`
              }
              to={to}
              end={to === '/'}
              key={to}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            to="/search"
            aria-label={t('navigation.explore')}
            className="hidden size-10 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-ink md:grid"
          >
            <Search size={19} />
          </Link>
          <button
            type="button"
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-ink"
            aria-label={t('common.toggleTheme')}
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          {isAuthenticated ? (
            <>
              <Link
                className="hidden size-9 place-items-center rounded-full bg-brand text-sm font-semibold text-on-brand ring-2 ring-transparent transition-shadow hover:ring-brand/30 sm:grid"
                to={getAccountHome(currentUser)}
                aria-label={`${t('common.openProfile')}: ${currentUser.name}`}
              >
                {currentUser.name[0]}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="hidden size-10 place-items-center rounded-full text-muted transition-colors hover:bg-elevated hover:text-ink sm:grid"
                aria-label={t('auth.logOut')}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : onAuthRoute ? null : (
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                className="rounded-full px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-elevated"
                to="/login"
              >
                {t('auth.logIn')}
              </Link>
              <ButtonLink to="/register" size="sm" className="min-h-10">
                {t('auth.signUp')}
              </ButtonLink>
            </div>
          )}
          <button
            type="button"
            aria-label={t(open ? 'common.closeMenu' : 'common.openMenu')}
            aria-expanded={open}
            aria-controls={menuId}
            className="grid size-10 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-elevated lg:hidden"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id={menuId}
          aria-label={t('common.mainNavigation')}
          className="nh-dialog-enter mx-auto mt-2 grid max-w-[1360px] gap-1 rounded-3xl border border-hairline bg-surface/95 p-2 shadow-float backdrop-blur-xl lg:hidden"
        >
          {links.map(([label, to]) => (
            <NavLink
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${isActive ? 'bg-brand/10 font-semibold text-brand-strong' : 'text-ink hover:bg-elevated'}`
              }
              to={to}
              end={to === '/'}
              key={to}
            >
              {label}
            </NavLink>
          ))}
          {!isAuthenticated && !onAuthRoute && (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-sm font-semibold text-brand-strong hover:bg-elevated sm:hidden"
            >
              {t('auth.logIn')} / {t('auth.signUp')}
            </Link>
          )}
          {isAuthenticated && (
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium text-muted hover:bg-elevated hover:text-ink sm:hidden"
            >
              <LogOut size={16} /> {t('auth.logOut')}
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
