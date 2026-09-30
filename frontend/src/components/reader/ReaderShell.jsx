import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  BookHeart,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Compass,
  Flame,
  Headphones,
  History,
  Home,
  Library,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PenLine,
  PanelLeft,
  PanelRight,
  Search,
  Settings,
  Sun,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { Avatar, IconButton, Input } from '../ui'
import { SiteFooter } from '../shared/SiteFooter'
import { LanguageSwitcher } from '../shared/LanguageSwitcher'
import { RoleHeaderLinks, WorkspaceSwitcher } from '../shared/RoleNavigation'

const navigation = [
  ['Home', '/reader', Home],
  ['Discover NovelHub', '/', Compass],
  ['Explore', '/reader/explore', Search],
  ['Library', '/reader/library', Library],
  ['My List', '/reader/following', BookHeart],
  ['Audiobooks', '/reader/audiobooks', Headphones],
  ['History', '/reader/history', History],
  ['Notifications', '/reader/notifications', Bell],
  ['Messages', '/reader/messages', MessageCircle],
  ['Wallet', '/reader/wallet', WalletCards],
  ['Profile', '/reader/profile', UserRound],
  ['Settings', '/reader/settings', Settings],
]

function NavItems({ onNavigate }) {
  const { pathname } = useLocation()
  const { hasRole } = useAuth()
  const items = hasRole('author')
    ? [...navigation, ['Creator Studio', '/author', PenLine]]
    : navigation
  return (
    <nav className="space-y-1">
      {items.map(([label, href, Icon]) => {
        const active =
          label === 'Home'
            ? pathname === '/reader' || pathname === '/ui-preview/p08'
            : label === 'Discover NovelHub'
              ? pathname === '/'
              : pathname.startsWith(href)
        return (
          <Link
            key={label}
            to={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-elevated hover:text-ink'}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function ReaderShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('novelhub.readerSidebarCollapsed') === 'true',
  )
  const [sidebarPosition, setSidebarPosition] = useState(
    () => localStorage.getItem('novelhub.readerSidebarPosition') || 'left',
  )
  const { resolvedTheme, setTheme } = useTheme()
  const { currentUser, logout } = useAuth()
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  const toggleSidebar = () => {
    setCollapsed(current => {
      localStorage.setItem('novelhub.readerSidebarCollapsed', String(!current))
      return !current
    })
  }
  const updateSidebarPosition = position => {
    localStorage.setItem('novelhub.readerSidebarPosition', position)
    setSidebarPosition(position)
    setLayoutOpen(false)
  }
  const sidebarHidden = sidebarPosition === 'hidden'
  const desktopSidebarSide = sidebarPosition === 'right' ? 'right-0 border-l' : 'left-0 border-r'
  const contentSpacing = sidebarHidden
    ? ''
    : sidebarPosition === 'right'
      ? collapsed
        ? 'lg:pr-20'
        : 'lg:pr-56'
      : collapsed
        ? 'lg:pl-20'
        : 'lg:pl-56'
  const headerSpacing = sidebarHidden
    ? ''
    : sidebarPosition === 'right'
      ? collapsed
        ? 'lg:right-20'
        : 'lg:right-56'
      : collapsed
        ? 'lg:left-20'
        : 'lg:left-56'
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className={`fixed inset-y-0 z-40 hidden flex-col border-line bg-surface p-4 transition-[width] ${sidebarHidden ? 'lg:hidden' : 'lg:flex'} ${desktopSidebarSide} ${collapsed ? 'w-20' : 'w-56'}`}>
        <Link to="/reader" className="mb-7 flex items-center gap-2 px-2 text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <BookOpen size={21} />
          </span>
          <span className={collapsed ? 'hidden' : ''}>
            Novel<span className="text-brand">Hub</span>
          </span>
        </Link>
        {!collapsed && <WorkspaceSwitcher currentRole="reader" />}
        <div className={collapsed ? '[&_span]:hidden [&_a]:justify-center [&_a]:px-2' : ''}><NavItems /></div>
        <div className={`mt-auto rounded-2xl border border-line bg-elevated p-4 ${collapsed ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Flame className="text-orange" size={18} /> Keep it going!
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            You are 12 minutes from today&apos;s reading goal.
          </p>
          <div className="mt-3 h-1.5 rounded-full bg-line">
            <div className="h-full w-[78%] rounded-full bg-brand" />
          </div>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className={`absolute top-20 grid size-7 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm hover:text-brand ${sidebarPosition === 'right' ? '-left-3' : '-right-3'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            sidebarPosition === 'right' ? <ChevronLeft size={15} /> : <ChevronRight size={15} />
          ) : sidebarPosition === 'right' ? (
            <ChevronRight size={15} />
          ) : (
            <ChevronLeft size={15} />
          )}
        </button>
      </aside>

      {menuOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface p-5 shadow-2xl transition-transform lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <strong className="text-xl">
            Novel<span className="text-brand">Hub</span>
          </strong>
          <IconButton label="Close menu" onClick={() => setMenuOpen(false)}>
            <X size={19} />
          </IconButton>
        </div>
        <WorkspaceSwitcher currentRole="reader" />
        <NavItems onNavigate={() => setMenuOpen(false)} />
      </aside>

      <div className={`flex min-h-screen flex-col transition-[padding] ${contentSpacing}`}>
        <header className={`fixed left-0 right-0 top-0 z-30 border-b border-line bg-page/95 shadow-sm backdrop-blur transition-[left,right] ${headerSpacing}`}>
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
            <IconButton label="Open menu" className="lg:hidden" onClick={() => setMenuOpen(true)}>
              <Menu size={20} />
            </IconButton>
            <Input
              icon={Search}
              placeholder="Search stories, authors, tags..."
              className="hidden w-full max-w-md sm:flex"
            />
            <div className="ml-auto"><RoleHeaderLinks includeWallet currentRole="reader" /></div>
            <Link to="/reader/wallet" className="ml-auto hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold sm:flex xl:ml-0">
              <span className="text-orange">●</span> 450 coins <span className="text-brand">+</span>
            </Link>
            <IconButton label="Toggle theme" onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <LanguageSwitcher compact />
            <div className="relative">
              <IconButton label="Layout settings" onClick={() => setLayoutOpen(open => !open)}>
                <Settings size={18} />
              </IconButton>
              {layoutOpen && (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-line bg-surface p-3 shadow-xl">
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Sidebar position
                  </p>
                  {[
                    ['left', 'Left', PanelLeft],
                    ['right', 'Right', PanelRight],
                    ['hidden', 'Hidden', X],
                  ].map(([value, label, Icon]) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() => updateSidebarPosition(value)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs ${sidebarPosition === value ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <IconButton label="Bookmarks" className="hidden sm:grid">
              <Bookmark size={18} />
            </IconButton>
            <IconButton label="Notifications" className="relative hidden sm:grid">
              <Bell size={18} />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-rose" />
            </IconButton>
            <Link to="/reader/profile" className="flex items-center gap-2">
              <Avatar name={currentUser?.name || 'Reader'} />
              <span className="hidden text-left xl:block">
                <strong className="block text-xs">{currentUser?.name || 'Reader'}</strong>
                <span className="flex items-center gap-1 text-[10px] text-muted">
                  <Flame size={11} className="text-orange" /> 18 day streak
                </span>
              </span>
              <ChevronDown size={15} className="hidden text-muted xl:block" />
            </Link>
            <IconButton label="Log out" onClick={logout}>
              <LogOut size={18} />
            </IconButton>
          </div>
          <div className="px-4 pb-3 sm:hidden">
            <Input icon={Search} placeholder="Search stories..." />
          </div>
        </header>
        <main className="flex-1 pt-[7rem] sm:pt-16">{children}</main>
        <SiteFooter />
      </div>
    </div>
  )
}
