import { MemoryRouter, useNavigate } from 'react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuditEventsPage } from '../../../src/pages/admin/AuditEventsPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({ AdminLayout: ({ children }) => <main>{children}</main> }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const event = {
  id: 'audit-1',
  actorType: 'system',
  targetType: 'chapter',
  targetId: 'chapter-id',
  action: 'chapter.saved',
  result: 'success',
  reason: '<script>literal</script>',
  occurredAt: '2026-10-18T00:00:00Z',
};
function view(url = '/admin/audit-logs') {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[url]}>
        <AuditEventsPage />
      </MemoryRouter>
    </LocaleProvider>,
  );
}
it('restores the visible filters with browser history instead of keeping the later form values', async () => {
  mocks.apiRequest.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  function Back() {
    const navigate = useNavigate();
    return <button onClick={() => navigate(-1)}>Back</button>;
  }
  render(
    <LocaleProvider>
      <MemoryRouter initialEntries={['/admin/audit-logs?action=story.created']}>
        <Back />
        <AuditEventsPage />
      </MemoryRouter>
    </LocaleProvider>,
  );
  fireEvent.change(screen.getByLabelText('Mã hành động'), { target: { value: 'chapter.saved' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lọc nhật ký' }));
  await waitFor(() => expect(mocks.apiRequest.mock.calls.at(-1)[0]).toContain('chapter.saved'));
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  await waitFor(() => expect(screen.getByLabelText('Mã hành động').value).toBe('story.created'));
  expect(mocks.apiRequest.mock.calls.at(-1)[0]).toContain('story.created');
});
it('renders stored events as escaped text, applies server filters and resets pagination', async () => {
  mocks.apiRequest.mockResolvedValue({ items: [event], total: 21, page: 1, pageSize: 20 });
  const { container } = view();
  await screen.findByText('chapter.saved');
  expect(screen.getByText('<script>literal</script>')).toBeTruthy();
  expect(container.querySelector('script')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() =>
    expect(mocks.apiRequest.mock.calls.some(([path]) => path.includes('page=2'))).toBe(true),
  );
  fireEvent.change(screen.getByLabelText('Mã hành động'), { target: { value: 'chapter.saved' } });
  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-18' } });
  fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-18' } });
  fireEvent.click(screen.getByRole('button', { name: 'Lọc nhật ký' }));
  await waitFor(() => {
    const query = new URLSearchParams(mocks.apiRequest.mock.calls.at(-1)[0].split('?')[1]);
    expect(query.get('action')).toBe('chapter.saved');
    expect(query.get('from')).toBe('2026-10-17T17:00:00.000Z');
    expect(query.get('to')).toBe('2026-10-18T16:59:59.999Z');
    expect(query.has('page')).toBe(false);
  });
});
it('shows real empty and error states without mock events and retries a failed read', async () => {
  mocks.apiRequest
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  view('/admin/audit-logs?from=2026-99-99');
  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getAllByRole('button', { name: 'Tải lại' }).at(-1));
  await screen.findByText('Không có bản ghi phù hợp');
  expect(screen.queryByText('chapter.saved')).toBeNull();
});
