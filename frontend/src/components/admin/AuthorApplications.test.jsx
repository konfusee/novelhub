import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../context/LocaleContext';
import { AuthorApplications } from './AuthorApplications';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../api/client', () => ({ apiRequest: mocks.apiRequest }));
const application = {
  id: '507f1f77bcf86cd799439011',
  status: 'submitted',
  version: 2,
  submittedAt: '2026-10-15T00:00:00Z',
  applicant: { name: 'Writer Linh', email: 'linh@example.test' },
};
const feed = { items: [application], page: 1, pageSize: 10, total: 1 };
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <AuthorApplications />
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => {
  mocks.apiRequest.mockReset().mockResolvedValue(feed);
});
afterEach(cleanup);

describe('Admin Author application review', () => {
  it('loads actual applications and requires a reason before confirming', async () => {
    view();
    expect(await screen.findByText('Writer Linh')).toBeTruthy();
    expect(mocks.apiRequest.mock.calls[0][0]).toBe(
      '/admin/author-applications?status=submitted&page=1&pageSize=10',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xem hồ sơ' }));
    expect(screen.getByRole('button', { name: 'Xác nhận quyết định' }).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do quyết định'), {
      target: { value: 'Đủ điều kiện' },
    });
    mocks.apiRequest.mockResolvedValueOnce({ application: { ...application, status: 'approved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận quyết định' }));
    await waitFor(() =>
      expect(mocks.apiRequest).toHaveBeenCalledWith(
        `/admin/author-applications/${application.id}/decision`,
        {
          method: 'POST',
          body: { decision: 'approve', reason: 'Đủ điều kiện', expectedVersion: 2 },
        },
      ),
    );
    expect(
      await screen.findByText('Đã lưu quyết định và tạo thông báo cho người đăng ký.'),
    ).toBeTruthy();
  });

  it('keeps the reason and shows a stale-version error instead of success', async () => {
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Xem hồ sơ' }));
    fireEvent.change(screen.getByLabelText('Lý do quyết định'), {
      target: { value: 'Cần bổ sung thông tin' },
    });
    mocks.apiRequest.mockRejectedValueOnce({ code: 'application_changed' });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận quyết định' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByLabelText('Lý do quyết định').value).toBe('Cần bổ sung thông tin');
    expect(screen.queryByText('Đã lưu quyết định và tạo thông báo cho người đăng ký.')).toBeNull();
  });

  it('changes the filter using the shared Select and displays an empty response', async () => {
    view();
    await screen.findByText('Writer Linh');
    mocks.apiRequest.mockResolvedValueOnce({ items: [], total: 0 });
    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái hồ sơ' }));
    fireEvent.click(screen.getByRole('option', { name: 'Đã từ chối' }));
    expect(await screen.findByText('Không có hồ sơ phù hợp.')).toBeTruthy();
    expect(mocks.apiRequest.mock.calls.at(-1)[0]).toContain('status=rejected');
  });

  it('provides a retry after a load failure', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('offline'));
    view();
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra trạng thái' }));
    expect(await screen.findByText('Writer Linh')).toBeTruthy();
  });

  it('shows past decisions as read-only', async () => {
    mocks.apiRequest.mockResolvedValueOnce({
      ...feed,
      items: [{ ...application, status: 'rejected', decisionReason: 'Thiếu hồ sơ' }],
    });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Xem hồ sơ' }));
    expect(screen.getByText('Thiếu hồ sơ')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xác nhận quyết định' })).toBeNull();
  });
});
