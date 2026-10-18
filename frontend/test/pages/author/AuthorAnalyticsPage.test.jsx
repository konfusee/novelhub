import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { AuthorAnalyticsPage } from '../../../src/pages/author/AuthorAnalyticsPage';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/layouts', () => ({
  AuthorLayout: ({ children }) => <main>{children}</main>,
}));
const data = {
  daily: [0, 0, 0, 0, 0, 1, 2],
  labels: [
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
  ],
  stories: [{ id: 'real-owned', title: 'Truyện của tôi' }],
  chapters: [
    { id: 'chapter-one', title: 'Chương đầu', number: 1 },
    { id: 'chapter-two', title: 'Chương tiếp', number: 2 },
  ],
  reads: 3,
  readers: 2,
  audience: { accounts: 1, guestDevices: 1 },
  returningReaders: 1,
  returnRate: 50,
  completionProgress: { total: 3, completed: 1, rate: 100 / 3 },
};
const view = (url = '/author/analytics') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LocaleProvider>
        <AuthorAnalyticsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
it('shows verified unlock income including real zero and leaves invalid income unknown', async () => {
  mocks.apiRequest.mockResolvedValue({ ...data, verifiedUnlockIncome: 270 });
  view();
  expect(await screen.findByText('270 xu')).toBeTruthy();
  expect(screen.getByText(/Xu thực nhận từ các lượt mở khóa đã đối soát/)).toBeTruthy();
  cleanup();
  mocks.apiRequest.mockResolvedValue({ ...data, verifiedUnlockIncome: 0 });
  view();
  expect(await screen.findByText('0 xu')).toBeTruthy();
  cleanup();
  mocks.apiRequest.mockResolvedValue({ ...data, verifiedUnlockIncome: -1 });
  view();
  await screen.findByText('Truyện của tôi');
  expect(screen.queryByText('-1 xu')).toBeNull();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
it('exports actual daily rows and treats formula-like story titles as literal text', async () => {
  let report = '';
  vi.stubGlobal(
    'Blob',
    class {
      constructor(parts) {
        report = parts.join('');
      }
    },
  );
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL() {
        return 'blob:report';
      }
      static revokeObjectURL() {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  mocks.apiRequest.mockResolvedValue({
    ...data,
    stories: [{ id: 'real-owned', title: '=1+1' }],
    cohortRetention: [
      { day: 1, eligible: 4, returned: 2, rate: 50 },
      { day: 7, eligible: 3, returned: 1, rate: 100 / 3 },
    ],
  });
  view();
  await screen.findByText('3');
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn truyện' }));
  fireEvent.click(screen.getByRole('option', { name: '=1+1', exact: true }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Xuất báo cáo', exact: true }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn chương' }));
  fireEvent.click(screen.getByRole('option', { name: 'Chương 1: Chương đầu', exact: true }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Xuất báo cáo', exact: true }).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Xuất báo cáo', exact: true }));
  expect(report).toContain('"\'=1+1"');
  expect(report).toContain('"2026-10-16","2"');
  expect(report).toContain('"Chương","Chương 1: Chương đầu"');
  expect(report).toContain('"Tỷ lệ quay lại trong kỳ","50%"');
  expect(report).toContain('"Tiến độ chương hoàn thành","33,3%"');
  expect(report).toContain('"Tiến độ đọc được ghi nhận","3"');
  expect(report).toContain('"Tiến độ đạt 100%","1"');
  expect(report).toContain('"Định danh tài khoản","1"');
  expect(report).toContain('"Định danh thiết bị khách","1"');
  expect(report).toContain('"Giữ chân ngày 7","33,3%"');
  expect(report).toContain('"Định danh đủ ngày 7","3"');
  expect(report).toContain('"Định danh quay lại đúng ngày 7","1"');
});
it('renders recorded daily counts and unknown unsupported metrics without sample claims', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  expect(
    await screen.findByRole('img', { name: 'Biểu đồ 7 ngày, cao nhất 2 lượt đọc một ngày' }),
  ).toBeTruthy();
  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.queryByText('65%')).toBeNull();
  expect(screen.queryByText('1.248.500')).toBeNull();
  expect(screen.getByText('Chưa ghi nhận nguồn kênh khám phá cho các lượt đọc.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xuất báo cáo', exact: true }).disabled).toBe(false);
});
it('requests real owned story IDs and the chosen range rather than multiplying sample totals', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  await screen.findByText('3');
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn truyện' }));
  fireEvent.click(screen.getByRole('option', { name: 'Truyện của tôi', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/analytics?days=30&storyId=real-owned',
      expect.any(Object),
    ),
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Khoảng thời gian' }));
  fireEvent.click(screen.getByRole('option', { name: '7 ngày gần nhất', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/analytics?days=7&storyId=real-owned',
      expect.any(Object),
    ),
  );
});
it('shows retry on API failure and disables exporting fabricated data', async () => {
  mocks.apiRequest.mockRejectedValue(new Error('Offline'));
  view();
  expect(await screen.findByText('Không tải được dữ liệu phân tích')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Xuất báo cáo', exact: true }).disabled).toBe(true);
});
it('renders measured returners including a real zero rate and leaves an empty denominator unknown', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    returningReaders: 2,
    readers: 3,
    returnRate: 200 / 3,
  });
  view();
  expect(await screen.findByText('66,7%')).toBeTruthy();
  expect(screen.getByText('2 / 3 định danh có lượt đọc trong kỳ')).toBeTruthy();
  cleanup();
  mocks.apiRequest.mockResolvedValue({ ...data, returningReaders: 0, returnRate: 0 });
  view();
  expect(await screen.findByText('0%')).toBeTruthy();
  cleanup();
  mocks.apiRequest.mockResolvedValue({
    ...data,
    reads: 0,
    readers: 0,
    returningReaders: 0,
    returnRate: null,
  });
  view();
  expect(
    await screen.findByText('Chưa có lượt đọc để tính tỷ lệ quay lại trong bộ lọc này.'),
  ).toBeTruthy();
  expect(screen.queryByText('0%')).toBeNull();
});
it('opens a chapter deep link, keeps it across date ranges and clears it when the story changes', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view('/author/analytics?storyId=real-owned&chapterId=chapter-one');
  await screen.findByText('3');
  expect(mocks.apiRequest).toHaveBeenCalledWith(
    '/author/analytics?days=30&storyId=real-owned&chapterId=chapter-one',
    expect.any(Object),
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Khoảng thời gian' }));
  fireEvent.click(screen.getByRole('option', { name: '7 ngày gần nhất', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/analytics?days=7&storyId=real-owned&chapterId=chapter-one',
      expect.any(Object),
    ),
  );
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn truyện' }));
  fireEvent.click(screen.getByRole('option', { name: 'Tất cả truyện', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith('/author/analytics?days=7', expect.any(Object)),
  );
  expect(screen.getByRole('combobox', { name: 'Chọn chương' }).disabled).toBe(true);
});
it('requests the selected chapter and permits clearing a missing chapter without fake results', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view('/author/analytics?storyId=real-owned');
  await screen.findByText('3');
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn chương' }));
  fireEvent.click(screen.getByRole('option', { name: 'Chương 2: Chương tiếp', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/analytics?days=30&storyId=real-owned&chapterId=chapter-two',
      expect.any(Object),
    ),
  );
  mocks.apiRequest.mockRejectedValue(Object.assign(new Error('not found'), { status: 404 }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Khoảng thời gian' }));
  fireEvent.click(screen.getByRole('option', { name: '7 ngày gần nhất', exact: true }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Xuất báo cáo', exact: true }).disabled).toBe(true),
  );
  await screen.findByText('Chưa có dữ liệu phân tích');
  mocks.apiRequest.mockResolvedValue(data);
  fireEvent.click(screen.getByRole('combobox', { name: 'Chọn chương' }));
  fireEvent.click(screen.getByRole('option', { name: 'Tất cả chương', exact: true }));
  await waitFor(() =>
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/author/analytics?days=7&storyId=real-owned',
      expect.any(Object),
    ),
  );
  await screen.findByText('3');
});

it('shows measured completion with its explicit account/text/current-state scope', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  expect(await screen.findByText('33,3%')).toBeTruthy();
  expect(screen.getByText('1 / 3 tiến độ')).toBeTruthy();
  expect(screen.getByText(/Đây là trạng thái hiện tại, có thể đổi khi đọc lại/)).toBeTruthy();
});
it('distinguishes measured zero completion from no eligible progress', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    completionProgress: { total: 2, completed: 0, rate: 0 },
  });
  view();
  expect(await screen.findByText('0 / 2 tiến độ')).toBeTruthy();
  expect(screen.getByText('0%')).toBeTruthy();
  cleanup();
  mocks.apiRequest.mockResolvedValue({
    ...data,
    completionProgress: { total: 0, completed: 0, rate: null },
  });
  view();
  expect(await screen.findByText('Chưa có tiến độ đọc trong kỳ')).toBeTruthy();
  expect(screen.queryByText('0 / 0 tiến độ')).toBeNull();
});
it('does not display malformed completion counts as a measured percentage', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    completionProgress: { total: 1, completed: 2, rate: 200 },
  });
  view();
  await screen.findByText('Chưa có tiến độ đọc trong kỳ');
  expect(screen.queryByText('200%')).toBeNull();
});

