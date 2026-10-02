import { useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Download,
  KeyRound,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserRound,
  X,
} from '../../components/icons'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Tabs } from '../../components/ui'

const roles = [
  {
    name: 'Reader',
    users: '141,562',
    icon: BookOpen,
    description:
      'Standard public account. Read chapters, purchase coins, leave comments, and follow creators.',
    tags: ['Default Role', 'Unrestricted Signup'],
  },
  {
    name: 'Author',
    users: '1,240',
    icon: UserRound,
    description:
      'Creator account with Author Studio, Chapter Editor, PDF import, royalty wallet, and AI Co-Pilot.',
    tags: ['Verified Identity', 'Monetization Enabled'],
  },
  {
    name: 'Moderator',
    users: '38',
    icon: ShieldCheck,
    description:
      'Trust & Safety console access, submission inspection, similarity analysis, and report resolution.',
    tags: ['Staff Only', 'NDA Signed'],
  },
  {
    name: 'Administrator',
    users: '10',
    icon: Shield,
    description:
      'Full platform governance, user management, service configuration, taxonomy control, and audit logs.',
    tags: ['Protected Role', 'Hardware 2FA'],
  },
]
const roleLabels = { Reader: 'Độc giả', Author: 'Tác giả', Moderator: 'Kiểm duyệt viên', Administrator: 'Quản trị viên' }
const roleDescriptions = {
  Reader: 'Tài khoản công khai tiêu chuẩn. Đọc chương, mua xu, bình luận và theo dõi tác giả.',
  Author: 'Tài khoản sáng tác có Studio tác giả, trình soạn chương, nhập PDF, ví nhuận bút và trợ lý AI.',
  Moderator: 'Truy cập khu vực Tin cậy và An toàn, kiểm tra bản gửi, phân tích tương đồng và xử lý báo cáo.',
  Administrator: 'Quản trị toàn bộ nền tảng, người dùng, cấu hình dịch vụ, phân loại và nhật ký kiểm tra.',
}
const tagLabels = {
  'Default Role': 'Vai trò mặc định', 'Unrestricted Signup': 'Đăng ký không hạn chế',
  'Verified Identity': 'Đã xác minh danh tính', 'Monetization Enabled': 'Đã bật kiếm tiền',
  'Staff Only': 'Chỉ dành cho nhân viên', 'NDA Signed': 'Đã ký NDA',
  'Protected Role': 'Vai trò được bảo vệ', 'Hardware 2FA': '2FA phần cứng',
}
const capabilities = [
  [
    'Content Publishing & Authoring',
    'story.create',
    'Create manuscripts and upload metadata',
    [0, 1, 1, 1],
  ],
  [
    'Content Publishing & Authoring',
    'chapter.edit',
    'Edit long-form text and autosave to cloud',
    [0, 1, 0, 1],
  ],
  [
    'Content Publishing & Authoring',
    'pdf.import',
    'OCR and auto-structure manuscript PDFs',
    [0, 1, 0, 1],
  ],
  [
    'Content Publishing & Authoring',
    'ai_copilot.access',
    'Invoke NovelCraft writing assistance',
    [0, 1, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'queue.review',
    'Claim submissions and execute approval decisions',
    [0, 0, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'plagiarism.inspect',
    'Inspect canonical similarity comparisons',
    [0, 0, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'report.resolve',
    'Triage community and content reports',
    [0, 0, 1, 1],
  ],
  ['Editorial & Moderation', 'user.strike', 'Issue warnings or shadowban accounts', [0, 0, 1, 1]],
  ['Monetization & Ledger', 'wallet.spend', 'Purchase coins and unlock chapters', [1, 1, 1, 1]],
  [
    'Monetization & Ledger',
    'royalty.withdraw',
    'Request payout for accrued royalties',
    [0, 1, 0, 1],
  ],
  [
    'Monetization & Ledger',
    'coin.override',
    'Manually credit or debit user balances',
    [0, 0, 0, 1],
  ],
  [
    'Platform Infrastructure',
    'system.configure',
    'Modify TTS endpoints, AI keys, and storage',
    [0, 0, 0, 1],
  ],
  [
    'Platform Infrastructure',
    'audit.view',
    'Inspect complete administrative event stream',
    [0, 0, 1, 1],
  ],
]
const modules = [
  'All Modules',
  'Content & Stories',
  'Reader & Social',
  'Moderation',
  'Billing & Coins',
  'Platform Config',
]
const moduleLabels = {
  'All Modules': 'Tất cả mô-đun', 'Content & Stories': 'Nội dung và truyện',
  'Reader & Social': 'Độc giả và cộng đồng', Moderation: 'Kiểm duyệt',
  'Billing & Coins': 'Thanh toán và xu', 'Platform Config': 'Cấu hình nền tảng',
}
const groupLabels = {
  'Content Publishing & Authoring': 'Xuất bản nội dung và sáng tác',
  'Editorial & Moderation': 'Biên tập và kiểm duyệt',
  'Monetization & Ledger': 'Kiếm tiền và sổ cái',
  'Platform Infrastructure': 'Hạ tầng nền tảng',
}
const capabilityDescriptions = {
  'Create manuscripts and upload metadata': 'Tạo bản thảo và tải lên siêu dữ liệu',
  'Edit long-form text and autosave to cloud': 'Sửa văn bản dài và tự động lưu lên đám mây',
  'OCR and auto-structure manuscript PDFs': 'OCR và tự động cấu trúc PDF bản thảo',
  'Invoke NovelCraft writing assistance': 'Sử dụng trợ lý viết NovelCraft',
  'Claim submissions and execute approval decisions': 'Nhận bản gửi và thực hiện quyết định duyệt',
  'Inspect canonical similarity comparisons': 'Kiểm tra so sánh tương đồng với nội dung chuẩn',
  'Triage community and content reports': 'Phân loại báo cáo cộng đồng và nội dung',
  'Issue warnings or shadowban accounts': 'Cảnh báo hoặc hạn chế ngầm tài khoản',
  'Purchase coins and unlock chapters': 'Mua xu và mở khóa chương',
  'Request payout for accrued royalties': 'Yêu cầu thanh toán nhuận bút tích lũy',
  'Manually credit or debit user balances': 'Điều chỉnh tăng hoặc giảm số dư người dùng thủ công',
  'Modify TTS endpoints, AI keys, and storage': 'Thay đổi điểm cuối TTS, khóa AI và lưu trữ',
  'Inspect complete administrative event stream': 'Kiểm tra toàn bộ luồng sự kiện quản trị',
}

export function RolesPermissionsPage() {
  const [module, setModule] = useState('All Modules')
  const [query, setQuery] = useState('')
  const [matrix, setMatrix] = useState(() => capabilities.map(row => [...row[3]]))
  const [drafts, setDrafts] = useState(0)
  const [modal, setModal] = useState('')
  const visible = useMemo(
    () =>
      capabilities
        .map((row, index) => ({ ...row, index }))
        .filter(row => `${row[1]} ${row[2]}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  )
  const toggle = (row, col) => {
    setMatrix(value =>
      value.map((cells, index) =>
        index === row
          ? cells.map((enabled, cell) => (cell === col ? (enabled ? 0 : 1) : enabled))
          : cells,
      ),
    )
    setDrafts(value => value + 1)
  }
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">
              Bảng điều khiển quản trị / Quản lý truy cập / Ma trận vai trò và RBAC
            </p>
            <h1 className="mt-1 text-2xl font-bold">Quản trị vai trò và quyền hạn</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal('Đã xuất chính sách quyền dạng JSON')}>
              <Download size={15} />
              Xuất JSON chính sách
            </Button>
            <Button onClick={() => setModal('Tạo vai trò tùy chỉnh')}>
              <Plus size={15} />
              Tạo vai trò tùy chỉnh
            </Button>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3 rounded-3xl border border-orange/30 bg-orange/10 p-4 text-sm">
          <Shield className="shrink-0 text-orange" />
          <p className="flex-1">
            <strong>Lưu ý chính sách bảo mật:</strong> Thay đổi có tác động lớn yêu cầu xác thực lại
            bằng 2FA và được ghi vào nhật ký kiểm tra bất biến.
          </p>
          <Badge tone="orange">POLICY_V4.2</Badge>
        </div>
        <section className="mt-7">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Vai trò cốt lõi của hệ thống</h2>
            <Badge tone="green">4 loại đang hoạt động</Badge>
          </div>
          <div className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2 nh-xl-cols-4">
            {roles.map(role => (
              <RoleCard
                key={role.name}
                role={role}
                onAction={() => setModal(`Sửa chính sách ${roleLabels[role.name]}`)}
              />
            ))}
          </div>
        </section>
        <Card className="mt-7 overflow-hidden p-0">
          <div className="flex flex-col justify-between gap-4 border-b border-line p-5 xl:flex-row xl:items-center">
            <div className="overflow-x-auto">
              <Tabs
                value={module}
                onChange={setModule}
                items={modules.map(value => ({ value, label: moduleLabels[value] }))}
              />
            </div>
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm mã định danh quyền..."
              className="w-full xl:w-80"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-elevated text-[9px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-5 py-4">Khả năng / mã định danh quyền</th>
                  <th>Mô tả</th>
                  {roles.map(role => (
                    <th key={role.name} className="text-center">
                      {roleLabels[role.name]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, position) => {
                  const group = row[0],
                    slug = row[1],
                    description = row[2],
                    previous = visible[position - 1]?.[0]
                  return (
                    <FragmentRow key={slug} showGroup={group !== previous} group={group}>
                      <td className="px-5 py-4 font-mono text-brand">{slug}</td>
                      <td className="max-w-xs pr-5 text-muted">{capabilityDescriptions[description] ?? description}</td>
                      {matrix[row.index].map((enabled, col) => (
                        <td key={col} className="text-center">
                          <button
                            aria-label={`Bật hoặc tắt ${slug} cho ${roleLabels[roles[col].name]}`}
                            onClick={() => toggle(row.index, col)}
                            className={`mx-auto grid size-8 place-items-center rounded-full ${enabled ? 'bg-brand/15 text-brand' : 'bg-elevated text-muted'}`}
                          >
                            {enabled ? <Check size={16} /> : <X size={16} />}
                          </button>
                        </td>
                      ))}
                    </FragmentRow>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-line p-4 text-[10px] text-muted">
            <span>● Phạm vi đã bật &nbsp; ○ Từ chối rõ ràng</span>
            <span>Đang hiển thị {visible.length} phạm vi quyền hoạt động trên 4 vai trò</span>
          </div>
        </Card>
        <Card className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange/15 text-orange">
            <KeyRound />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">
              {drafts} thay đổi chính sách đang chờ trong bản nháp
            </h3>
            <p className="text-xs text-muted">
              Khi lưu, thay đổi áp dụng cho mọi phiên đang hoạt động. Quyền bị thu hồi sẽ vô hiệu hóa
              token làm mới trên toàn hệ thống.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setMatrix(capabilities.map(row => [...row[3]]))
              setDrafts(0)
            }}
            disabled={!drafts}
          >
            Hủy bản nháp
          </Button>
          <Button onClick={() => setModal('Áp dụng ma trận quyền')} disabled={!drafts}>
            <ShieldCheck size={15} />
            Áp dụng ma trận · 2FA
          </Button>
        </Card>
        <Modal open={Boolean(modal)} title={modal} onClose={() => setModal('')}>
          {modal === 'Tạo vai trò tùy chỉnh' ? (
            <div className="space-y-3">
              <Input placeholder="Tên vai trò" />
              <Input placeholder="Mô tả vai trò" />
              <Button onClick={() => setModal('')} className="w-full">
                Tạo vai trò mẫu
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                Thao tác được bảo vệ này chỉ được mô phỏng cục bộ trong bản xem trước giao diện.
              </p>
              <Button
                onClick={() => {
                  if (modal.includes('Áp dụng')) setDrafts(0)
                  setModal('')
                }}
                className="mt-5 w-full"
              >
                Xác nhận thao tác mẫu
              </Button>
            </>
          )}
        </Modal>
      </main>
    </AdminLayout>
  )
}

function RoleCard({ role, onAction }) {
  const Icon = role.icon
  return (
    <Card className={role.name === 'Administrator' ? 'border-brand' : ''}>
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon size={20} />
        </span>
        <strong className="text-sm">
          {role.users}
          <small className="block font-normal text-muted">người dùng được gán</small>
        </strong>
      </div>
      <h3 className="mt-5 text-xl font-semibold">{roleLabels[role.name]}</h3>
      <p className="mt-3 min-h-24 text-sm leading-6 text-muted">{roleDescriptions[role.name]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {role.tags.map((tag, index) => (
          <Badge key={tag} tone={index ? 'blue' : role.name === 'Administrator' ? 'red' : 'green'}>
            {tagLabels[tag] ?? tag}
          </Badge>
        ))}
      </div>
      <Button
        variant={role.name === 'Administrator' ? 'primary' : 'secondary'}
        onClick={onAction}
        className="mt-5 w-full"
      >
        {role.name === 'Administrator'
          ? 'Quản lý khóa'
          : role.name === 'Reader'
            ? 'Xem phạm vi'
            : 'Sửa chính sách'}
      </Button>
    </Card>
  )
}
function FragmentRow({ showGroup, group, children }) {
  return (
    <>
      {showGroup && (
        <tr className="border-y border-line bg-brand/5">
          <td colSpan="6" className="px-5 py-3 font-semibold text-brand">
            {groupLabels[group] ?? group}
          </td>
        </tr>
      )}
      <tr className="border-b border-line hover:bg-elevated/40">{children}</tr>
    </>
  )
}
