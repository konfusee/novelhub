import { expect, it } from 'vitest'
import { financeNotificationView } from '../src/modules/coins-payouts/finance/finance-notifications.js'

it.each([
  ['monthly-payout.created', 'Đã lập khoản chi trả cho bạn', '150.000 xu'],
  ['monthly-payout.Paid', 'Chi trả giả lập thành công', 'Không có chuyển khoản ngân hàng thực tế'],
  ['monthly-payout.Failed', 'Chi trả giả lập chưa thành công', 'không trích thêm xu'],
  [
    'monthly-payout.bank-details-missing',
    'Cần kiểm tra ngân hàng nhận chi trả',
    'Xu vẫn nằm trong ví',
  ],
])(
  'renders %s with a meaningful destination and keeps private notes out',
  (eventType, title, body) => {
    const view = financeNotificationView({
      eventType,
      payload: {
        periodId: '2026-11',
        amountCoins: 150000,
        executionMode: 'simulation',
        reason: 'PRIVATE SUPPORT NOTES',
        accountNumber: '0123456789',
      },
    })
    expect(view.title).toBe(title)
    expect(view.description).toContain(body)
    expect(view.description).toContain('2026-11')
    expect(view).toMatchObject({ href: '/author/earnings', action: 'Xem doanh thu' })
    expect(JSON.stringify(view)).not.toContain('PRIVATE')
    expect(JSON.stringify(view)).not.toContain('0123456789')
  },
)

it('does not intercept another module notifications or call legacy payments simulations', () => {
  expect(financeNotificationView({ eventType: 'story.chapter-released' })).toBeNull()
  const legacy = financeNotificationView({
    eventType: 'monthly-payout.Paid',
    payload: { amountCoins: 100000 },
  })
  expect(legacy.title).toBe('Khoản chi trả đã thanh toán')
  expect(legacy.description).not.toContain('giả lập')
})