it('shows only aggregated identity types with their counts and measured shares', async () => {
  mocks.apiRequest.mockResolvedValue(data);
  view();
  expect(await screen.findByRole('heading', { name: 'Loại định danh độc giả' })).toBeTruthy();
  expect(screen.getAllByText('1 (50%)')).toHaveLength(2);
  expect(screen.getByText(/không phải số người thực tế/)).toBeTruthy();
});
it('does not divide by zero or chart inconsistent audience totals', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    readers: 0,
    audience: { accounts: 0, guestDevices: 0 },
  });
  view();
  expect(
    await screen.findByText('Chưa có định danh độc giả hợp lệ trong bộ lọc này.'),
  ).toBeTruthy();
  expect(screen.queryByText(/NaN%/)).toBeNull();
  cleanup();
  mocks.apiRequest.mockResolvedValue({ ...data, audience: { accounts: 3, guestDevices: 1 } });
  view();
  await screen.findByText('Chưa có định danh độc giả hợp lệ trong bộ lọc này.');
  expect(screen.queryByText('3 (150%)')).toBeNull();
});

it('renders mature day-1/day-7 cohort denominators without mixing them with in-period return rate', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    cohortRetention: [
      { day: 1, eligible: 4, returned: 2, rate: 50 },
      { day: 7, eligible: 3, returned: 1, rate: 100 / 3 },
    ],
  });
  view();
  const section = (
    await screen.findByRole('heading', { name: 'Giữ chân theo ngày quan sát' })
  ).closest('section');
  expect(within(section).getByText('50%')).toBeTruthy();
  expect(within(section).getByText('33,3%')).toBeTruthy();
  expect(within(section).getByText('2 / 4 định danh đủ ngày quan sát')).toBeTruthy();
  expect(within(section).getByText('1 / 3 định danh đủ ngày quan sát')).toBeTruthy();
});
it('distinguishes zero mature-cohort returns from insufficient observation', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    cohortRetention: [
      { day: 1, eligible: 2, returned: 0, rate: 0 },
      { day: 7, eligible: 0, returned: 0, rate: null },
    ],
  });
  view();
  const section = (
    await screen.findByRole('heading', { name: 'Giữ chân theo ngày quan sát' })
  ).closest('section');
  expect(within(section).getByText('0%')).toBeTruthy();
  expect(within(section).getByText('0 / 2 định danh đủ ngày quan sát')).toBeTruthy();
  expect(within(section).getByText(/Chưa đủ ngày quan sát/)).toBeTruthy();
  expect(within(section).queryByText('0 / 0 định danh đủ ngày quan sát')).toBeNull();
});
it('does not chart invalid cohort responses as measured retention', async () => {
  mocks.apiRequest.mockResolvedValue({
    ...data,
    cohortRetention: [{ day: 1, eligible: 1, returned: 2, rate: 200 }],
  });
  view();
  const section = (
    await screen.findByRole('heading', { name: 'Giữ chân theo ngày quan sát' })
  ).closest('section');
  expect(within(section).queryByText('200%')).toBeNull();
  expect(within(section).getAllByText(/Chưa đủ ngày quan sát/)).toHaveLength(2);
});
