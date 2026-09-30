import { Bell, BookOpen, ChevronDown, Crown, HelpCircle, LogOut, Menu, Moon, Search, Settings, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { ROLE_HOME, useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, IconButton, Input } from '../ui'
import { useLocale } from '../../context/LocaleContext'

const roleMeta = {
  reader: ['navigation.reader', BookOpen],
  author: ['navigation.authorStudio', UserRound],
  moderator: ['navigation.moderator', ShieldCheck],
  admin: ['navigation.admin', Crown],
}

const workspaceAccent = {
  reader: 'bg-brand/10 text-brand',
  author: 'bg-orange/15 text-orange',
  moderator: 'bg-purple/15 text-purple',
  admin: 'bg-rose/15 text-rose',
}

const workspaceActive = {
  reader: 'bg-brand text-white',
  author: 'bg-orange text-white',
  moderator: 'bg-purple text-white',
  admin: 'bg-rose text-white',
}

export function WorkspaceSwitcher({ currentRole, compact = false }) {
  const { t } = useLocale()
  const { roles } = useAuth()
  const available = roles.filter(role => roleMeta[role])
  const workspaces = available.length ? available : [currentRole]

  return (
    <details className="group relative mb-4">
      <summary title={compact ? t('common.switchWorkspace') : undefined} aria-label={t('common.switchWorkspace')} className={`flex cursor-pointer list-none items-center rounded-xl border border-line bg-elevated text-xs font-semibold ${compact ? 'mx-auto size-10 justify-center' : 'gap-2 px-3 py-2'}`}>
        {!compact && t('common.switchWorkspace')}
        <ChevronDown size={14} className={`${compact ? '' : 'ml-auto'} transition group-open:rotate-180`} />
      </summary>
      <div className={`${compact ? 'absolute left-full top-0 z-50 ml-3 w-52' : 'mt-2'} grid gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-lg`}>
        {workspaces.map(role => {
          const [labelKey, Icon] = roleMeta[role]
          return (
            <Link
              key={role}
              to={ROLE_HOME[role]}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${role === currentRole ? workspaceActive[role] : 'text-muted hover:bg-elevated hover:text-ink'}`}
            >
              <Icon size={15} /> {t(labelKey)}
            </Link>
          )
        })}
      </div>
    </details>
  )
}

export function RoleHeaderLinks({ includeWallet = false, currentRole = 'reader' }) {
  const { t } = useLocale()
  const suffix = `?workspace=${currentRole}`
  const walletPath = currentRole === 'author' ? '/author/earnings' : '/reader/wallet'
  return (
    <nav className="hidden items-center gap-4 text-xs font-medium text-muted xl:flex">
      <Link className="hover:text-brand" to={`/?workspace=${currentRole}`}>{t('navigation.discover')}</Link>
      <Link className="hover:text-brand" to={`/categories${suffix}`}>{t('navigation.categories')}</Link>
      <Link className="hover:text-brand" to={`/rankings${suffix}`}>{t('navigation.rankings')}</Link>
      <Link className="hover:text-brand" to={`/search${suffix}`}>{t('navigation.explore')}</Link>
      <Link className="hover:text-brand" to="/reader/library">{t('navigation.library')}</Link>
      {includeWallet && <Link className="hover:text-brand" to={walletPath}>{t('navigation.wallet')}</Link>}
    </nav>
  )
}

export function WorkspaceHeaderAccount() {
  const { t } = useLocale()
  const { currentUser, logout } = useAuth()
  return (
    <div className="flex items-center gap-2">
      <Link to="/reader/profile" aria-label={t('common.openProfile')} className="rounded-full">
        <Avatar name={currentUser?.name || 'NovelHub user'} className="size-9 text-xs" />
      </Link>
      <IconButton label={t('auth.logOut')} onClick={logout} className="size-9 rounded-xl">
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
  const { t } = useLocale()
  const { pathname } = useLocation()
  const paths = commonPaths(currentRole)
  const items = [
    ['navigation.profile', paths.profile, UserRound],
    ['navigation.settings', paths.settings, Settings],
    ['navigation.account', paths.account, ShieldCheck],
    ['common.helpSupport', paths.support, HelpCircle],
  ]
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-muted">{t('navigation.account')}</p>
      <nav className="space-y-1">
        {items.map(([label, path, Icon]) => (
          <Link
            key={label}
            to={path}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium ${pathname.startsWith(path) ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}
          >
            <Icon size={17} /> {t(label)}
          </Link>
        ))}
      </nav>
    </div>
  )
}

export function SharedWorkspaceHeader({ currentRole, workspaceLabel, onOpenMenu, offsetClass = '', children }) {
  const { t } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const walletPath = currentRole === 'author' ? '/author/wallet' : '/reader/wallet'
  return (
    <header data-app-header className={`fixed left-0 right-0 top-0 z-30 border-b border-line bg-surface/95 shadow-sm backdrop-blur transition-[left,right] ${offsetClass}`}>
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
        <IconButton label={t('common.openMenu')} className="md:hidden" onClick={onOpenMenu}><Menu size={19} /></IconButton>
        <Input icon={Search} placeholder={t('common.searchStoriesAuthorsTags')} className="hidden w-full max-w-md sm:flex" />
        <span className={`hidden max-w-48 shrink-0 truncate rounded-full px-3 py-1.5 text-center text-[10px] font-semibold md:block ${workspaceAccent[currentRole] || workspaceAccent.reader}`}>{workspaceLabel} · {t('common.workspace')}</span>
        <div className="ml-auto"><RoleHeaderLinks includeWallet currentRole={currentRole} /></div>
        <Link to={walletPath} className="hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold sm:flex">
          <span className="text-orange">●</span> {t('wallet.coins', { count: 450 })} <span className="text-brand">+</span>
        </Link>
        <IconButton label={t('common.toggleTheme')} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        {children}
        <IconButton label={t('common.notifications')} className="relative hidden sm:grid">
          <Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full bg-rose" />
        </IconButton>
        <WorkspaceHeaderAccount />
      </div>
      <div className="px-4 pb-3 sm:hidden"><Input icon={Search} placeholder={t('common.searchStories')} /></div>
    </header>
  )
}
