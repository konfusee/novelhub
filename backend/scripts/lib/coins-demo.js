import { createHash } from 'node:crypto'
import mongoose from 'mongoose'
import {
  Account,
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  LedgerEntry,
  PolicyVersion,
  PublicationSubmission,
  RightsDeclaration,
  RoleAssignment,
  Story,
  TopUpPackage,
  Wallet,
} from '../../src/models/index.js'
import { hashPassword } from '../../src/auth/password.js'
import { withTransaction } from '../../src/db/connection.js'

export const DEMO_NAMESPACE = 'novelhub-coins-demo-v1'
const DAY = 86400000

export class CoinsDemoError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CoinsDemoError'
  }
}

export function demoId(label) {
  const hex = createHash('sha256').update(`${DEMO_NAMESPACE}:${label}`).digest('hex').slice(0, 24)
  return new mongoose.Types.ObjectId(hex)
}

export const demoAccounts = [
  {
    key: 'admin',
    email: 'admin.coins-demo@example.test',
    name: '[DEMO COINS] Quản trị',
    role: 'admin',
  },
  {
    key: 'author',
    email: 'author.coins-demo@example.test',
    name: '[DEMO COINS] Minh An',
    role: 'author',
  },
  {
    key: 'rich',
    email: 'reader.coins-demo@example.test',
    name: '[DEMO COINS] Reader đủ xu',
    role: 'reader',
  },
  {
    key: 'poor',
    email: 'poor.coins-demo@example.test',
    name: '[DEMO COINS] Reader thiếu xu',
    role: 'reader',
  },
  {
    key: 'empty',
    email: 'empty.coins-demo@example.test',
    name: '[DEMO COINS] Reader ví rỗng',
    role: 'reader',
  },
]

const stories = [
  {
    key: 'rain',
    title: '[DEMO COINS] Thành phố sau cơn mưa',
    category: 'fantasy',
    description: 'Truyện hư cấu do bộ seed tạo để thử chương miễn phí, mua quyền đọc và số dư ví.',
    chapters: [
      { title: 'Lá thư dưới mái hiên', access: 'free' },
      { title: 'Cánh cửa sau hiệu sách', access: 'paid', priceOffset: 0 },
      { title: 'Người giữ đồng hồ', access: 'paid', priceOffset: 500 },
      { title: 'Buổi sáng không còn mưa', access: 'expired', priceOffset: 1000 },
    ],
  },
  {
    key: 'station',
    title: '[DEMO COINS] Nhật ký trạm sao',
    category: 'scifi',
    description:
      'Truyện mẫu có chương đầu đang đọc sớm, dùng thử màn hình khóa cho khách chưa đăng nhập.',
    chapters: [
      { title: 'Tín hiệu từ quỹ đạo xa', access: 'paid', priceOffset: 0 },
      { title: 'Bữa sáng ngoài tầng khí quyển', access: 'free' },
      { title: 'Chuyến tàu cuối cùng', access: 'paid', priceOffset: 1000 },
    ],
  },
]

const categories = [
  { key: 'fantasy', name: '[DEMO COINS] Kỳ ảo' },
  { key: 'scifi', name: '[DEMO COINS] Viễn tưởng' },
]

export const demoModels = [
  Account,
  AuditEvent,
  Category,
  Chapter,
  ContentRevision,
  LedgerEntry,
  PolicyVersion,
  PublicationSubmission,
  RightsDeclaration,
  RoleAssignment,
  Story,
  TopUpPackage,
  Wallet,
]

const chapterKey = (story, index) => `${story.key}:chapter:${index + 1}`

