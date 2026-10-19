import { Outlet } from 'react-router'
import { AppShell } from '../components/shell/AppShell'

export const ReaderLayout = ({ children }) => (
  <AppShell workspace="reader">{children || <Outlet />}</AppShell>
)
export const AuthorLayout = ({ children }) => (
  <AppShell workspace="author">{children || <Outlet />}</AppShell>
)
export const ModeratorLayout = ({ children }) => (
  <AppShell workspace="moderator">{children || <Outlet />}</AppShell>
)
export const AdminLayout = ({ children }) => (
  <AppShell workspace="admin">{children || <Outlet />}</AppShell>
)
