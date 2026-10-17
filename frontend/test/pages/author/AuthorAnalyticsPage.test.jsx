import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  returningReaders: 1,
  returnRate: 50,
};
const view = (url = '/author/analytics') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LocaleProvider>
        <AuthorAnalyticsPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
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
  mocks.apiRequest.mockResolvedValue({ ...data, stories: [{ id: 'real-owned', title: '=1+1' }] });
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
