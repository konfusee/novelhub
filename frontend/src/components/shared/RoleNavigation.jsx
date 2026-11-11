import {
  Bell,
  BookOpen,
  ChevronDown,
  Coins,
  Crown,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
} from '../icons'
import { Link, useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import { ROLE_HOME, useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, IconButton, Input } from '../ui'
import { useLocale } from '../../context/LocaleContext'
import { workspaceHeaderNavigation, workspaceWallets } from '../../navigation/workspaceNavigation'
import { useWorkspaceBalance } from '../../api/useWorkspaceBalance'
import { ROUTES } from '../../app/routes'

const roleMeta = {
  reader: ['navigation.reader', BookOpen],
  author: ['navigation.authorStudio', UserRound],
  moderator: ['navigation.moderator', ShieldCheck],
  admin: ['navigation.admin', Crown],
}

const workspaceAccent = {
  reader: 'bg-brand/10 text-brand-strong ring-brand/20',
  author: 'bg-orange/16 text-orange-strong ring-orange/28',
  moderator: 'bg-purple/12 text-purple-strong ring-purple/22',
  admin: 'bg-rose/14 text-rose-strong ring-rose/25',
}

const workspaceActive = {
  reader: 'bg-brand text-on-brand',
  author: 'bg-orange text-on-orange',
  moderator: 'bg-purple text-on-purple',
  admin: 'bg-rose text-on-rose',
}

export function WorkspaceSwitcher({ currentRole, compact = false }) {
  const { t } = useLocale()
  const { roles } = useAuth()
  const available = roles.filter(role => roleMeta[role])
  const workspaces = available.length ? available : [currentRole]

  return (
    <details className="group relative mb-4">
      <summary
        title={compact ? t('common.switchWorkspace') : undefined}
        aria-label={t('common.switchWorkspace')}
        className={`flex cursor-pointer list-none items-center rounded-full border border-line bg-elevated text-xs font-semibold text-ink transition-colors hover:border-brand/50 [&::-webkit-details-marker]:hidden ${compact ? 'mx-auto size-10 justify-center' : 'min-h-10 gap-2 px-4 py-2'}`}
      >
        {!compact && <span className="truncate">{t('common.switchWorkspace')}</span>}
        <ChevronDown
          size={14}
          className={`${compact ? '' : 'ml-auto'} shrink-0 transition-transform duration-200 group-open:rotate-180`}
        />
      </summary>
      <div
        className={`${compact ? 'absolute left-full top-0 z-50 ml-3 w-56' : 'mt-2'} grid gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-float`}
      >
        {workspaces.map(role => {
          const [labelKey, Icon] = roleMeta[role]
          return (
            <Link
              key={role}
              to={ROLE_HOME[role]}
              aria-current={role === currentRole ? 'true' : undefined}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium transition-colors ${role === currentRole ? workspaceActive[role] : 'text-muted hover:bg-elevated hover:text-ink'}`}
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
  const { pathname } = useLocation()
  const wallet = workspaceWallets[currentRole]
  const items = [...(workspaceHeaderNavigation[currentRole] ?? [])]
  if (includeWallet && wallet)
    items.push([
      wallet.labelKey,
      wallet.path,
      currentRole === 'author' ? [wallet.path, '/author/wallet'] : [wallet.path],
      true,
    ])
  return (
    <nav
      aria-label={t('workspaceHeader.navigation')}
      className="hidden shrink-0 items-center gap-1 text-xs font-medium text-muted xl:flex"
    >
      {items.map(([label, path, matches, wideOnly, exact]) => {
        const active = matches.some(
          match =>
            pathname === match || (!exact && match !== '/' && pathname.startsWith(`${match}/`)),
        )
        return (
          <Link
            key={label}
            aria-current={active ? 'page' : undefined}
            className={`${wideOnly ? 'hidden 2xl:flex' : 'flex'} h-9 items-center border-b-2 px-2.5 transition-colors ${active ? 'border-brand font-semibold text-brand-strong' : 'border-transparent hover:text-ink'}`}
            to={path}
          >
            {t(label)}
          </Link>
        )
      })}
    </nav>
  )
}

export function WorkspaceHeaderAccount({ currentRole = 'reader' }) {
  const { t } = useLocale()
  const { currentUser, logout } = useAuth()
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        to={commonPaths(currentRole).profile}
        aria-label={t('common.openProfile')}
        className="rounded-full ring-2 ring-transparent transition-shadow hover:ring-brand/30"
      >
        <Avatar
          name={currentUser?.name || 'Người dùng NovelHub'}
          className="size-9 text-xs pointer-coarse:size-11"
        />
      </Link>
      <IconButton label={t('auth.logOut')} onClick={logout} shape="circle" size="sm">
        <LogOut size={16} />
      </IconButton>
    </div>
  )
}

const commonPaths = role => ({
  profile: role === 'reader' ? '/reader/profile' : `/${role}/profile`,
})

export function SharedWorkspaceHeader({
  currentRole,
  workspaceLabel,
  onOpenMenu,
  offsetClass = '',
  children,
}) {
  const { t, formatNumber } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const wallet = workspaceWallets[currentRole]
  const balance = useWorkspaceBalance(currentRole)
  const walletActive =
    wallet &&
    (pathname === wallet.path || (currentRole === 'author' && pathname === '/author/wallet'))
  return (
    <header
      data-app-header
      className={`fixed left-0 right-0 top-0 z-30 border-b border-hairline bg-surface/80 shadow-whisper backdrop-blur-xl transition-[left,right] ${offsetClass}`}
    >
      <div className="flex h-16 min-w-0 items-center gap-2 px-4 sm:gap-3 sm:px-6 xl:px-8">
        <IconButton
          label={t('common.openMenu')}
          shape="circle"
          className="md:hidden"
          onClick={onOpenMenu}
        >
          <Menu size={19} />
        </IconButton>
        <HeaderSearch
          currentRole={currentRole}
          placeholder={t('common.searchStoriesAuthorsTags')}
          className="hidden min-w-0 flex-1 sm:flex lg:max-w-md"
        />
        <span
          title={`${workspaceLabel} · ${t('common.workspace')}`}
          className={`hidden shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-inset 2xl:block ${workspaceAccent[currentRole] || workspaceAccent.reader}`}
        >
          {workspaceLabel}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <RoleHeaderLinks includeWallet currentRole={currentRole} />
        </div>
        {wallet && (
          <Link
            to={wallet.path}
            aria-current={walletActive ? 'page' : undefined}
            aria-busy={balance.status === 'loading'}
            aria-label={t(
              balance.status === 'ready'
                ? 'workspaceHeader.balance'
                : balance.status === 'error'
                  ? 'workspaceHeader.balanceError'
                  : 'workspaceHeader.balanceLoading',
              {
                wallet: t(wallet.labelKey),
                count: balance.balance === null ? '—' : formatNumber(balance.balance),
              },
            )}
            className={`hidden h-11 shrink-0 items-center gap-2 rounded-full border pl-3 text-xs font-semibold transition-colors md:flex ${wallet.topUp ? 'pr-1.5' : 'pr-3'} ${walletActive ? 'border-brand bg-brand/10 text-brand-strong' : 'border-line bg-surface text-ink hover:border-brand'}`}
          >
            <Coins size={16} className="text-orange" aria-hidden="true" />
            <span aria-live="polite">
              {balance.status === 'ready'
                ? t('wallet.coins', { count: formatNumber(balance.balance) })
                : balance.status === 'loading'
                  ? '…'
                  : '—'}
            </span>
            {wallet.topUp && (
              <span
                data-wallet-top-up
                aria-hidden="true"
                className="grid size-7 place-items-center rounded-full bg-brand/10 text-brand-strong"
              >
                <Plus size={14} />
              </span>
            )}
          </Link>
        )}
        <IconButton
          label={t('common.toggleTheme')}
          shape="circle"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        {children}
        <IconButton
          label={t('common.notifications')}
          shape="circle"
          className="relative"
          onClick={() => navigate(ROUTES.workspaceNotifications(currentRole))}
        >
          <Bell size={18} />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-rose ring-2 ring-surface" />
        </IconButton>
        <WorkspaceHeaderAccount currentRole={currentRole} />
      </div>
      <div className="h-14 px-4 sm:hidden">
        <HeaderSearch currentRole={currentRole} placeholder={t('common.searchStories')} />
      </div>
    </header>
  )
}

/* Header search: a real search landmark that opens results inside the current workspace. */
function HeaderSearch({ currentRole, placeholder, className }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  return (
    <form
      role="search"
      className={className}
      onSubmit={event => {
        event.preventDefault()
        const q = query.trim()
        navigate(`/search?${new URLSearchParams({ ...(q && { q }), workspace: currentRole })}`)
      }}
    >
      <Input
        icon={Search}
        type="search"
        enterKeyHint="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={query}
        onChange={event => setQuery(event.target.value)}
        className="w-full"
      />
    </form>
  )
}
