import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router'
import { AppShell } from '../../../src/components/shell/AppShell'
import { LocaleProvider } from '../../../src/context/LocaleContext'
import { notifyWalletBalanceChanged } from '../../../src/api/walletEvents'
import { notifyNotificationsChanged } from '../../../src/api/notificationEvents'

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), user: null }))
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }))
vi.mock('../../../src/context/AuthContext', () => ({
  ROLE_HOME: { reader: '/reader', author: '/author', moderator: '/moderator', admin: '/admin' },
  useAuth: () => ({
    currentUser: mocks.user,
    roles: mocks.user.roles,
    hasRole: role => mocks.user.roles.includes(role),
    logout: vi.fn(),
  }),
}))
vi.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

beforeEach(() => {
  localStorage.clear()
  mocks.user = { id: 'account-a', name: 'Account A', roles: ['reader', 'author'] }
  mocks.apiRequest
    .mockReset()
    .mockImplementation(async path =>
      path === '/reader/notifications/unread-count'
        ? { count: 2 }
        : { balance: path === '/author/earnings' ? 9000 : 1250 },
    )
})
afterEach(cleanup)

function Surface() {
  const { pathname, search } = useLocation()
  const workspace =
    ['author', 'moderator', 'admin'].find(role => pathname.startsWith(`/${role}`)) ?? 'reader'
  return (
    <>
      <AppShell workspace={workspace}>
        <p>Workspace {workspace}</p>
      </AppShell>
      <output data-testid="location">{pathname + search}</output>
    </>
  )
}
function view(path = '/author') {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[path]}>
        <Surface />
      </MemoryRouter>
    </LocaleProvider>,
  )
}
const header = () => within(screen.getByRole('banner'))

it('shows Author navigation instead of Reader library and preserves the workspace while navigating', async () => {
  view()
  await header().findByRole('link', { name: 'Doanh thu: 9.000 xu' })
  expect(header().queryByRole('link', { name: 'Thư viện' })).toBeNull()
  fireEvent.click(header().getByRole('link', { name: 'Bản nháp' }))
  expect(screen.getByTestId('location').textContent).toBe('/author/drafts')
  expect(screen.getByText('Workspace author')).toBeTruthy()
  const nav = header().getByRole('navigation')
  expect(within(nav).getByRole('link', { name: 'Bản nháp' }).getAttribute('aria-current')).toBe(
    'page',
  )
  expect(
    within(nav).getByRole('link', { name: 'Bảng điều khiển' }).hasAttribute('aria-current'),
  ).toBe(false)
})

it('opens the same canonical earnings route from both Author balance and revenue links and highlights the sidebar', async () => {
  const { container } = view()
  const balance = await header().findByRole('link', { name: 'Doanh thu: 9.000 xu' })
  expect(balance.querySelector('[data-wallet-top-up]')).toBeNull()
  expect(balance.getAttribute('href')).toBe('/author/earnings')
  expect(header().getByRole('link', { name: 'Doanh thu' }).getAttribute('href')).toBe(
    '/author/earnings',
  )
  fireEvent.click(balance)
  const revenue = container.querySelector('[data-sidebar-navigation] a[href="/author/earnings"]')
  expect(revenue.getAttribute('aria-current')).toBe('page')
  expect(revenue.className).toContain('bg-brand ')
})

it('loads Reader coins separately when explicitly switching from Author to Reader', async () => {
  const { container } = view()
  await header().findByRole('link', { name: 'Doanh thu: 9.000 xu' })
  fireEvent.click(container.querySelector('details a[href="/reader"]'))
  const balance = await header().findByRole('link', { name: 'Ví: 1.250 xu' })
  expect(balance.querySelector('[data-wallet-top-up]')).toBeTruthy()
  expect(balance.getAttribute('href')).toBe('/reader/wallet')
  expect(header().getByRole('link', { name: 'Thư viện' }).getAttribute('href')).toBe(
    '/reader/library',
  )
  expect(mocks.apiRequest.mock.calls.some(([path]) => path === '/reader/wallet')).toBe(true)
  expect(header().queryByRole('link', { name: 'Doanh thu: 9.000 xu' })).toBeNull()
})

