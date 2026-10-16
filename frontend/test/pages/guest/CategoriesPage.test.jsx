import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { CategoriesPage } from '../../../src/pages/guest/CategoriesPage';
import { LocaleProvider } from '../../../src/context/LocaleContext';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('../../../src/components/public/PublicHeader', () => ({
  PublicHeader: () => <header>Header hiện có</header>,
}));
const response = {
  categories: [
    {
      id: 'a',
      name: 'Thể loại từ MongoDB',
      description: 'Mô tả lưu trong database',
      icon: 'Sparkles',
      tone: 'purple',
      count: 7,
    },
  ],
  collections: { fantasy: [], romance: [], scifi: [], gems: [] },
  tags: [],
};
const view = () =>
  render(
    <MemoryRouter>
      <LocaleProvider>
        <CategoriesPage />
      </LocaleProvider>
    </MemoryRouter>,
  );
beforeEach(() => mocks.apiRequest.mockReset());
afterEach(cleanup);
describe('categories use database data without replacing the existing UI', () => {
  it('renders API names, counts and descriptions using the existing cards and selection', async () => {
    mocks.apiRequest.mockResolvedValue(response);
    view();
    expect(await screen.findByText('Mô tả lưu trong database')).toBeTruthy();
    expect(screen.getByText('7 truyện')).toBeTruthy();
    expect(screen.getByText('1 thể loại chính')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Thể loại từ MongoDB/ }));
    expect(
      screen.getByRole('button', { name: /Thể loại từ MongoDB/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('link', { name: 'Xem truyện' }).getAttribute('href')).toContain(
      encodeURIComponent('Thể loại từ MongoDB'),
    );
    expect(mocks.apiRequest).toHaveBeenCalledWith('/catalog/discovery', expect.any(Object));
  });
  it('shows the original error/retry state without falling back to the nine mock categories', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response);
    view();
    await waitFor(() => expect(screen.queryByText('Mô tả lưu trong database')).toBeNull());
    const retry = await screen.findAllByRole('button', { name: 'Thử lại' });
    fireEvent.click(retry[0]);
    expect(await screen.findByText('Mô tả lưu trong database')).toBeTruthy();
    expect(screen.queryByText('14.2K')).toBeNull();
  });
});
