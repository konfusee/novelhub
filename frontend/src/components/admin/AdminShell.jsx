import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  Bell,
  BookOpen,
  Boxes,
  FolderTree,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserCog,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, IconButton, Input } from '../ui'
import { SiteFooter } from '../shared/SiteFooter'
import { LanguageSwitcher } from '../shared/LanguageSwitcher'
import { WorkspaceHeaderAccount, WorkspaceSwitcher } from '../shared/RoleNavigation'

const groups = [
  [
    'Overview',
    [
      ['Dashboard', '/admin', LayoutDashboard],
    ],
  ],
  [
    'Access',
    [
      ['Users', '/admin/users', UsersRound],
      ['Roles & Permissions', '/admin/roles', UserCog],
    ],
  ],
  [
    'Content',
    [
      ['Categories & Taxonomy', '/admin/categories', FolderTree],
      ['Content Configuration', '/admin/content', SlidersHorizontal],
    ],
  ],
  [
    'Platform',
    [
      ['Services & Infrastructure', '/admin/services', Boxes],
      ['System Settings', '/admin/settings', Settings],
      ['Audit Logs', '/admin/audit-logs', History],
      ['Moderation Oversight', '/admin/moderation', ShieldCheck],
      ['Wallet Transactions', '/admin/transactions', WalletCards],
    ],
  ],
]
function Nav({ close }) {
  const { pathname } = useLocation()
  return (
    <div className="space-y-5">
      {groups.map(([group, items]) => (
        <div key={group}>
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-muted">
            {group}
          </p>
          <nav className="space-y-1">
            {items.map(([label, path, Icon]) => {
              const active =
                label === 'Dashboard'
                  ? pathname === '/admin' || pathname === '/ui-preview/p32'
                  : label === 'Discover NovelHub'
                    ? pathname === '/'
                    : pathname.startsWith(path) && !path.startsWith('#')
              return (
                <Link
                  key={`${group}-${label}`}
                  to={path}
                  onClick={close}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium ${active ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      ))}
    </div>
  )
}
export function AdminShell({ children }) {
  const [open, setOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link to="/admin" className="mb-6 flex items-center gap-2 px-2 text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <BookOpen size={19} />
          </span>
          <span>
            Novel<span className="text-brand">Hub</span>
            <small className="block text-[9px] font-medium text-muted">ADMIN CONSOLE</small>
          </span>
        </Link>
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-elevated p-3">
          <Avatar name="Marcus Vance" />
          <div>
            <strong className="block text-xs">Marcus Vance</strong>
            <p className="text-[9px] text-brand">Super Admin</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkspaceSwitcher currentRole="admin" />
          <Nav />
        </div>
        <p className="border-t border-line pt-4 text-[10px] text-muted">Security Center · v4.8.2</p>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-surface p-5 transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-5 flex justify-between">
          <strong>Admin Console</strong>
          <IconButton label="Close" onClick={() => setOpen(false)}>
            <X size={18} />
          </IconButton>
        </div>
        <WorkspaceSwitcher currentRole="admin" />
        <Nav close={() => setOpen(false)} />
      </aside>
      <div className="flex min-h-screen flex-col lg:pl-60">
        <header className="fixed left-0 right-0 top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 shadow-sm backdrop-blur lg:left-60 sm:px-6 xl:px-8">
          <IconButton label="Menu" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </IconButton>
          <div className="hidden sm:block">
            <p className="text-[9px] text-muted">Admin Console</p>
            <strong className="text-xs">Operations &amp; System Health</strong>
          </div>
          <span className="hidden items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-xs text-brand md:flex">
            <Activity size={14} />
            All Core Systems Operational
          </span>
          <Input
            icon={Search}
            placeholder="Global admin search..."
            className="ml-auto hidden w-60 xl:flex"
          />
          <IconButton label="Notifications">
            <Bell size={17} />
          </IconButton>
          <LanguageSwitcher compact />
          <WorkspaceHeaderAccount />
          <IconButton
            label="Theme"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </IconButton>
        </header>
        <main className="flex-1 pt-16">{children}</main>
        <SiteFooter />
      </div>
    </div>
  )
}
