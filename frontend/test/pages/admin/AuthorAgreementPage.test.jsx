import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorAgreementPage } from '../../../src/pages/admin/AuthorAgreementPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function view() {
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/admin/users/actual-author']}>
        <Routes>
          <Route path="/admin/users/:userId" element={<AuthorAgreementPage />} />
        </Routes>
      </MemoryRouter>
    </LocaleProvider>,
  );
}
it('loads the exact account from the API and displays persisted rates without a fake save', async () => {
  mocks.apiRequest.mockResolvedValue({
    author: { id: 'actual-author', name: 'Tác giả MongoDB' },
    authorShare: 72,
    platformShare: 28,
    source: 'agreement',
    effectiveAt: '2026-01-01',
    history: [{ id: 'rate', percentage: 85, effectiveAt: '2027-01-01', scheduled: true }],
  });
  view();
  await screen.findByText('Tác giả MongoDB · Thỏa thuận doanh thu');
  expect(mocks.apiRequest.mock.calls[0][0]).toBe('/admin/authors/actual-author/agreement');
  expect(screen.getByLabelText('Tỷ lệ của tác giả (%)', { selector: 'output' }).textContent).toBe(
    '72%',
  );
  expect(screen.getByLabelText('Tỷ lệ của NovelHub (%)').textContent).toBe('28%');
  expect(screen.getByText('Chưa đến ngày hiệu lực')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Lưu thỏa thuận' })).toBeNull();
});
it('shows a missing account without falling back to a demo identity or percentage', async () => {
  mocks.apiRequest.mockRejectedValue(Object.assign(new Error('Missing'), { status: 404 }));
  view();
  await screen.findByText('Không tìm thấy tác giả');
  expect(screen.queryByText('80%')).toBeNull();
  expect(screen.queryByLabelText('Tỷ lệ của tác giả (%)')).toBeNull();
});
