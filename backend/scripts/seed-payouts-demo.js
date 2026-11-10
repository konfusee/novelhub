import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { loadEnv } from '../src/config/env.js'
import { hashPassword } from '../src/auth/password.js'
import { withTransaction } from '../src/db/connection.js'
import {
  Account,
  AuditEvent,
  LedgerEntry,
  PayoutResultEntry,
  PayoutSheetRow,
  PolicyVersion,
  RoleAssignment,
  Wallet,
  WithdrawalRequest,
} from '../src/models/index.js'
import { createMonthlyPayoutRecords } from '../src/modules/coins-payouts/finance/monthly-payout-records.js'

const namespace = 'novelhub-payouts-demo-v1'
const id = key =>
  new mongoose.Types.ObjectId(
    createHash('sha256').update(`${namespace}:${key}`).digest('hex').slice(0, 24),
  )
const email = key => `${key}.payouts-demo@example.test`
const models = [
  Account,
  AuditEvent,
  LedgerEntry,
  PayoutResultEntry,
  PayoutSheetRow,
  RoleAssignment,
  Wallet,
  WithdrawalRequest,
]
const cases = [
  { key: 'rich', name: 'Tác giả nhiều xu', amount: 2000000 },
  { key: 'threshold', name: 'Tác giả vừa đủ ngưỡng', atThreshold: true },
  { key: 'below', name: 'Tác giả dưới ngưỡng', belowThreshold: true },
  { key: 'missing-bank', name: 'Tác giả thiếu ngân hàng', amount: 350000, missingBank: true },
  { key: 'pending', name: 'Khoản chi chờ xử lý', amount: 250000, payout: true, remaining: 25000 },
  { key: 'failed', name: 'Khoản chi thử thất bại', amount: 180000, payout: true, remaining: 12000 },
  { key: 'paid', name: 'Khoản chi đã trả', amount: 480000, payout: true, remaining: 80000 },
]

async function create(Model, data, session) {
  return (await Model.create([data], { session }))[0]
}

async function grantCoins(wallet, amount, key, session, now) {
  if (!amount) return
  await Wallet.updateOne(
    { _id: wallet._id },
    { $inc: { availableBalance: amount, balanceVersion: 1, version: 1 } },
    { session },
  )
  await create(
    LedgerEntry,
    {
      walletId: wallet._id,
      ledgerType: 'adjustment',
      direction: 'credit',
      amount,
      reason:
        '[DEMO PAYOUTS] Xu giả lập để kiểm thử; không phải doanh thu hay tiền ngân hàng thật.',
      actorAccountId: id('account:admin'),
      sourceType: namespace,
      sourceId: id('dataset'),
      idempotencyScope: {
        operation: namespace,
        ownerId: wallet.ownerId,
        key,
      },
      occurredAt: now,
    },
    session,
  )
}

