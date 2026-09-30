import { Bell, BookOpen, ChevronDown, Crown, HelpCircle, LogOut, Menu, Moon, Search, Settings, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ROLE_HOME, useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, IconButton, Input } from '../ui'
import { LanguageSwitcher } from './LanguageSwitcher'

const roleMeta = {
  reader: ['Reader', BookOpen],
  author: ['Author Studio', UserRound],
  moderator: ['Moderator', ShieldCheck],
  admin: ['Admin', Crown],
}

export function WorkspaceSwitcher({ currentRole }) {
  const { roles } = useAuth()
  const available = roles.filter(role => roleMeta[role])
  if (available.length < 2) return null

  return (
    <details className="group relative mb-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-semibold">
        Switch workspace
        <ChevronDown size={14} className="ml-auto transition group-open:rotate-180" />
      </summary>
      <div className="mt-2 grid gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
        {available.map(role => {
          const [label, Icon] = roleMeta[role]
          return (
            <Link
              key={role}
              to={ROLE_HOME[role]}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${role === currentRole ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}
            >
              <Icon size={15} /> {label}
            </Link>
          )
        })}
      </div>
    </details>
  )
}

export function RoleHeaderLinks({ includeWallet = false, currentRole = 'reader' }) {
  const suffix = `?workspace=${currentRole}`
  const walletPath = currentRole === 'author' ? '/author/wallet' : '/reader/wallet'
  return (
    <nav className="hidden items-center gap-4 text-xs font-medium text-muted xl:flex">
      <Link className="hover:text-brand" to={`/?workspace=${currentRole}`}>Discover</Link>
      <Link className="hover:text-brand" to={`/categories${suffix}`}>Categories</Link>
      <Link className="hover:text-brand" to={`/rankings${suffix}`}>Rankings</Link>
      <Link className="hover:text-brand" to={`/search${suffix}`}>Explore</Link>
      <Link className="hover:text-brand" to="/reader/library">Library</Link>
      {includeWallet && <Link className="hover:text-brand" to={walletPath}>Wallet</Link>}
    </nav>
  )
}

export function WorkspaceHeaderAccount() {
  const { currentUser, logout } = useAuth()
  return (
    <div className="flex items-center gap-2">
      <Link to="/reader/profile" aria-label="Open reader profile" className="rounded-full">
        <Avatar name={currentUser?.name || 'NovelHub user'} className="size-9 text-xs" />
      </Link>
      <IconButton label="Log out" onClick={logout} className="size-9 rounded-xl">
        <LogOut size={16} />
      </IconButton>
    </div>
  )
}

const commonPaths = role => ({
  profile: role === 'reader' ? '/reader/profile' : `/${role}/profile`,
  settings: `/${role}/settings`,
  account: `/${role}/account`,
  support: `/${role}/support`,
})

export function SharedSidebarCommon({ currentRole, onNavigate }) {
  const { pathname } = useLocation()
  const paths = commonPaths(currentRole)
  const items = [
    ['Profile', paths.profile, UserRound],
    ['Settings', paths.settings, Settings],
    ['Account', paths.account, ShieldCheck],
    ['Help & Support', paths.support, HelpCircle],
  ]
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-muted">Account</p>
      <nav className="space-y-1">
        {items.map(([label, path, Icon]) => (
          <Link
            key={label}
            to={path}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium ${pathname.startsWith(path) ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}
          >
            <Icon size={17} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function SharedWorkspaceHeader({ currentRole, onOpenMenu, offsetClass = '', children }) {
  const { resolvedTheme, setTheme } = useTheme()
  const walletPath = currentRole === 'author' ? '/author/wallet' : '/reader/wallet'
  return (
    <header className={`fixed left-0 right-0 top-0 z-30 border-b border-line bg-surface/95 shadow-sm backdrop-blur transition-[left,right] ${offsetClass}`}>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
        <IconButton label="Open menu" className="lg:hidden" onClick={onOpenMenu}><Menu size={19} /></IconButton>
        <Input icon={Search} placeholder="Search stories, authors, tags..." className="hidden w-full max-w-md sm:flex" />
        <div className="ml-auto"><RoleHeaderLinks includeWallet currentRole={currentRole} /></div>
        <Link to={walletPath} className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold sm:flex">
          <span className="text-orange">●</span> 450 coins <span className="text-brand">+</span>
        </Link>
        <IconButton label="Toggle theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <LanguageSwitcher compact />
        {children}
        <IconButton label="Notifications" className="relative hidden sm:grid">
          <Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full bg-rose" />
        </IconButton>
        <WorkspaceHeaderAccount />
      </div>
      <div className="px-4 pb-3 sm:hidden"><Input icon={Search} placeholder="Search stories..." /></div>
    </header>
  )
}
