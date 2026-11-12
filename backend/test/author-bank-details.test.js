import request from 'supertest'
import { expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import { Account, AuditEvent } from '../src/models/index.js'
import { authenticatedAccount } from './fixtures/accounts.js'
import { testConfig } from './config.js'
import { useTestDatabase } from './db.js'

useTestDatabase()

const origin = 'http://localhost:5173'
const endpoint = '/api/author/bank-details'
const mask = bank => ({ ...bank, accountNumber: '••••' + bank.accountNumber.slice(-4) })
const action = 'author.bank-details.updated'

const app = createApp(testConfig({ corsOrigin: origin }))

const bank = {
  bankName: 'TPBank',
  accountNumber: '0123456789',
  accountHolder: 'NGUYEN VAN A',
}
const maskedBank = { ...bank, accountNumber: '••••6789' }

function saveBank(cookie, body) {
  return request(app).put(endpoint).set('Cookie', cookie).set('Origin', origin).send(body)
}

async function storedBank(accountId) {
  const account = await Account.findById(accountId).select('+bankDetails').lean()

  return account.bankDetails
}

it('khách và reader không được xem hoặc sửa ngân hàng tác giả', async () => {
  expect((await request(app).get(endpoint)).status).toBe(401)
  expect((await request(app).put(endpoint).send(bank)).status).toBe(401)

  const reader = await authenticatedAccount()

  expect((await request(app).get(endpoint).set('Cookie', reader.cookie)).status).toBe(403)

  expect((await saveBank(reader.cookie, bank)).status).toBe(403)
  expect(await AuditEvent.countDocuments({ action })).toBe(0)
})

it('chưa có ngân hàng thì trả null, không tự lưu dữ liệu', async () => {
  const author = await authenticatedAccount('author')

  const response = await request(app).get(endpoint).set('Cookie', author.cookie)

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ bankDetails: null })
  expect(response.headers['cache-control']).toBe('private, no-store')

  expect(await storedBank(author.account._id)).toBeUndefined()
  expect(await AuditEvent.countDocuments({ action })).toBe(0)
})

it('lưu đúng tài khoản, bỏ khoảng trắng và không sửa ngân hàng người khác', async () => {
  const author = await authenticatedAccount('author')
  const otherBank = {
    bankName: 'Other Bank',
    accountNumber: '9999999999',
    accountHolder: 'OTHER AUTHOR',
  }
  const other = await authenticatedAccount('author', {
    bankDetails: otherBank,
  })

  const response = await saveBank(author.cookie, {
    bankName: ' TPBank ',
    accountNumber: ' 0123456789 ',
    accountHolder: ' NGUYEN VAN A ',
  })

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ bankDetails: mask(bank) })
  expect(response.headers['cache-control']).toBe('private, no-store')

  expect(await storedBank(author.account._id)).toEqual(bank)
  expect(await storedBank(other.account._id)).toEqual(otherBank)

  const ownResponse = await request(app).get(endpoint).set('Cookie', author.cookie)

  const otherResponse = await request(app).get(endpoint).set('Cookie', other.cookie)

  expect(ownResponse.body).toEqual({ bankDetails: mask(bank) })
  expect(otherResponse.body).toEqual({ bankDetails: mask(otherBank) })

  const audit = await AuditEvent.findOne({
    action,
    actorId: author.account._id,
  }).lean()

  expect(audit).not.toBeNull()
  expect(String(audit.targetId)).toBe(String(author.account._id))

  // Truy vấn bình thường vẫn không lấy thông tin ngân hàng.
  const publicAccount = await Account.findById(author.account._id).lean()
  expect(publicAccount.bankDetails).toBeUndefined()
})

it('dữ liệu thiếu hoặc có trường ngoài danh sách bị từ chối, giữ nguyên thông tin cũ', async () => {
  const author = await authenticatedAccount('author', {
    bankDetails: bank,
  })

  const invalidBodies = [
    { bankName: 'TPBank' },
    { ...bank, accountNumber: 'abc12345' },
    { ...bank, accountNumber: '12345' },
    { ...bank, accountHolder: '   ' },
    { ...bank, accountId: String(author.account._id) },
  ]

  for (const body of invalidBodies) {
    expect((await saveBank(author.cookie, body)).status).toBe(400)
  }

  expect(await storedBank(author.account._id)).toEqual(bank)
  expect(await AuditEvent.countDocuments({ action })).toBe(0)
})

it('ghi audit lỗi thì rollback cả việc thay đổi ngân hàng', async () => {
  const author = await authenticatedAccount('author', {
    bankDetails: bank,
  })

  const spy = vi.spyOn(AuditEvent, 'create').mockRejectedValueOnce(new Error('Test audit failure'))

  try {
    const response = await saveBank(author.cookie, {
      ...bank,
      accountNumber: '8888888888',
    })

    expect(response.status).toBe(500)
  } finally {
    spy.mockRestore()
  }

  expect(await storedBank(author.account._id)).toEqual(bank)
  expect(await AuditEvent.countDocuments({ action })).toBe(0)
})