function paragraphs(story, chapter, index) {
  const scenes =
    story.key === 'rain'
      ? [
          'Minh trở về con phố cũ khi cơn mưa vừa dứt. Dưới mái hiên hiệu sách, một phong thư không ghi người gửi nằm cạnh chiếc ô màu xanh. Cậu nhận ra nét chữ trên phong bì giống hệt dòng chữ trong cuốn sổ của bà.',
          'Hiệu sách chỉ có một ngọn đèn còn sáng. Người bán hàng trao cho Minh chiếc chìa khóa đồng và chỉ về phía bức tường đầy bản đồ. Cánh cửa nhỏ phía sau kệ sách mở ra một con đường mà ban ngày không ai nhìn thấy.',
          'Trên quảng trường yên tĩnh, người giữ đồng hồ đặt ba chiếc kim lên bàn. Mỗi chiếc đánh dấu một lời hẹn đã bị lãng quên. Minh phải chọn lời hẹn mình muốn giữ trước khi tiếng chuông đầu tiên vang lên.',
          'Buổi sáng cuối cùng, thành phố hiện ra trong nắng nhẹ. Minh trả chiếc chìa khóa về hiệu sách rồi đọc hết lá thư. Có những điều không cần giữ bí mật nữa, cũng như một con đường đã mở thì ai cũng có thể bước qua.',
        ]
      : [
          'Trạm sao nhận được một tín hiệu lặp lại từ quỹ đạo xa. Linh trực ca đêm, kiểm tra từng dòng dữ liệu và nhận ra đó không phải nhiễu. Xen giữa những con số là một lời chào được gửi từ nhiều năm trước.',
          'Buổi sáng trên trạm bắt đầu bằng tiếng quạt thông gió và mùi bánh mới. Qua ô cửa tròn, hành tinh xanh chậm rãi xoay. Linh kể câu chuyện về tín hiệu cho đồng đội, còn mọi người cùng vẽ một bản đồ chuyến đi.',
          'Chuyến tàu cuối cùng chuẩn bị rời bến khi đường truyền bất ngờ sáng lên. Linh ghi lời đáp vào cuốn nhật ký, gấp bản đồ và bước lên khoang lái. Phía trước họ là một khoảng trời chưa từng có tên.',
        ]
  return [
    `[DỮ LIỆU MẪU COINS] ${story.title} — Chương ${index + 1}: ${chapter.title}. Đây là nội dung hư cấu dùng kiểm tra luồng đọc, không phải chương của người dùng thật.`,
    scenes[index],
    'Nhân vật dừng lại để ghi những điều vừa chứng kiến. Những chi tiết tưởng nhỏ bé nối với nhau thành một câu chuyện mới, khiến hành trình phía trước vừa gần gũi vừa khó đoán.',
    'Đoạn văn này được tạo riêng cho bộ demo. Nếu chương đang thu phí và chưa có quyền đọc, API nội dung phải chặn toàn bộ các đoạn văn này, dù tài khoản đã đăng nhập hoặc có đủ xu.',
    'Hết chương mẫu. Hãy thử chuyển chương, quay lại danh sách và kiểm tra trạng thái khóa bằng các tài khoản demo có số dư khác nhau.',
  ]
}

async function createOne(Model, value, session) {
  const [document] = await Model.create([value], { session })
  return document
}

function accountSummary() {
  return demoAccounts.map(account => ({
    id: String(demoId(`account:${account.key}`)),
    email: account.email,
    role: account.role,
    walletId: ['rich', 'poor', 'empty'].includes(account.key)
      ? String(demoId(`wallet:${account.key}`))
      : undefined,
  }))
}

async function summary(session, created) {
  const wallets = await Wallet.find({
    _id: { $in: ['rich', 'poor', 'empty'].map(key => demoId(`wallet:${key}`)) },
  })
    .session(session)
    .lean()
  const balances = new Map(wallets.map(wallet => [String(wallet._id), wallet.availableBalance]))
  const result = []
  for (const story of stories) {
    const rows = await Chapter.find({ storyId: demoId(`story:${story.key}`) })
      .sort({ orderKey: 1 })
      .session(session)
      .lean()
    if (rows.length !== story.chapters.length) {
      throw new CoinsDemoError(
        'Bộ demo đã bị thay đổi hoặc thiếu chương. Script không tự đặt lại dữ liệu; cần kiểm tra bộ demo hiện có.',
      )
    }
    result.push({
      id: String(demoId(`story:${story.key}`)),
      title: story.title,
      href: `/stories/${demoId(`story:${story.key}`)}`,
      chapters: rows.map(row => ({
        id: String(row._id),
        title: row.title,
        revisionId: String(row.publishedRevisionId),
        coinPrice: row.earlyAccess?.coinPrice ?? 0,
        earlyAccessEndsAt: row.earlyAccess?.endsAt ?? null,
        href: `/read/${row.storyId}/${row._id}`,
      })),
    })
  }
  const packages = await TopUpPackage.find({
    _id: { $in: [10000, 20000, 50000].map(amount => demoId(`package:${amount}`)) },
  })
    .sort({ priceVnd: 1 })
    .session(session)
    .lean()
  return {
    namespace: DEMO_NAMESPACE,
    created,
    accounts: accountSummary().map(account => ({
      ...account,
      ...(account.walletId ? { balance: balances.get(account.walletId) } : {}),
    })),
    packages: packages.map(pack => ({
      id: String(pack._id),
      priceVnd: pack.priceVnd,
      coinAmount: pack.coinAmount,
      status: pack.status,
    })),
    stories: result,
  }
}

