import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../../../src/context/LocaleContext';
import { ChapterEarlyAccessDialog } from '../../../src/pages/author/ChapterEarlyAccessDialog';
const mock = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../../src/api/client', () => ({ apiRequest: mock.apiRequest }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const data = {
  chapterId: 'chapter',
  title: 'Chương thật',
  version: 2,
  storyVersion: 4,
  canEdit: true,
  policy: {
    id: 'policy',
    version: 3,
    priceMinCoins: 200,
    priceMaxCoins: 5000,
    durationMinDays: 1,
    durationMaxDays: 14,
  },
  settings: { enabled: false, coinPrice: null, durationDays: null },
};
function view(value = data) {
  mock.apiRequest.mockResolvedValue(value);
  const onSaved = vi.fn();
  render(
    <LocaleProvider>
      <ChapterEarlyAccessDialog
        storyId="story"
        chapterId="chapter"
        onSaved={onSaved}
        onClose={() => {}}
      />
    </LocaleProvider>,
  );
  return onSaved;
}
it('loads actual policy and sends exact chapter/story/policy versions without an endsAt', async () => {
  const onSaved = view();
  await screen.findByText('Chương thật');
  expect(screen.getByText(/200–5000 xu, 1–14 ngày/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Giá đọc sớm (xu)'), { target: { value: '250' } });
  fireEvent.change(screen.getByLabelText('Thời hạn (ngày)'), { target: { value: '3' } });
  mock.apiRequest.mockResolvedValueOnce({
    chapterId: 'chapter',
    version: 3,
    storyVersion: 5,
    settings: { enabled: true, coinPrice: 250, durationDays: 3 },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mock.apiRequest.mock.calls[1]).toEqual([
    '/author/stories/story/chapters/chapter/early-access',
    {
      method: 'PUT',
      body: {
        enabled: true,
        coinPrice: 250,
        durationDays: 3,
        expectedVersion: 2,
        expectedStoryVersion: 4,
        policyId: 'policy',
        expectedPolicyVersion: 3,
      },
    },
  ]);
});
it('does not allow fractions, out-of-policy or blank values', async () => {
  view();
  await screen.findByText('Chương thật');
  fireEvent.click(screen.getByRole('checkbox'));
  for (const value of ['199', '5001', '200.5', '']) {
    fireEvent.change(screen.getByLabelText('Giá đọc sớm (xu)'), { target: { value } });
    expect(screen.getByRole('button', { name: 'Lưu thiết lập' }).disabled).toBe(true);
  }
  fireEvent.change(screen.getByLabelText('Giá đọc sớm (xu)'), { target: { value: '200' } });
  fireEvent.change(screen.getByLabelText('Thời hạn (ngày)'), { target: { value: '15' } });
  expect(screen.getByRole('button', { name: 'Lưu thiết lập' }).disabled).toBe(true);
});
it('allows turning off old settings when no current policy exists', async () => {
  const onSaved = view({
    ...data,
    policy: null,
    settings: { enabled: true, coinPrice: 250, durationDays: 3 },
  });
  await screen.findByText('Chương thật');
  fireEvent.click(screen.getByRole('checkbox'));
  mock.apiRequest.mockResolvedValueOnce({
    chapterId: 'chapter',
    version: 3,
    storyVersion: 5,
    settings: { enabled: false, coinPrice: null, durationDays: null },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mock.apiRequest.mock.calls[1][1].body).toEqual({
    enabled: false,
    expectedVersion: 2,
    expectedStoryVersion: 4,
  });
});
it('blocks enabling without policy and leaves locked chapters read-only', async () => {
  view({ ...data, policy: null, canEdit: false });
  await screen.findByText('Chương thật');
  expect(screen.getByRole('checkbox').disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Lưu thiết lập' })).toBeNull();
});
it('requires reload after a conflict without reporting success', async () => {
  const onSaved = view();
  await screen.findByText('Chương thật');
  fireEvent.click(screen.getByRole('checkbox'));
  mock.apiRequest.mockRejectedValueOnce(Object.assign(new Error('Policy đã đổi'), { status: 409 }));
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Lưu thiết lập' }).disabled).toBe(true);
  expect(onSaved).not.toHaveBeenCalled();
});
it('rejects malformed success responses', async () => {
  const onSaved = view();
  await screen.findByText('Chương thật');
  fireEvent.click(screen.getByRole('checkbox'));
  mock.apiRequest.mockResolvedValueOnce({ chapterId: 'other', settings: { enabled: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
  await screen.findByRole('alert');
  expect(onSaved).not.toHaveBeenCalled();
});

it('prevents duplicate requests while a save is pending', async () => {
  const onSaved = view();
  await screen.findByText('Chương thật');
  fireEvent.click(screen.getByRole('checkbox'));
  let finish;
  mock.apiRequest.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
  fireEvent.submit(screen.getByRole('checkbox').closest('form'));
  expect(
    mock.apiRequest.mock.calls.filter(([, options]) => options?.method === 'PUT'),
  ).toHaveLength(1);
  finish({
    chapterId: 'chapter',
    version: 3,
    storyVersion: 5,
    settings: { enabled: true, coinPrice: 200, durationDays: 1 },
  });
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});

it('lets approved settings be disabled without allowing their price or duration to change', async () => {
  const onSaved = view({
    ...data,
    canEdit: false,
    canDisable: true,
    settings: { enabled: true, coinPrice: 350, durationDays: 5 },
  });
  await screen.findByText('Chương thật');
  expect(screen.getByLabelText('Giá đọc sớm (xu)').disabled).toBe(true);
  expect(screen.getByLabelText('Thời hạn (ngày)').disabled).toBe(true);
  expect(screen.getByRole('checkbox').disabled).toBe(false);
  expect(screen.getByRole('button', { name: 'Lưu thiết lập' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Lưu thiết lập' }).disabled).toBe(false);
  mock.apiRequest.mockResolvedValueOnce({
    chapterId: 'chapter',
    version: 3,
    storyVersion: 5,
    settings: { enabled: false, coinPrice: null, durationDays: null },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu thiết lập' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(mock.apiRequest.mock.calls[1][1].body).toEqual({
    enabled: false,
    expectedVersion: 2,
    expectedStoryVersion: 4,
  });
});
it('cannot submit a price change in disable-only mode even if a change event is forged', async () => {
  const onSaved = view({
    ...data,
    canEdit: false,
    canDisable: true,
    settings: { enabled: true, coinPrice: 350, durationDays: 5 },
  });
  await screen.findByText('Chương thật');
  fireEvent.change(screen.getByLabelText('Giá đọc sớm (xu)'), { target: { value: '400' } });
  fireEvent.submit(screen.getByRole('checkbox').closest('form'));
  expect(mock.apiRequest.mock.calls.filter(([, o]) => o?.method === 'PUT')).toHaveLength(0);
  expect(onSaved).not.toHaveBeenCalled();
});
