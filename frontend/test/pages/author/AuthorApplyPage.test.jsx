import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorApplyPage } from '../../../src/pages/author/AuthorApplyPage';
const mocks = vi.hoisted(() => ({ api: vi.fn(), apply: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.api }));
vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { email: 'reader@example.test', roles: ['reader'] },
    applyForAuthor: mocks.apply,
  }),
}));
vi.mock('../../../src/components/public/PublicHeader', () => ({ PublicHeader: () => null }));
vi.mock('../../../src/components/auth/AuthShowcase', () => ({ AuthShowcase: () => null }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function view(access) {
  mocks.api.mockResolvedValue({
    application: {
      id: 'old-application',
      status: 'approved',
      decisionReason: 'Đã duyệt trước đây',
    },
    access,
  });
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorApplyPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
}
it('offers a new application only when the server confirms the old Author grant is no longer active', async () => {
  mocks.apply.mockResolvedValue({ application: { id: 'new-application', status: 'submitted' } });
  view({ activeAuthor: false, canApply: true });
  await screen.findByText(/quyền Author hiện không còn hiệu lực/);
  const submit = screen.getByRole('button', { name: 'Gửi đơn đăng ký Tác giả' });
  expect(submit.disabled).toBe(true);
  for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
  expect(submit.disabled).toBe(false);
  fireEvent.click(submit);
  await waitFor(() => expect(mocks.apply).toHaveBeenCalledOnce());
  await screen.findByText('Đơn đăng ký đang chờ xét duyệt');
});
it.each([{ activeAuthor: true, canApply: false }, undefined])(
  'does not reinterpret approval without explicit server confirmation: %j',
  async (access) => {
    view(access);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    expect(await screen.findByText(/Đơn đăng ký đã được phê duyệt/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gửi đơn đăng ký Tác giả' })).toBeNull();
    expect(mocks.apply).not.toHaveBeenCalled();
  },
);