/** Adds one synthetic demo dataset. Never clears collections or resets existing balances. */
export async function seedCoinsDemo({ password, now = new Date() } = {}) {
  return withTransaction(async session => {
    const marker = await AuditEvent.findById(demoId('dataset')).session(session).lean()
    if (marker) {
      if (marker.action !== 'demo.coins.seeded')
        throw new CoinsDemoError('ID bộ demo đã được dùng bởi dữ liệu khác.')
      return summary(session, false)
    }
    if (typeof password !== 'string' || password.length < 16) {
      throw new CoinsDemoError('Mật khẩu tài khoản demo phải có ít nhất 16 ký tự.')
    }
    for (const account of demoAccounts) {
      const existing = await Account.exists({
        $or: [{ _id: demoId(`account:${account.key}`) }, { normalizedEmail: account.email }],
      }).session(session)
      if (existing)
        throw new CoinsDemoError(
          `Tài khoản ${account.email} đã tồn tại ngoài bộ demo hoàn chỉnh; không ghi đè.`,
        )
    }

    const adminId = demoId('account:admin')
    const authorId = demoId('account:author')
    const hash = await hashPassword(password)
    for (const account of demoAccounts) {
      await createOne(
        Account,
        {
          _id: demoId(`account:${account.key}`),
          displayName: account.name,
          email: account.email,
          status: 'active',
          emailVerifiedAt: now,
          everAuthor: account.role === 'author',
          password: { hash, algorithm: 'scrypt', updatedAt: now },
        },
        session,
      )
      if (account.role !== 'reader') {
        await createOne(
          RoleAssignment,
          {
            _id: demoId(`role:${account.key}`),
            accountId: demoId(`account:${account.key}`),
            role: account.role,
            status: 'active',
            grantedBy: adminId,
            grantedAt: now,
          },
          session,
        )
      }
    }

    let policy = await PolicyVersion.findOne({ status: 'effective', effectiveAt: { $lte: now } })
      .sort({ effectiveAt: -1, _id: -1 })
      .session(session)
      .lean()
    if (!policy) {
      policy = await createOne(
        PolicyVersion,
        {
          _id: demoId('policy'),
          status: 'effective',
          effectiveAt: new Date(now.getTime() - 60000),
          actorAccountId: adminId,
        },
        session,
      )
    }
    const priceMin = Math.max(1, policy.priceMinCoins)
    const priceMax = policy.priceMaxCoins
    if (
      ![priceMin, priceMax, policy.durationMinDays, policy.durationMaxDays].every(
        Number.isSafeInteger,
      ) ||
      priceMin > priceMax ||
      priceMax > Number.MAX_SAFE_INTEGER / 10 ||
      policy.durationMinDays < 1 ||
      policy.durationMaxDays < policy.durationMinDays ||
      policy.durationMaxDays > 3650 ||
      !(policy.orderExpiryHours > 0)
    )
      throw new CoinsDemoError(
        'Chính sách hiện tại không phù hợp bộ demo. Script không sửa chính sách có sẵn.',
      )
    const basePrice = Math.min(priceMax, Math.max(priceMin, 1000))
    const durationDays = Math.min(policy.durationMaxDays, Math.max(policy.durationMinDays, 7))

    for (const category of categories) {
      await createOne(
        Category,
        {
          _id: demoId(`category:${category.key}`),
          name: category.name,
          normalizedName: category.name.toLowerCase(),
          createdBy: adminId,
          status: 'active',
        },
        session,
      )
    }

    for (const story of stories) {
      const storyId = demoId(`story:${story.key}`)
      const revisionId = demoId(`story-revision:${story.key}`)
      await createOne(
        Story,
        {
          _id: storyId,
          authorAccountId: authorId,
          title: story.title,
          description: story.description,
          categoryIds: [demoId(`category:${story.category}`)],
          publicationStatus: 'published',
          publishedRevisionId: revisionId,
          currentRevisionId: revisionId,
          publishedAt: now,
        },
        session,
      )
      await publishFixture(
        {
          label: `story:${story.key}`,
          storyId,
          revisionId,
          authorId,
          now,
          contentType: 'story',
          formatVersion: 'story-v1',
          content: {
            title: story.title,
            description: story.description,
            categoryIds: [String(demoId(`category:${story.category}`))],
          },
        },
        session,
      )

      for (const [index, chapter] of story.chapters.entries()) {
        const label = chapterKey(story, index)
        const chapterId = demoId(label)
        const chapterRevisionId = demoId(`revision:${label}`)
        const price = Math.min(priceMax, basePrice + (chapter.priceOffset ?? 0))
        const firstReleasedAt =
          chapter.access === 'expired'
            ? new Date(now.getTime() - (durationDays + 1) * DAY)
            : new Date(now.getTime() - 60000)
        const earlyAccess =
          chapter.access === 'free'
            ? { enabled: false }
            : {
                enabled: true,
                coinPrice: price,
                durationDays,
                policyVersionId: policy._id,
                endsAt: new Date(firstReleasedAt.getTime() + durationDays * DAY),
              }
        await createOne(
          Chapter,
          {
            _id: chapterId,
            storyId,
            title: chapter.title,
            orderKey: index + 1,
            status: 'published',
            publishedRevisionId: chapterRevisionId,
            currentRevisionId: chapterRevisionId,
            firstReleasedAt,
            publishedAt: firstReleasedAt,
            earlyAccess,
          },
          session,
        )
        await publishFixture(
          {
            label,
            storyId,
            chapterId,
            revisionId: chapterRevisionId,
            authorId,
            now: firstReleasedAt,
            contentType: 'chapter',
            formatVersion: 'blocks-v2',
            content: {
              title: chapter.title,
              blocks: paragraphs(story, chapter, index).map(text => ({
                type: 'paragraph',
                inlines: [{ text, marks: [] }],
              })),
            },
          },
          session,
        )
      }
    }

    const balances = { rich: Math.max(5000, basePrice * 5), poor: basePrice - 1, empty: 0 }
    for (const [key, balance] of Object.entries(balances)) {
      const wallet = await createOne(
        Wallet,
        {
          _id: demoId(`wallet:${key}`),
          ownerType: 'account',
          ownerId: demoId(`account:${key}`),
          purpose: 'reader-coins',
          availableBalance: balance,
        },
        session,
      )
      if (balance > 0) {
        await createOne(
          LedgerEntry,
          {
            _id: demoId(`initial-credit:${key}`),
            walletId: wallet._id,
            ledgerType: 'adjustment',
            direction: 'credit',
            amount: balance,
            reason:
              '[DEMO COINS] Xu giả phục vụ thử giao diện; không phải tiền ngân hàng hoặc giao dịch SePay.',
            actorAccountId: adminId,
            sourceType: DEMO_NAMESPACE,
            sourceId: demoId('dataset'),
            idempotencyScope: {
              operation: 'demo-opening-balance',
              ownerId: wallet.ownerId,
              key: DEMO_NAMESPACE,
            },
            occurredAt: now,
          },
          session,
        )
      }
    }
    await createOne(
      Wallet,
      {
        _id: demoId('wallet:author'),
        ownerType: 'account',
        ownerId: authorId,
        purpose: 'author-earnings',
        availableBalance: 0,
      },
      session,
    )
    for (const amount of [10000, 20000, 50000]) {
      await createOne(
        TopUpPackage,
        {
          _id: demoId(`package:${amount}`),
          priceVnd: amount,
          coinAmount: amount,
          status: 'active',
          actorAccountId: adminId,
          policyVersionId: policy._id,
        },
        session,
      )
    }
    await createOne(
      AuditEvent,
      {
        _id: demoId('dataset'),
        actorType: 'system',
        action: 'demo.coins.seeded',
        targetType: 'DemoDataset',
        targetId: demoId('dataset'),
        result: 'created',
        reason:
          'Bộ dữ liệu hư cấu cho Coins. Trạng thái xuất bản là fixture demo, không phải kết quả duyệt hoặc AI thật.',
        correlationId: DEMO_NAMESPACE,
        occurredAt: now,
      },
      session,
    )
    return summary(session, true)
  })
}

