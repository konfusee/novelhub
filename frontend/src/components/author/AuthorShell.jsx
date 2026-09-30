import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  BookOpen,
  Bot,
  CirclePlus,
  CircleDollarSign,
  FileClock,
  FileText,
  Images,
  LayoutDashboard,
  PenLine,
  Send,
  X,
} from 'lucide-react'
import { Avatar, IconButton } from '../ui'
import { SiteFooter } from '../shared/SiteFooter'
import { SharedSidebarCommon, SharedWorkspaceHeader, WorkspaceSwitcher } from '../shared/RoleNavigation'

const navigation = [
  [
    'Overview',
    [
      ['Author Dashboard', '/author', LayoutDashboard],
      ['My Stories', '/author/stories/demo', BookOpen],
      ['Drafts', '/author/drafts', FileClock],
    ],
  ],
  [
    'Create',
    [
      ['New Story', '/author/stories/new', CirclePlus],
      ['Chapter Editor', '/author/stories/demo/chapters/chapter-1/edit', PenLine],
      ['Import PDF', '/author/import', FileText],
      ['Media Library', '/author/media', Images],
      ['AI Assistant', '/author/ai', Bot],
    ],
  ],
  [
    'Publish',
    [
      ['Submissions', '/author/submissions', Send],
      ['Analytics', '/author/analytics', BarChart3],
      ['Earnings & Payouts', '/author/earnings', CircleDollarSign],
    ],
  ],
]
function AuthorNav({ close }) {
  const { pathname } = useLocation()
  return (
    <div className="space-y-5">
      {navigation.map(([group, items]) => (
        <div key={group}>
          <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.2em] text-muted">
            {group}
          </p>
          <nav className="space-y-1">
            {items.map(([label, path, Icon]) => {
              const active =
                label === 'Author Dashboard'
                  ? pathname === '/author' || pathname === '/ui-preview/p17'
                  : label === 'Discover NovelHub'
                    ? pathname === '/'
                    : pathname.startsWith(path)
              return (
                <Link
                  onClick={close}
                  key={label}
                  to={path}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium ${active ? 'bg-brand text-white' : 'text-muted hover:bg-elevated hover:text-ink'} ${label === 'AI Assistant' ? 'text-purple' : ''}`}
                >
                  <Icon size={17} />
                  {label}
                  {label === 'AI Assistant' && (
                    <span className="ml-auto rounded-full bg-purple px-2 py-0.5 text-[8px] text-white">
                      PRO
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
export function AuthorShell({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link to="/author" className="mb-7 flex items-center gap-2 px-2 text-xl font-bold">
          <span className="grid size-9 place-items-center rounded-xl bg-brand text-white">
            <BookOpen size={20} />
          </span>
          <span>
            Novel<span className="text-brand">Hub</span>
            <small className="block text-[9px] font-medium text-orange">Studio Creator</small>
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <WorkspaceSwitcher currentRole="author" />
          <AuthorNav />
          <SharedSidebarCommon currentRole="author" />
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          <Avatar name="Mira Lane" />
          <div>
            <strong className="text-xs">Mira Lane</strong>
            <p className="text-[10px] text-brand">Verified Author · Lv.4</p>
          </div>
        </div>
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
          <strong>NovelHub Studio</strong>
          <IconButton label="Close" onClick={() => setOpen(false)}>
            <X size={18} />
          </IconButton>
        </div>
        <WorkspaceSwitcher currentRole="author" />
        <AuthorNav close={() => setOpen(false)} />
        <SharedSidebarCommon currentRole="author" onNavigate={() => setOpen(false)} />
      </aside>
      <div className="flex min-h-screen flex-col lg:pl-56">
        <SharedWorkspaceHeader currentRole="author" onOpenMenu={() => setOpen(true)} offsetClass="lg:left-56" />
        <main className="flex-1 pt-16">{children}</main>
        <SiteFooter />
      </div>
    </div>
  )
}
