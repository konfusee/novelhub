import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { ManualReviewPage } from '../../../src/pages/moderator/ManualReviewPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  ModeratorLayout: ({ children }) => <main>{children}</main>,
}));
const data = {
  submission: { id: 'submission', version: 4, claimVersion: 2, status: 'pending-review' },
  revision: { id: 'revision', version: 3, packageDigest: 'digest' },
  evidence: { id: 'batch', version: 5, status: 'pending' },
  title: 'Nội dung gửi từ MongoDB',
  metadata: { description: 'Tóm tắt gốc được giữ nguyên.' },
  paragraphs: [],
  rights: { basis: 'original' },
  history: [],
  canAdmit: false,
  canDecide: true,
};
const view = () =>
  render(
    <MemoryRouter initialEntries={['/moderator/manual-reviews/submission']}>
      <LocaleProvider>
        <Routes>
          <Route path="/moderator/manual-reviews/:submissionId" element={<ManualReviewPage />} />
        </Routes>
      </LocaleProvider>
    </MemoryRouter>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function fill() {
  await screen.findByText(data.title);
  fireEvent.change(screen.getByLabelText('Lý do hoặc phản hồi cụ thể (ít nhất 10 ký tự)'), {
    target: { value: 'Đã đối chiếu nội dung và khai báo quyền.' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
}
it('shows the exact package, requires acknowledgement and sends all claim/revision/evidence versions', async () => {
  let decided = false;
  mocks.apiRequest.mockImplementation((_path, options) => {
    if (options?.method === 'POST') {
      decided = true;
      return Promise.resolve({ id: 'submission', status: 'approved' });
    }
    return Promise.resolve({
      ...data,
      canDecide: !decided,
      submission: { ...data.submission, status: decided ? 'approved' : 'pending-review' },
    });
  });
  view();
  await screen.findByText(data.title);
  expect(screen.getByText(data.metadata.description)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Ghi quyết định' }).disabled).toBe(true);
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Ghi quyết định' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await screen.findByText(/Hồ sơ đã kết thúc hoặc bạn chưa giữ claim/);
  expect(mocks.apiRequest).toHaveBeenCalledWith('/moderator/manual-reviews/submission/decision', {
    method: 'POST',
    body: {
      expectedVersion: 4,
      revisionId: 'revision',
      expectedEvidenceVersion: 5,
      confirmedManualReview: true,
      reason: 'Đã đối chiếu nội dung và khai báo quyền.',
      expectedClaimVersion: 2,
      expectedRevisionVersion: 3,
      evidenceBatchId: 'batch',
      outcome: 'approved',
    },
  });
});
it('admits a validated package explicitly without claiming an AI result', async () => {
  let admitted = false;
  mocks.apiRequest.mockImplementation((_path, options) => {
    if (options?.method === 'POST') {
      admitted = true;
      return Promise.resolve({ claim: { id: 'submission' }, status: 'pending-review' });
    }
    return Promise.resolve({
      ...data,
      canAdmit: !admitted,
      canDecide: false,
      submission: { ...data.submission, status: admitted ? 'pending-review' : 'validated' },
    });
  });
  view();
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận duyệt thủ công' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await screen.findByText(/Hồ sơ đã kết thúc hoặc bạn chưa giữ claim/);
  expect(mocks.apiRequest.mock.calls.find(([path]) => path.endsWith('/admit'))[1].body).toEqual({
    expectedVersion: 4,
    revisionId: 'revision',
    expectedEvidenceVersion: 5,
    confirmedManualReview: true,
    reason: 'Đã đối chiếu nội dung và khai báo quyền.',
  });
});
it('does not report success when a claim has expired and keeps the feedback', async () => {
  mocks.apiRequest.mockImplementation((_path, options) =>
    options?.method === 'POST'
      ? Promise.reject(new Error('Claim đã hết hạn.'))
      : Promise.resolve(data),
  );
  view();
  await fill();
  fireEvent.click(screen.getByRole('button', { name: 'Ghi quyết định' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận', exact: true }));
  await screen.findByText('Claim đã hết hạn.');
  expect(screen.getByRole('button', { name: 'Xác nhận', exact: true }).disabled).toBe(true);
  expect(screen.getByLabelText('Lý do hoặc phản hồi cụ thể (ít nhất 10 ký tự)').value).toBe(
    'Đã đối chiếu nội dung và khai báo quyền.',
  );
});
