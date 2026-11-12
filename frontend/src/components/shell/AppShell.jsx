import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router'
import { NovelHubMark, Menu, Settings, UserRound, X } from '../icons'
import { IconButton } from '../ui'
import { SharedWorkspaceHeader, WorkspaceSwitcher } from '../shared/RoleNavigation'
import { workspaceMeta, workspaceNavigation } from '../../navigation/workspaceNavigation'
import { useAuth } from '../../context/AuthContext'
import { ROUTES } from '../../app/routes'
import { useLocale } from '../../context/LocaleContext'

const SIDEBAR_KEY = 'novelhub.sidebar.collapsed'

function SidebarItem({
  item,
  active,
  collapsed,
  onNavigate,
  tooltipId,
  tooltipPath,
  onTooltipChange,
}) {
  const { t } = useLocale()
  const [labelKey, path, Icon] = item
  const label = t(labelKey)
  const hideTooltip = () => onTooltipChange(current => (current?.path === path ? null : current))
  const showTooltip = event => {
    if (!collapsed) return
    const box = event.currentTarget.getBoundingClientRect()
    const sidebar = event.currentTarget.closest('[data-app-sidebar]')?.getBoundingClientRect()
    onTooltipChange({
      path,
      label,
      left: (sidebar?.right ?? box.right) + 12,
      top: Math.max(20, Math.min(innerHeight - 20, box.top + box.height / 2)),
    })
  }
  return (
    <Link
      to={path}
      onClick={() => {
        hideTooltip()
        onNavigate?.()
      }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={event => {
        if (event.key === 'Escape') hideTooltip()
      }}
      aria-label={collapsed ? label : undefined}
      aria-describedby={collapsed && tooltipPath === path ? tooltipId : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-10 items-center gap-3 rounded-full text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-spring ${collapsed ? 'justify-center' : 'px-3.5'} ${active ? 'bg-brand text-on-brand shadow-[0_8px_20px_-12px_var(--primary)]' : 'text-muted hover:bg-elevated hover:text-ink'}`}
    >
      <Icon size={17} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function SidebarGroup({
  group,
  activePath,
  collapsed,
  onNavigate,
  tooltipId,
  tooltipPath,
  onTooltipChange,
}) {
  const { t } = useLocale()
  return (
    <section className="space-y-1">
      {!collapsed && (
        <p className="mb-2 px-3.5 text-[10px] font-semibold uppercase tracking-[.16em] text-muted">
          {t(group.labelKey)}
        </p>
      )}
      {group.items.map(item => (
        <SidebarItem
          key={item[1]}
          item={item}
          active={item[1] === activePath}
          collapsed={collapsed}
          onNavigate={onNavigate}
          tooltipId={tooltipId}
          tooltipPath={tooltipPath}
          onTooltipChange={onTooltipChange}
        />
      ))}
    </section>
  )
}

function commonNavigation(workspace) {
  const base = `/${workspace}`
  const settingsPath = workspace === 'admin' ? '/admin/preferences' : `${base}/settings`
  return {
    labelKey: 'navigation.account',
    items: [
      ['account.combinedTitle', `${base}/profile`, UserRound],
      ['navigation.settings', settingsPath, Settings],
    ],
  }
}

function AppSidebar({ workspace, collapsed, mobile = false, onCollapse, onNavigate }) {
  const { t } = useLocale()
  const { pathname } = useLocation()
  const tooltipId = useId()
  const navigationRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  useEffect(() => {
    if (!collapsed || !tooltip) return
    const hide = () => setTooltip(null)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [collapsed, tooltip])
  const meta = workspaceMeta[workspace]
  const { hasRole } = useAuth()
  const groups = [...workspaceNavigation[workspace], commonNavigation(workspace)].map(group => ({
    ...group,
    items: group.items.filter(([, path]) => path !== ROUTES.authorApply || !hasRole('author')),
  }))
  const activePath = groups
    .flatMap(group => group.items)
    .filter(([, path, , exact]) =>
      exact ? pathname === path : path === '/' ? pathname === '/' : pathname.startsWith(path),
    )
    .sort((a, b) => b[1].length - a[1].length)[0]?.[1]
  useEffect(() => {
    const navigation = navigationRef.current
    if (navigation?.clientHeight)
      navigation.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' })
  }, [activePath, collapsed])
  return (
    <div className="flex h-full flex-col bg-surface p-3">
      <div className={`mb-4 flex h-12 items-center ${collapsed ? 'justify-center' : 'gap-2 px-2'}`}>
        <Link to={meta.home} className="flex min-w-0 items-center gap-2 font-bold">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-on-brand shadow-[0_8px_20px_-12px_var(--primary)]">
            <NovelHubMark size={20} />
          </span>
          {!collapsed && (
            <span className="truncate">
              Novel<span className="text-brand">Hub</span>
              <small className="block truncate text-[10px] font-medium text-muted">
                {t(meta.labelKey)}
              </small>
            </span>
          )}
        </Link>
      </div>
      <WorkspaceSwitcher currentRole={workspace} compact={collapsed} />
      <div
        ref={navigationRef}
        data-sidebar-navigation
        className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-1 pb-4"
      >
        {groups.map(group => (
          <SidebarGroup
            key={group.labelKey}
            group={group}
            activePath={activePath}
            collapsed={collapsed}
            onNavigate={onNavigate}
            tooltipId={tooltipId}
            tooltipPath={tooltip?.path}
            onTooltipChange={setTooltip}
          />
        ))}
      </div>
      <div
        className={`mt-2 border-t border-hairline pt-3 ${collapsed ? 'flex justify-center' : 'flex items-center justify-between px-2'}`}
      >
        {!collapsed && (
          <span className="truncate text-[10px] text-muted">NovelHub · {t(meta.labelKey)}</span>
        )}
        {!mobile && (
          <IconButton
            label={t(collapsed ? 'common.expandSidebar' : 'common.collapseSidebar')}
            onClick={onCollapse}
            shape="circle"
            className="size-10"
          >
            <Menu size={19} />
          </IconButton>
        )}
      </div>
      {collapsed &&
        tooltip &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{
              left: tooltip.left,
              top: tooltip.top,
              maxWidth: `calc(100vw - ${tooltip.left + 8}px)`,
            }}
            className="nh-fade-enter pointer-events-none fixed z-[60] -translate-y-1/2 truncate rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-page shadow-float"
          >
            {tooltip.label}
          </span>,
          document.body,
        )}
    </div>
  )
}

export function AppShell({ workspace, children }) {
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const drawerRef = useRef(null)
  useEffect(() => {
    if (!mobileOpen) return undefined
    // Modal drawer: move focus in, lock page scroll, restore both on close.
    const previous = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('a[aria-current="page"], a, button')?.focus()
    const onKeyDown = event => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [mobileOpen])
  const toggleCollapsed = () =>
    setCollapsed(value => {
      localStorage.setItem(SIDEBAR_KEY, String(!value))
      return !value
    })
  const desktopWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'
  const contentOffset = collapsed ? 'md:pl-[72px] lg:pl-[72px]' : 'md:pl-[72px] lg:pl-[260px]'
  const headerOffset = collapsed
    ? 'md:left-[72px] lg:left-[72px]'
    : 'md:left-[72px] lg:left-[260px]'
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside
        data-app-sidebar
        className={`fixed inset-y-0 left-0 z-40 hidden w-[72px] border-r border-line transition-[width] duration-300 ease-spring md:block ${desktopWidth}`}
      >
        <div className="hidden h-full lg:block">
          <AppSidebar workspace={workspace} collapsed={collapsed} onCollapse={toggleCollapsed} />
        </div>
        <div className="h-full lg:hidden">
          {/* Tablet rail: its menu button opens the full drawer, which shows the labels. */}
          <AppSidebar workspace={workspace} collapsed onCollapse={() => setMobileOpen(true)} />
        </div>
      </aside>
      {mobileOpen && (
        <button
          type="button"
          aria-label={t('common.closeNavigation')}
          className="nh-fade-enter fixed inset-0 z-40 bg-scrim backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={drawerRef}
        data-app-sidebar
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 w-[min(320px,88vw)] overflow-hidden rounded-r-3xl border-r border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-float transition-transform duration-[420ms] ease-spring lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <IconButton
          label={t('common.closeMenu')}
          onClick={() => setMobileOpen(false)}
          shape="circle"
          className="absolute right-3 top-3 z-10"
        >
          <X size={18} />
        </IconButton>
        <AppSidebar
          workspace={workspace}
          collapsed={false}
          mobile
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>
      <div
        data-app-content
        className={`flex min-h-screen flex-col transition-[padding] duration-300 ease-spring ${contentOffset}`}
      >
        <SharedWorkspaceHeader
          workspaceLabel={t(workspaceMeta[workspace].labelKey)}
          currentRole={workspace}
          onOpenMenu={() => setMobileOpen(true)}
          offsetClass={`${headerOffset} duration-300 ease-spring`}
        />
        <main className="workspace-content flex-1 pt-[var(--app-header-h)]">{children}</main>
      </div>
    </div>
  )
}
