import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, BookHeart, BookOpen, Bookmark, ChevronDown, Flame, Headphones, History, Home, Library, Menu, MessageCircle, Moon, Search, Settings, Sun, UserRound, WalletCards, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { Avatar, IconButton, Input } from '../ui'

const navigation = [
  ['Home', '/reader', Home], ['Explore', '/search', Search], ['Library', '/reader/library', Library],
  ['My List', '/reader/following', BookHeart], ['Audiobooks', '/listen/demo/chapter-1', Headphones],
  ['History', '/reader/history', History], ['Notifications', '/reader/notifications', Bell],
  ['Messages', '#messages', MessageCircle], ['Wallet', '/reader/wallet', WalletCards],
  ['Profile', '/reader/profile', UserRound], ['Settings', '/reader/profile', Settings],
]

function NavItems({ onNavigate }) {
  const { pathname } = useLocation()
  return <nav className="space-y-1">{navigation.map(([label, href, Icon]) => {
    const active = label === 'Home' ? pathname === '/reader' || pathname === '/ui-preview/p08' : pathname.startsWith(href)
    return <Link key={label} to={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-elevated hover:text-ink'}`}><Icon size={18}/><span>{label}</span></Link>
  })}</nav>
}

export function ReaderShell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  return <div className="min-h-screen bg-page text-ink">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-surface p-4 lg:flex">
      <Link to="/reader" className="mb-7 flex items-center gap-2 px-2 text-xl font-bold"><span className="grid size-9 place-items-center rounded-xl bg-brand text-white"><BookOpen size={21}/></span><span>Novel<span className="text-brand">Hub</span></span></Link>
      <NavItems/>
      <div className="mt-auto rounded-2xl border border-line bg-elevated p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Flame className="text-orange" size={18}/> Keep it going!</div><p className="mt-2 text-xs leading-5 text-muted">You are 12 minutes from today&apos;s reading goal.</p><div className="mt-3 h-1.5 rounded-full bg-line"><div className="h-full w-[78%] rounded-full bg-brand"/></div></div>
    </aside>

    {menuOpen && <button className="fixed inset-0 z-40 bg-black/45 lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>} 
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface p-5 shadow-2xl transition-transform lg:hidden ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-6 flex items-center justify-between"><strong className="text-xl">Novel<span className="text-brand">Hub</span></strong><IconButton label="Close menu" onClick={() => setMenuOpen(false)}><X size={19}/></IconButton></div><NavItems onNavigate={() => setMenuOpen(false)}/>
    </aside>

    <div className="lg:pl-56">
      <header className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 xl:px-8">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setMenuOpen(true)}><Menu size={20}/></IconButton>
          <Input icon={Search} placeholder="Search stories, authors, tags..." className="hidden w-full max-w-md sm:flex"/>
          <div className="ml-auto hidden items-center gap-5 text-xs font-medium text-muted xl:flex"><Link to="/categories">Browse Books</Link><Link to="/search">Audio Lounge</Link><Link to="/reader/following">Serial Updates</Link></div>
          <button className="ml-auto hidden items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold sm:flex xl:ml-0"><span className="text-orange">●</span> 450 coins <span className="text-brand">+</span></button>
          <IconButton label="Toggle theme" onClick={toggleTheme}>{resolvedTheme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</IconButton>
          <IconButton label="Bookmarks" className="hidden sm:grid"><Bookmark size={18}/></IconButton>
          <IconButton label="Notifications" className="relative hidden sm:grid"><Bell size={18}/><span className="absolute right-2 top-2 size-2 rounded-full bg-rose"/></IconButton>
          <button className="flex items-center gap-2"><Avatar name="Elena"/><span className="hidden text-left xl:block"><strong className="block text-xs">Elena Park</strong><span className="flex items-center gap-1 text-[10px] text-muted"><Flame size={11} className="text-orange"/> 18 day streak</span></span><ChevronDown size={15} className="hidden text-muted xl:block"/></button>
        </div>
        <div className="px-4 pb-3 sm:hidden"><Input icon={Search} placeholder="Search stories..."/></div>
      </header>
      {children}
    </div>
  </div>
}
