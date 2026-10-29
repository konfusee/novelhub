import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { loadDotenv } from '../src/config/load-dotenv.js'
import { loadEnv } from '../src/config/env.js'
import { AuditEvent } from '../src/models/index.js'
import {
  CoinsDemoError,
  DEMO_NAMESPACE,
  demoAccounts,
  demoId,
  demoModels,
  seedCoinsDemo,
} from './lib/coins-demo.js'

function optionsFrom(args) {
  const options = { apply: false, current: false, database: null }
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--apply') options.apply = true
    else if (args[index] === '--current-db') options.current = true
    else if (args[index] === '--database') {
      options.database = args[++index]
      if (!options.database || !/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(options.database)) {
        throw new CoinsDemoError('Tên database chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.')
      }
    } else throw new CoinsDemoError(`Tham số không được hỗ trợ: ${args[index]}`)
  }
  if (options.current && options.database) {
    throw new CoinsDemoError('Chỉ chọn --current-db hoặc --database, không chọn cả hai.')
  }
  if (options.apply && !options.current && !options.database) {
    throw new CoinsDemoError(
      'Chọn rõ --database novelhub_coins_demo hoặc --current-db trước khi thêm --apply.',
    )
  }
  return options
}

async function main() {
  const options = optionsFrom(process.argv.slice(2))
  if (!options.apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'preview-only',
          namespace: DEMO_NAMESPACE,
          target: options.current
            ? 'database trong backend/.env'
            : (options.database ?? 'chưa chọn'),
          accounts: demoAccounts.map(({ email, role }) => ({ email, role })),
          stories: 2,
          chapters: 7,
          topUpPackages: 3,
          note: 'Chưa kết nối hay ghi database. Thêm --apply và chọn database để thực hiện.',
        },
        null,
        2,
      ),
    )
    return
  }

  loadDotenv()
  const env = loadEnv()
  if (env.NODE_ENV === 'production') {
    throw new CoinsDemoError('Không tạo dữ liệu demo khi NODE_ENV=production.')
  }
  await mongoose.connect(env.MONGODB_URI, {
    ...(options.database ? { dbName: options.database } : {}),
    autoCreate: false,
    autoIndex: false,
    serverSelectionTimeoutMS: env.DB_SERVER_SELECTION_TIMEOUT_MS,
  })
  const hello = await mongoose.connection.db.admin().command({ hello: 1 })
  if (!hello.setName)
    throw new CoinsDemoError('Database phải chạy replica set để seed trong transaction.')

  const database = mongoose.connection.db.databaseName
  const credentialsUrl = new URL(
    `../.tmp/${DEMO_NAMESPACE}-${database}.credentials.json`,
    import.meta.url,
  )
  const manifestUrl = new URL(
    `../.tmp/${DEMO_NAMESPACE}-${database}.manifest.json`,
    import.meta.url,
  )
  await mkdir(new URL('../.tmp/', import.meta.url), { recursive: true })

  const marker = await AuditEvent.findById(demoId('dataset')).lean()
  let password
  if (!marker) {
    try {
      const saved = JSON.parse(await readFile(credentialsUrl, 'utf8'))
      if (saved.namespace !== DEMO_NAMESPACE || saved.database !== database) {
        throw new CoinsDemoError('File đăng nhập demo không khớp database. Không ghi đè file cũ.')
      }
      password = saved.password
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      password = `Demo!${randomBytes(20).toString('base64url')}`
      await writeFile(
        credentialsUrl,
        JSON.stringify(
          {
            namespace: DEMO_NAMESPACE,
            database,
            password,
            accounts: demoAccounts.map(({ email, role }) => ({ email, role })),
            note: 'Mật khẩu chỉ dùng cho tài khoản demo; file này nằm trong backend/.tmp và bị Git bỏ qua.',
          },
          null,
          2,
        ),
        { flag: 'wx', mode: 0o600 },
      )
    }
  }

  // Add indexes, never sync/drop existing indexes. No seed data is inserted yet.
  for (const Model of demoModels) {
    await Model.createCollection()
    await Model.createIndexes()
  }
  const result = await seedCoinsDemo({ password })
  await writeFile(manifestUrl, JSON.stringify({ database, ...result }, null, 2), { mode: 0o600 })
  console.log(
    JSON.stringify(
      {
        database,
        created: result.created,
        credentialsFile: fileURLToPath(credentialsUrl),
        manifestFile: fileURLToPath(manifestUrl),
        note: result.created
          ? 'Đã thêm bộ demo. Xu ban đầu là điều chỉnh có nhãn demo, không phải thanh toán SePay.'
          : 'Bộ demo đã có; không đặt lại mật khẩu, số dư hoặc thời hạn chương. Nếu file đăng nhập đã mất, script không đổi mật khẩu để khôi phục.',
      },
      null,
      2,
    ),
  )
}

try {
  await main()
} catch (error) {
  console.error(
    error instanceof CoinsDemoError
      ? error.message
      : `Không hoàn tất seed (${error.name}). Không in URI hoặc thông tin đăng nhập database. Kiểm tra kết nối, indexes và dữ liệu hiện có.`,
  )
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
