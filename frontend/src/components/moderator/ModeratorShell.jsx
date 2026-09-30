import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Compass,
  FileSearch,
  Flag,
  Gauge,
  History,
  Menu,
  Moon,
  Scale,
  Search,
  ShieldAlert,
  Sun,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, IconButton, Input } from '../ui'
import { SiteFooter } from '../shared/SiteFooter'
import { LanguageSwitcher } from '../shared/LanguageSwitcher'

const groups = [
  [
    'Moderation',
    [
      ['Overview', '/moderator', Gauge],
      ['Discover NovelHub', '/', Compass],
      ['Submission Queue', '/moderator/submissions', ClipboardCheck],
      ['Content Reviews', '/moderator/submissions/demo', FileSearch],
      ['Reports', '/moderator/reports', Flag],
      ['Similarity Flags', '/moderator/similarity-review/demo', ShieldAlert],
    ],
  ],
  [
    'History',
    [
      ['Decisions', '/moderator/submissions', UserRoundCheck],
      ['Escalations', '/moderator/reports', Scale],
      ['Audit Trail', '/moderator/submissions', History],
    ],
  ],
]
function Nav({ close }) {
  const { pathname } = useLocation()
  return (
    <div className="space-y-6">
      {groups.map(([group, items]) => (
        <div key={group}>
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-muted">
            {group}
          </p>
          <nav className="space-y-1">
            {items.map(([label, path, Icon]) => {
              const active =
                label === 'Overview'
                  ? pathname === '/moderator' || pathname === '/ui-preview/p27'
                  : label === 'Discover NovelHub'
                    ? pathname === '/'
                    : pathname.startsWith(path)
              return (
                <Link
                  key={label}
                  to={path}
                  onClick={close}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium ${active ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'}`}
                >
                  <Icon size={16} />
                  {label}
                  {['Submission Queue', 'Content Reviews', 'Reports', 'Similarity Flags'].includes(
                    label,
                  ) && (
                    <span className="ml-auto rounded-full bg-elevated px-2 py-0.5 text-[9px] text-muted">
                      {label === 'Submission Queue'
                        ? 24
                        : label === 'Content Reviews'
                          ? 8
                          : label === 'Reports'
                            ? 15
                            : 6}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
      ))}
    </div>
  )
}
export function ModeratorShell({ children }) {
  const [open, setOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link to="/moderator" className="mb-6 flex items-center gap-2 px-2 text-lg font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <BookOpen size={19} />
          </span>
          <span>
            NovelHub
            <small className="block text-[9px] font-medium text-brand">Moderator Console</small>
          </span>
        </Link>
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-elevated p-3">
          <Avatar name="Sarah Jenkins" />
          <div className="min-w-0">
            <strong className="block truncate text-xs">Sarah Jenkins</strong>
            <p className="truncate text-[9px] text-brand">Safety Lead · On Duty</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Nav />
        </div>
        <p className="border-t border-line pt-4 text-[10px] text-muted">
          Shift 03h 45m · SLA 98.4%
        </p>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-surface p-5 transition-transform lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="mb-5 flex justify-between">
          <strong>Moderator Console</strong>
          <IconButton label="Close" onClick={() => setOpen(false)}>
            <X size={18} />
          </IconButton>
        </div>
        <Nav close={() => setOpen(false)} />
      </aside>
      <div className="flex min-h-screen flex-col lg:pl-56">
        <header className="fixed left-0 right-0 top-0 z-30 flex min-h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 shadow-sm backdrop-blur lg:left-56 sm:px-6 xl:px-8">
          <IconButton label="Menu" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={18} />
          </IconButton>
          <div className="hidden sm:block">
            <p className="text-[9px] text-muted">Moderator Console</p>
            <strong className="text-xs">Overview &amp; Operations Hub</strong>
          </div>
          <Input
            icon={Search}
            placeholder="Search submission ID..."
            className="ml-auto hidden w-64 md:flex"
          />
          <button className="hidden rounded-xl border border-line px-3 py-2 text-xs sm:block">
            All Priority
          </button>
          <IconButton label="Notifications">
            <Bell size={17} />
          </IconButton>
          <LanguageSwitcher compact />
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
