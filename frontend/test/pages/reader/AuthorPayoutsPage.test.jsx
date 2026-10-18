import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorPayoutsPage } from '../../../src/pages/reader/AuthorPayoutsPage';
const api = vi.hoisted(() => vi.fn());
vi.mock('../../../src/api/client', () => ({ apiRequest: api }));
vi.mock('../../../src/layouts', () => ({
  ReaderLayout: ({ children }) => <main>{children}</main>,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('loads retained financial rights through Reader endpoints without requesting Author workspace access', async () => {
  api.mockImplementation(async (path) =>
    path.includes('bank-details') ? { version: 2, bank: null } : { items: [], nextCursor: null },
  );
  render(
    <LocaleProvider>
      <AuthorPayoutsPage />
    </LocaleProvider>,
  );
  expect(screen.getByRole('heading', { name: 'Chi trả thu nhập tác giả' })).toBeTruthy();
  await screen.findByLabelText('Tên ngân hàng');
  await waitFor(() =>
    expect(
      api.mock.calls.some(([path]) => path.startsWith('/reader/author-finance/payouts?')),
    ).toBe(true),
  );
  expect(api.mock.calls.every(([path]) => path.startsWith('/reader/author-finance/'))).toBe(true);
});
