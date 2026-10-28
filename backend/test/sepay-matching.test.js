import { expect, it } from 'vitest'
import { extractPaymentCode, classifyTopUpOrder } from '../src/modules/sepay-webhook.js'

const now = new Date('2026-10-28T07:00:00Z')

const pendingOrder = {
  status: 'pending',
  expiresAt: new Date('2026-10-28T08:00:00Z'),
  packageSnapshot: {
    priceVnd: 50000,
  },
}

it('lấy mã từ nội dung khi SePay chưa nhận diện code', () => {
  const code = extractPaymentCode({
    code: null,
    content: 'NAP XU nh12345678',
  })

  expect(code).toBe('NH12345678')
})

it('mã xuất hiện ở cả hai trường vẫn được nhận diện', () => {
  const code = extractPaymentCode({
    code: 'NH12345678',
    content: 'NAP XU NH12345678',
  })

  expect(code).toBe('NH12345678')
})

it('không tự chọn đơn khi có hai mã khác nhau', () => {
  const code = extractPaymentCode({
    code: 'NH12345678',
    content: 'NAP XU NH87654321',
  })

  expect(code).toBeNull()
})

it('không lấy nhầm phần đầu của mã có quá 8 chữ số', () => {
  const code = extractPaymentCode({
    code: null,
    content: 'NH123456789',
  })

  expect(code).toBeNull()
})

it('đơn còn hạn và đúng số tiền thì khớp', () => {
  expect(classifyTopUpOrder(pendingOrder, 50000, now)).toBe('matched')
})

it.each([49000, 51000])('số tiền %i không khớp đơn 50000', amount => {
  expect(classifyTopUpOrder(pendingOrder, amount, now)).toBe('amount-mismatch')
})

it('không tìm thấy đơn thì không khớp', () => {
  expect(classifyTopUpOrder(null, 50000, now)).toBe('unmatched')
})

it('đơn đã thanh toán không được coi là đơn chờ hợp lệ', () => {
  const order = { ...pendingOrder, status: 'paid' }

  expect(classifyTopUpOrder(order, 50000, now)).toBe('already-paid')
})

it('đúng thời điểm hết hạn thì đơn đã hết hạn', () => {
  const order = { ...pendingOrder, expiresAt: now }

  expect(classifyTopUpOrder(order, 50000, now)).toBe('expired')
})

it('đơn vẫn pending nhưng đã quá hạn thì không được khớp', () => {
  const order = {
    ...pendingOrder,
    expiresAt: new Date('2026-10-28T06:00:00Z'),
  }

  expect(classifyTopUpOrder(order, 50000, now)).toBe('expired')
})