it('refreshes the displayed balance after a purchase or top-up event', async () => {
  view('/reader/wallet')
  await header().findByRole('link', { name: 'Ví: 1.250 xu' })
  mocks.apiRequest.mockResolvedValue({ balance: 1050 })
  notifyWalletBalanceChanged()
  await header().findByRole('link', { name: 'Ví: 1.050 xu' })
})

it('clears the previous account balance immediately and ignores its late response', async () => {
  let resolveOld
  mocks.apiRequest.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveOld = resolve
      }),
  )
  const page = view('/reader')
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.filter(([path]) => path === '/reader/wallet')).toHaveLength(
      1,
    ),
  )
  mocks.user = { id: 'account-b', name: 'Account B', roles: ['reader'] }
  mocks.apiRequest.mockResolvedValue({ balance: 55 })
  page.rerender(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/reader']}>
        <Surface />
      </MemoryRouter>
    </LocaleProvider>,
  )
  await header().findByRole('link', { name: 'Ví: 55 xu' })
  resolveOld({ balance: 999999 })
  await waitFor(() => expect(header().queryByText('999.999 xu')).toBeNull())
})

it('displays a real zero balance and recovers a failed balance request on focus', async () => {
  mocks.apiRequest.mockRejectedValueOnce(new Error('offline'))
  view('/reader')
  const failed = await header().findByRole('link', { name: 'Ví: không tải được số dư' })
  expect(failed.textContent).toContain('—')
  expect(header().queryByText('450 xu')).toBeNull()
  mocks.apiRequest.mockResolvedValue({ balance: 0 })
  fireEvent.focus(window)
  await header().findByRole('link', { name: 'Ví: 0 xu' })
})

it.each(['moderator', 'admin'])(
  'shows %s workspace actions without a Reader wallet shortcut',
  role => {
    mocks.user = { id: role, name: role, roles: ['reader', role] }
    view(`/${role}`)
    const nav = header().getByRole('navigation')
    for (const link of within(nav).getAllByRole('link'))
      expect(link.getAttribute('href').startsWith(`/${role}`)).toBe(true)
    expect(header().queryByRole('link', { name: 'Ví' })).toBeNull()
    expect(
      mocks.apiRequest.mock.calls.every(([path]) => path === '/reader/notifications/unread-count'),
    ).toBe(true)
  },
)

it('opens notifications in the active workspace', () => {
  mocks.user = { id: 'admin', name: 'Admin', roles: ['reader', 'admin'] }
  view('/admin')
  fireEvent.click(header().getByRole('button', { name: 'Thông báo' }))
  expect(screen.getByTestId('location').textContent).toBe('/admin/notifications')
  expect(screen.getByText('Workspace admin')).toBeTruthy()
})

it('shows the actual unread badge, then removes it after notifications are read', async () => {
  const page = view('/reader')
  await waitFor(() =>
    expect(page.container.querySelector('[data-notification-count]')?.textContent).toBe('2'),
  )
  mocks.apiRequest.mockImplementation(async path =>
    path === '/reader/notifications/unread-count' ? { count: 0 } : { balance: 1250 },
  )
  notifyNotificationsChanged()
  await waitFor(() => expect(page.container.querySelector('[data-notification-count]')).toBeNull())
})

it('does not expose a previous account unread count after switching accounts', async () => {
  let resolveOld
  mocks.apiRequest.mockImplementation(path => {
    if (path !== '/reader/notifications/unread-count') return Promise.resolve({ balance: 0 })
    return mocks.user.id === 'account-a'
      ? new Promise(resolve => {
          resolveOld = resolve
        })
      : Promise.resolve({ count: 1 })
  })
  const page = view('/reader')
  await waitFor(() => expect(resolveOld).toBeTypeOf('function'))
  mocks.user = { id: 'account-b', name: 'Account B', roles: ['reader'] }
  page.rerender(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/reader']}>
        <Surface />
      </MemoryRouter>
    </LocaleProvider>,
  )
  await waitFor(() =>
    expect(page.container.querySelector('[data-notification-count]')?.textContent).toBe('1'),
  )
  resolveOld({ count: 99 })
  await waitFor(() =>
    expect(page.container.querySelector('[data-notification-count]')?.textContent).toBe('1'),
  )
})
