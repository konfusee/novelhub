import { BookOpen, ChevronDown, Crown, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROLE_HOME, useAuth } from '../../context/AuthContext'
import { Avatar, IconButton } from '../ui'

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
