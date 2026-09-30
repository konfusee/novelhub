import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Menu, Settings, HelpCircle, ShieldCheck, X } from 'lucide-react'
import { IconButton } from '../ui'
import { SiteFooter } from '../shared/SiteFooter'
import { SharedWorkspaceHeader, WorkspaceSwitcher } from '../shared/RoleNavigation'
import { workspaceMeta, workspaceNavigation } from '../../navigation/workspaceNavigation'
import { useLocale } from '../../context/LocaleContext'

const SIDEBAR_KEY = 'novelhub.sidebar.collapsed'

function SidebarItem({ item, active, collapsed, onNavigate }) {
  const { t } = useLocale()
  const [labelKey, path, Icon] = item
  const label = t(labelKey)
  return (
    <Link
      to={path}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium transition-colors ${collapsed ? 'justify-center px-0' : ''} ${active ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-elevated hover:text-ink'}`}
    >
      <Icon size={17} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[10px] text-page shadow-lg group-hover:block">{label}</span>}
    </Link>
  )
}

function SidebarGroup({ group, activePath, collapsed, onNavigate }) {
  const { t } = useLocale()
  return (
    <section className="space-y-1">
      {!collapsed && <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[.18em] text-muted">{t(group.labelKey)}</p>}
      {group.items.map(item => <SidebarItem key={item[1]} item={item} active={item[1] === activePath} collapsed={collapsed} onNavigate={onNavigate} />)}
    </section>
  )
}

function commonNavigation(workspace) {
  const base = `/${workspace}`
  const settingsPath = workspace === 'admin' ? '/admin/preferences' : `${base}/settings`
  return { labelKey: 'navigation.account', items: [
    ['navigation.settings', settingsPath, Settings], ['navigation.account', `${base}/account`, ShieldCheck],
    ['common.helpSupport', `${base}/support`, HelpCircle],
  ] }
}

function AppSidebar({ workspace, collapsed, mobile = false, onCollapse, onNavigate }) {
  const { t } = useLocale()
  const { pathname } = useLocation()
  const meta = workspaceMeta[workspace]
  const groups = [...workspaceNavigation[workspace], commonNavigation(workspace)]
  const activePath = groups.flatMap(group => group.items).filter(([, path, , exact]) => exact ? pathname === path : path === '/' ? pathname === '/' : pathname.startsWith(path)).sort((a, b) => b[1].length - a[1].length)[0]?.[1]
  return (
    <div className="flex h-full flex-col bg-surface p-3">
      <div className={`mb-4 flex h-12 items-center ${collapsed ? 'justify-center' : 'gap-2 px-2'}`}>
        <Link to={meta.home} className="flex min-w-0 items-center gap-2 font-bold">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><BookOpen size={20} /></span>
          {!collapsed && <span className="truncate">Novel<span className="text-brand">Hub</span><small className="block truncate text-[9px] font-medium text-muted">{t(meta.labelKey)} · {t('common.workspace')}</small></span>}
        </Link>
      </div>
      <WorkspaceSwitcher currentRole={workspace} compact={collapsed} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-visible pb-4">
        {groups.map(group => <SidebarGroup key={group.labelKey} group={group} activePath={activePath} collapsed={collapsed} onNavigate={onNavigate} />)}
      </div>
      <div className={`mt-2 border-t border-line pt-3 ${collapsed ? 'flex justify-center' : 'flex items-center justify-between px-2'}`}>
        {!collapsed && <span className="truncate text-[10px] text-muted">NovelHub · {t(meta.labelKey)}</span>}
        {!mobile && (
          <IconButton
            label={t(collapsed ? 'common.expandSidebar' : 'common.collapseSidebar')}
            onClick={onCollapse}
            className="size-10 shrink-0 rounded-xl"
          >
            <Menu size={19} />
          </IconButton>
        )}
      </div>
    </div>
  )
}

export function AppShell({ workspace, children }) {
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggleCollapsed = () => setCollapsed(value => {
    localStorage.setItem(SIDEBAR_KEY, String(!value))
    return !value
  })
  const desktopWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'
  const contentOffset = collapsed ? 'md:pl-[72px] lg:pl-[72px]' : 'md:pl-[72px] lg:pl-[260px]'
  const headerOffset = collapsed ? 'md:left-[72px] lg:left-[72px]' : 'md:left-[72px] lg:left-[260px]'
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside data-app-sidebar className={`fixed inset-y-0 left-0 z-40 hidden w-[72px] border-r border-line transition-[width] duration-200 md:block ${desktopWidth}`}>
        <div className="hidden h-full lg:block"><AppSidebar workspace={workspace} collapsed={collapsed} onCollapse={toggleCollapsed} /></div>
        <div className="h-full lg:hidden"><AppSidebar workspace={workspace} collapsed /></div>
      </aside>
      {mobileOpen && <button type="button" aria-label={t('common.closeNavigation')} className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside data-app-sidebar className={`fixed inset-y-0 left-0 z-50 w-[min(320px,88vw)] border-r border-line bg-surface shadow-2xl transition-transform duration-200 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <IconButton label={t('common.closeMenu')} onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10"><X size={18} /></IconButton>
        <AppSidebar workspace={workspace} collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
      </aside>
      <div data-app-content className={`flex min-h-screen flex-col transition-[padding] duration-200 ${contentOffset}`}>
        <SharedWorkspaceHeader workspaceLabel={t(workspaceMeta[workspace].labelKey)} currentRole={workspace} onOpenMenu={() => setMobileOpen(true)} offsetClass={`${headerOffset} duration-200`} />
        <main className="workspace-content flex-1 pt-[7rem] sm:pt-16">{children}</main>
        <SiteFooter />
      </div>
    </div>
  )
}