async function seed(password) {
  const now = new Date()
  const date = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
    })
      .formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )
  const periodId = `${date.year}-${date.month}`
  const hash = await hashPassword(password)

  return withTransaction(async session => {
    const marker = await AuditEvent.findById(id('dataset')).session(session).lean()
    if (marker) return { created: false }

    const keys = ['admin', ...cases.map(item => item.key)]
    if (
      await Account.exists({
        $or: [
          { _id: { $in: keys.map(key => id(`account:${key}`)) } },
          { normalizedEmail: { $in: keys.map(email) } },
        ],
      }).session(session)
    ) {
      throw new Error('Demo account collision')
    }

    const policy = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
      .sort({ effectiveAt: -1, _id: -1 })
      .session(session)
      .lean()
    const threshold = policy?.withdrawalThresholdCoins
    if (!Number.isSafeInteger(threshold) || threshold < 2 || threshold > 1000000000) {
      throw new Error('Missing or unsupported effective payout policy')
    }

    for (const key of keys) {
      const scenario = cases.find(item => item.key === key)
      await create(
        Account,
        {
          _id: id(`account:${key}`),
          email: email(key),
          displayName: `[DEMO PAYOUTS] ${scenario?.name ?? 'Quản trị'}`,
          status: 'active',
          emailVerifiedAt: now,
          everAuthor: key !== 'admin',
          password: { hash, algorithm: 'scrypt', updatedAt: now },
          ...(scenario && !scenario.missingBank
            ? {
                bankDetails: {
                  bankName: 'TPBank [DEMO]',
                  accountNumber: `000000${String(keys.indexOf(key)).padStart(4, '0')}`,
                  accountHolder: 'TAI KHOAN GIA LAP PAYOUTS',
                },
              }
            : {}),
        },
        session,
      )
      await create(
        RoleAssignment,
        {
          _id: id(`role:${key}`),
          accountId: id(`account:${key}`),
          role: key === 'admin' ? 'admin' : 'author',
          status: 'active',
          grantedBy: id('account:admin'),
          grantedAt: now,
        },
        session,
      )
    }

    for (const scenario of cases) {
      const account = await Account.findById(id(`account:${scenario.key}`))
        .select('+bankDetails')
        .session(session)
      let wallet = await create(
        Wallet,
        {
          _id: id(`wallet:${scenario.key}`),
          ownerType: 'account',
          ownerId: account._id,
          purpose: 'author-earnings',
          availableBalance: 0,
        },
        session,
      )
      const amount = scenario.atThreshold
        ? threshold
        : scenario.belowThreshold
          ? Math.floor(threshold / 2)
          : Math.max(scenario.amount, threshold * 2)
      await grantCoins(wallet, amount, `${scenario.key}:opening`, session, now)
      if (!scenario.payout) continue

      wallet = await Wallet.findById(wallet._id).session(session)
      const result = await createMonthlyPayoutRecords(
        {
          account,
          wallet,
          periodId,
          policy,
          actorAccountId: id('account:admin'),
        },
        session,
        now,
      )
      if (result.state !== 'created') throw new Error('Expected demo payout creation')

      const withdrawal = await WithdrawalRequest.findById(result.withdrawalId).session(session)
      const attempts =
        scenario.key === 'failed' ? ['Failed'] : scenario.key === 'paid' ? ['Failed', 'Paid'] : []
      for (const [index, outcome] of attempts.entries()) {
        await create(
          PayoutResultEntry,
          {
            _id: id(`result:${scenario.key}:${index}`),
            withdrawalRequestId: withdrawal._id,
            resultEntryKey: `${namespace}:${scenario.key}:${index}`,
            actorAccountId: id('account:admin'),
            occurredAt: new Date(now.getTime() - (attempts.length - index) * 1000),
            result: outcome,
            note: `[DEMO PAYOUTS] ${outcome === 'Paid' ? 'Giả lập thành công sau lần thử lại' : 'Giả lập chuyển khoản thất bại'}`,
            ...(outcome === 'Paid' ? { transferReference: `SIM-DEMO-${withdrawal._id}` } : {}),
          },
          session,
        )
      }
      if (scenario.key === 'paid') {
        withdrawal.status = 'paid'
        await withdrawal.save({ session })
      }
      if (attempts.length) {
        await create(
          AuditEvent,
          {
            actorType: 'account',
            actorId: id('account:admin'),
            action: 'monthly-payout.result-recorded',
            targetType: 'WithdrawalRequest',
            targetId: withdrawal._id,
            result: 'committed',
            occurredAt: now,
          },
          session,
        )
      }
      await grantCoins(wallet, scenario.remaining, `${scenario.key}:later-income`, session, now)
    }
    await create(
      AuditEvent,
      {
        _id: id('dataset'),
        actorType: 'account',
        actorId: id('account:admin'),
        action: 'demo.payouts.seeded',
        targetType: namespace,
        targetId: id('dataset'),
        result: 'committed',
        occurredAt: now,
      },
      session,
    )
    return { created: true, periodId, thresholdCoins: threshold }
  })
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some(arg => !['--apply', '--current-db'].includes(arg)))
    throw new Error('Invalid arguments')
  if (!args.includes('--apply')) {
    console.log(
      JSON.stringify(
        {
          mode: 'preview',
          authors: cases,
          admin: email('admin'),
          note: 'Add --current-db --apply to add this isolated demo dataset.',
        },
        null,
        2,
      ),
    )
    return
  }
  if (!args.includes('--current-db')) throw new Error('Explicit database selection required')
  loadDotenv()
  const env = loadEnv()
  if (env.NODE_ENV === 'production') throw new Error('No demo data in production')
  await mongoose.connect(env.MONGODB_URI, {
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
  })
  if (!(await mongoose.connection.db.admin().command({ hello: 1 })).setName) {
    throw new Error('Replica set required')
  }
  const database = mongoose.connection.db.databaseName
  const credentials = new URL(`../.tmp/${namespace}-${database}.credentials.json`, import.meta.url)
  const manifest = new URL(`../.tmp/${namespace}-${database}.manifest.json`, import.meta.url)
  await mkdir(new URL('../.tmp/', import.meta.url), { recursive: true })
  let saved
  try {
    saved = JSON.parse(await readFile(credentials, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (saved && (saved.database !== database || saved.namespace !== namespace)) {
    throw new Error('Credential file mismatch')
  }
  if (!saved) {
    if (await AuditEvent.exists({ _id: id('dataset') }))
      throw new Error('Existing demo credentials missing')
    saved = {
      namespace,
      database,
      password: `Demo!${randomBytes(20).toString('base64url')}`,
      accounts: ['admin', ...cases.map(item => item.key)].map(key => ({ email: email(key) })),
    }
    await writeFile(credentials, JSON.stringify(saved, null, 2), { flag: 'wx', mode: 0o600 })
  }
  for (const Model of models) {
    await Model.createCollection()
    await Model.createIndexes()
  }
  const result = await seed(saved.password)
  const authors = []
  for (const scenario of cases) {
    const accountId = id(`account:${scenario.key}`)
    const wallet = await Wallet.findById(id(`wallet:${scenario.key}`)).lean()
    const withdrawals = await WithdrawalRequest.find({ accountId })
      .select('periodId status amountCoins')
      .lean()
    const entries = await LedgerEntry.find({ walletId: wallet._id })
      .select('direction amount')
      .lean()
    const total = entries.reduce(
      (sum, entry) => sum + (entry.direction === 'credit' ? entry.amount : -entry.amount),
      0,
    )
    if (total !== wallet.availableBalance) throw new Error('Demo ledger balance mismatch')
    authors.push({ email: email(scenario.key), balanceCoins: wallet.availableBalance, withdrawals })
  }
  const summary = { database, ...result, authors, credentialsFile: fileURLToPath(credentials) }
  await writeFile(manifest, JSON.stringify(summary, null, 2), { mode: 0o600 })
  console.log(JSON.stringify(summary, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(
    `Payout demo seed failed (${error.name}). No connection credentials printed; check database, policy and indexes.`,
  )
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
