import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const live = {
  author: { id: 'actual-author', name: 'Tác giả MongoDB' },
  authorShare: 70,
  platformShare: 30,
  source: 'default',
  effectiveAt: null,
  history: [],
  canEdit: true,
  accountVersion: 4,
  latestRateId: null,
};
function edit(percentage = '78') {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Tỷ lệ của tác giả (%)' }), {
    target: { value: percentage },
  });
  fireEvent.change(screen.getByLabelText('Lý do điều chỉnh (bắt buộc)'), {
    target: { value: '  Điều chỉnh đã thống nhất  ' },
  });
}
it('saves exact account/version/reason and refreshes the actual server response', async () => {
  const result = {
    authorId: 'actual-author',
    rate: { id: 'new-rate', percentage: 78, effectiveAt: '2026-10-17T00:00:00Z' },
  };
  mocks.apiRequest
    .mockResolvedValueOnce(live)
    .mockResolvedValueOnce(result)
    .mockResolvedValue({
      ...live,
      authorShare: 78,
      platformShare: 22,
      accountVersion: 5,
      latestRateId: 'new-rate',
      source: 'agreement',
    });
  view();
  await screen.findByRole('spinbutton');
  edit();
  expect(screen.getByLabelText('Tỷ lệ của NovelHub (%)').textContent).toBe('22%');
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thỏa thuận' }));
  await screen.findByText('Máy chủ đã ghi nhận thỏa thuận mới: tác giả 78%.');
  expect(mocks.apiRequest.mock.calls[1]).toEqual([
    '/admin/authors/actual-author/agreement',
    {
      method: 'POST',
      body: {
        percentage: 78,
        reason: 'Điều chỉnh đã thống nhất',
        expectedAccountVersion: 4,
        expectedLatestRateId: null,
      },
    },
  ]);
  expect(screen.queryByRole('button', { name: 'Lưu thỏa thuận' })).toBeNull();
  expect(screen.getByRole('spinbutton').value).toBe('78');
});
it('requires a changed whole percentage and reason, and supports discarding edits', async () => {
  mocks.apiRequest.mockResolvedValue(live);
  view();
  await screen.findByRole('spinbutton');
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '78' } });
  expect(screen.getByRole('button', { name: 'Lưu thỏa thuận' }).disabled).toBe(true);
  edit('78.5');
  expect(screen.getByRole('button', { name: 'Lưu thỏa thuận' }).disabled).toBe(true);
  expect(screen.getByText('Tỷ lệ tác giả phải là số nguyên từ 0 đến 100.')).toBeTruthy();
  edit('101');
  expect(screen.getByRole('button', { name: 'Lưu thỏa thuận' }).disabled).toBe(true);
  edit('78');
  fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
  expect(screen.getByRole('spinbutton').value).toBe('70');
  expect(screen.getByLabelText('Lý do điều chỉnh (bắt buộc)').value).toBe('');
  expect(screen.queryByRole('button', { name: 'Lưu thỏa thuận' })).toBeNull();
});
it('blocks duplicate saves while pending and requires a fresh read after conflict', async () => {
  let rejectSave;
  mocks.apiRequest
    .mockResolvedValueOnce(live)
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject;
        }),
    )
    .mockResolvedValue(live);
  view();
  await screen.findByRole('spinbutton');
  edit();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thỏa thuận' }));
  fireEvent.submit(screen.getByRole('spinbutton').closest('form'));
  expect(
    mocks.apiRequest.mock.calls.filter(([, options]) => options?.method === 'POST'),
  ).toHaveLength(1);
  rejectSave(Object.assign(new Error('Thỏa thuận đã thay đổi.'), { status: 409 }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Lưu thỏa thuận' }).disabled).toBe(true);
  expect(screen.getByLabelText('Lý do điều chỉnh (bắt buộc)').value).toContain('Điều chỉnh');
  fireEvent.click(screen.getByRole('button', { name: 'Tải lại từ máy chủ' }));
  await waitFor(() => expect(screen.getByRole('spinbutton').disabled).toBe(false));
});
it('does not report success on malformed or mismatched save responses', async () => {
  mocks.apiRequest.mockResolvedValueOnce(live).mockResolvedValueOnce({
    authorId: 'someone-else',
    rate: { id: 'rate', percentage: 78, effectiveAt: '2026-10-17' },
  });
  view();
  await screen.findByRole('spinbutton');
  edit();
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thỏa thuận' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Máy chủ đã ghi nhận thỏa thuận mới: tác giả 78%.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Lưu thỏa thuận' }).disabled).toBe(true);
});
