import { Outlet } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { PageContainer } from '../components/ui'
import { AppShell } from '../components/shell/AppShell'

function RoleLayout({ role, navigation = [] }) {
  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-5 py-4 md:px-8 lg:px-12">
          <BookOpen className="text-brand" />
          <strong>NovelHub</strong>
          <span className="ml-auto text-sm text-muted">{role}</span>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1360px]">
        <aside className="hidden w-60 shrink-0 border-r border-line p-6 lg:block">
          {navigation.map(item => (
            <div className="mb-2 text-sm text-muted" key={item}>
              {item}
            </div>
          ))}
        </aside>
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>
    </div>
  )
}

export const PublicLayout = () => (
  <RoleLayout role="Discover" navigation={['Discover', 'Categories', 'Rankings']} />
)
export const ReaderLayout = ({ children }) => <AppShell workspace="reader">{children || <Outlet />}</AppShell>
export const ReaderImmersiveLayout = ({ children }) => (
  <div className="min-h-screen bg-reader text-ink">{children || <Outlet />}</div>
)
export const AuthorLayout = ({ children }) => <AppShell workspace="author">{children || <Outlet />}</AppShell>
export const ModeratorLayout = ({ children }) => <AppShell workspace="moderator">{children || <Outlet />}</AppShell>
export const AdminLayout = ({ children }) => <AppShell workspace="admin">{children || <Outlet />}</AppShell>