async function publishFixture(value, session) {
  const submissionId = demoId(`submission:${value.label}`)
  const rightsId = demoId(`rights:${value.label}`)
  await createOne(
    ContentRevision,
    {
      _id: value.revisionId,
      contentType: value.contentType,
      storyId: value.storyId,
      chapterId: value.chapterId,
      authorAccountId: value.authorId,
      revisionNumber: 1,
      status: 'approved',
      formatVersion: value.formatVersion,
      content: value.content,
      rightsDeclarationId: rightsId,
      submittedAt: value.now,
      immutableAt: value.now,
    },
    session,
  )
  await createOne(
    PublicationSubmission,
    {
      _id: submissionId,
      storyId: value.storyId,
      chapterId: value.chapterId,
      revisionId: value.revisionId,
      authorAccountId: value.authorId,
      status: 'approved',
      submittedAt: value.now,
      decisionSummary:
        '[DEMO COINS] Fixture xuất bản để thử đọc; không thực hiện AI hoặc duyệt thật.',
    },
    session,
  )
  await createOne(
    RightsDeclaration,
    {
      _id: rightsId,
      storyId: value.storyId,
      submissionId,
      revisionId: value.revisionId,
      basis: 'original',
      asserted: true,
      declaredBy: value.authorId,
      declaredAt: value.now,
      status: 'asserted',
      immutableAt: value.now,
      sourceLicenceNote: 'Nội dung hư cấu được tạo riêng cho bộ demo Coins.',
    },
    session,
  )
}
