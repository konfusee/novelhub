import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BadgeDollarSign,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { AdminLayout } from '../../layouts'
import { adminUsers } from '../../data/mock/admin'
import { Avatar, Badge, Button, Card, Input, Modal, Select, Tabs } from '../../components/ui'

const roleTone = { Reader: 'blue', Author: 'green', Moderator: 'orange', Admin: 'purple' }
const statusTone = { Active: 'green', Flagged: 'orange', Suspended: 'red' }
const roleLabels = { Reader: 'Độc giả', Author: 'Tác giả', Moderator: 'Kiểm duyệt viên', Admin: 'Quản trị viên', Administrator: 'Quản trị viên' }
const statusLabels = { Active: 'Đang hoạt động', Flagged: 'Bị cảnh báo', Suspended: 'Đã đình chỉ' }

export function UsersManagementPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('All')
  const [status, setStatus] = useState('All')
  const [selected, setSelected] = useState(adminUsers[1])
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const users = useMemo(
    () =>
      adminUsers.filter(
        user =>
          (role === 'All' || user.role === role) &&
          (status === 'All' || user.status === status) &&
          `${user.name} ${user.handle} ${user.email} ${user.id}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, role, status],
  )
  const suspend = () => {
    setNotice(
      selected.status === 'Suspended'
        ? `${selected.name} đã được kích hoạt lại (bản mẫu).`
        : `${selected.name} đã bị đình chỉ (bản mẫu).`,
    )
  }
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">Bảng điều khiển quản trị / Quản lý truy cập</p>
            <h1 className="mt-1 text-2xl font-bold">Người dùng và tài khoản</h1>
            <p className="mt-1 text-xs text-muted">
              <strong className="text-brand">142.850</strong> tài khoản · 1.240 tác giả · 48 nhân
              viên/kiểm duyệt viên
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setNotice('Đã chuẩn bị CSV danh bạ người dùng (bản mẫu).')}
            >
              <Download size={15} />
              Xuất danh bạ
            </Button>
            <Button onClick={() => setNotice('Đã mở lời mời nhân viên (bản mẫu).')}>
              <UserPlus size={15} />
              Mời nhân viên
            </Button>
          </div>
        </div>
        <Card className="mt-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_190px]">
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm tên, @tên_người_dùng, email hoặc mã người dùng..."
            />
            <Select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="All">Tất cả trạng thái</option>
              <option value="Active">Đang hoạt động</option>
              <option value="Flagged">Bị cảnh báo</option>
              <option value="Suspended">Đã đình chỉ</option>
            </Select>
            <Select>
              <option>Sắp xếp: Hoạt động nhiều nhất</option>
              <option>Tham gia mới nhất</option>
              <option>Nhiều xu nhất</option>
            </Select>
          </div>
          <div className="mt-4 overflow-x-auto">
            <Tabs
              value={role}
              onChange={setRole}
              items={[
                { value: 'All', label: 'Tất cả 142.850' },
                { value: 'Reader', label: 'Độc giả 141.562' },
                { value: 'Author', label: 'Tác giả 1.240' },
                { value: 'Moderator', label: 'Kiểm duyệt viên 38' },
              ]}
            />
          </div>
        </Card>
        <div className="mt-5 grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[790px] text-left text-xs">
                <thead className="bg-elevated text-[9px] uppercase tracking-[.14em] text-muted">
                  <tr>
                    <th className="px-5 py-4">Người dùng và định danh</th>
                    <th>Vai trò hệ thống</th>
                    <th>Trạng thái</th>
                    <th>Ngày tham gia</th>
                    <th>Hoạt động và xu</th>
                    <th className="pr-5">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {users.map(user => (
                    <tr
                      key={user.id}
                      onClick={() => setSelected(user)}
                      className={`cursor-pointer transition hover:bg-elevated/70 ${selected.id === user.id ? 'bg-brand/10' : ''}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} />
                          <div>
                            <strong className="block text-sm">{user.name}</strong>
                            <span className="text-muted">
                              {user.handle} · #{user.id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={roleTone[user.role]}>
                          {roleLabels[user.role] ?? user.role}
                          {user.guild ? ` · ${user.guild}` : ''}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={statusTone[user.status]}>{statusLabels[user.status] ?? user.status}</Badge>
                      </td>
                      <td>
                        <span className="block">{user.joined}</span>
                        <small className="text-muted">{user.tenure}</small>
                      </td>
                      <td>
                        <span className="block">{user.activity}</span>
                        <strong className="text-orange">{user.coins}</strong>
                      </td>
                      <td className="pr-5">
                        <button
                          onClick={event => {
                            event.stopPropagation()
                            setSelected(user)
                          }}
                          className="rounded-xl border border-line px-3 py-2 hover:border-brand hover:text-brand"
                        >
                          Kiểm tra
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <p className="p-10 text-center text-sm text-muted">Không có người dùng nào khớp bộ lọc.</p>
            )}
            <div className="flex flex-col justify-between gap-3 border-t border-line p-4 text-xs text-muted sm:flex-row sm:items-center">
              <span>Đang hiển thị {users.length} / 142.850 tài khoản</span>
              <div className="flex gap-2">
                <button disabled className="rounded-xl border border-line px-3 py-2 disabled:opacity-40">Trước</button>
                <button onClick={() => setNotice('Đã chọn trang 1.')} className="rounded-xl bg-brand px-3 py-2 text-white">1</button>
                <button onClick={() => setNotice('Đã chọn trang 2 (bản mẫu).')} className="rounded-xl border border-line px-3 py-2">2</button>
                <button onClick={() => setNotice('Đã chọn trang tiếp theo (bản mẫu).')} className="rounded-xl border border-line px-3 py-2">Sau</button>
              </div>
            </div>
          </Card>
          <UserInspector user={selected} onEdit={() => setEditing(true)} onSuspend={suspend} />
        </div>
        <Modal
          open={editing}
          title={`Sửa vai trò · ${selected.name}`}
          onClose={() => setEditing(false)}
        >
          <p className="text-sm text-muted">
            Thay đổi vai trò chỉ được mô phỏng cục bộ trong bản xem trước giao diện.
          </p>
          <div className="mt-4 grid gap-2">
            {['Reader', 'Author', 'Moderator', 'Administrator'].map(item => (
              <label
                key={item}
                className="flex items-center gap-3 rounded-2xl bg-elevated p-3 text-sm"
              >
                <input
                  type="checkbox"
                  defaultChecked={item === selected.role || item === 'Reader'}
                />
                {roleLabels[item] ?? item}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setEditing(false)
                setNotice('Đã lưu thay đổi vai trò (bản mẫu).')
              }}
            >
              Lưu vai trò
            </Button>
          </div>
        </Modal>
        <Modal open={Boolean(notice)} title="Thao tác quản trị" onClose={() => setNotice('')}>
          <p className="text-sm">{notice}</p>
          <Button onClick={() => setNotice('')} className="mt-5 w-full">
            Hoàn tất
          </Button>
        </Modal>
      </main>
    </AdminLayout>
  )
}

function UserInspector({ user, onEdit, onSuspend }) {
  return (
    <aside className="space-y-4 2xl:sticky 2xl:top-24">
      <Card>
        <div className="flex items-start gap-3">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold">{user.name}</h2>
              {user.guild && <Badge tone="green">{user.guild}</Badge>}
            </div>
            <p className="text-xs text-muted">
              {user.handle} · #{user.id}
            </p>
            <p className="mt-1 text-[10px] text-brand">● {statusLabels[user.status] ?? user.status} · Tài khoản tốt</p>
          </div>
          <X size={17} className="text-muted" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onEdit}>
            <Edit3 size={14} />
            Sửa vai trò
          </Button>
          <Button onClick={() => window.alert('Đã mở hộp thoại điều chỉnh xu (bản mẫu).')} variant="secondary">
            <BadgeDollarSign size={14} />
            Điều chỉnh xu
          </Button>
          <Button onClick={() => window.alert('Đã mở trình soạn cảnh báo (bản mẫu).')} variant="secondary">
            <AlertTriangle size={14} />
            Gửi cảnh báo
          </Button>
          <Button variant="danger" onClick={onSuspend}>
            {user.status === 'Suspended' ? 'Kích hoạt lại' : 'Đình chỉ tài khoản'}
          </Button>
        </div>
      </Card>
      <InfoCard title="Thông tin tài khoản" icon={ShieldCheck}>
        <Row label="Địa chỉ email" value={user.email} />
        <Row label="Vai trò hiện tại" value={roleLabels[user.role] ?? user.role} />
        <Row label="Thời gian tham gia" value={`${user.joined} (${user.tenure})`} />
      </InfoCard>
      <InfoCard title="Hồ sơ sáng tác và chỉ số" icon={BookOpen}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric value={user.role === 'Author' ? '6' : '0'} label="Truyện dài kỳ" />
          <Metric value={user.role === 'Author' ? '1,25 triệu' : '—'} label="Lượt đọc" />
          <Metric value="99,4%" label="Toàn vẹn" />
        </div>
        <p className="mt-4 text-xs text-muted">Tác phẩm nổi bật đã xuất bản</p>
        <ul className="mt-2 space-y-2 text-xs">
          <li>
            • The Silent Forest <span className="float-right text-muted">820K</span>
          </li>
          <li>
            • Echoes of Eldoria <span className="float-right text-muted">312K</span>
          </li>
        </ul>
      </InfoCard>
      <InfoCard title="Tài chính và nhuận bút" icon={BadgeDollarSign}>
        <Row label="Số dư sổ cái" value={user.coins} />
        <Row
          label="Phương thức nhận tiền"
          value={user.role === 'Author' ? 'Stripe Connect · Đã xác minh' : 'Chưa cấu hình'}
        />
        <Row label="Kỳ tiếp theo" value="01/11/2026" />
      </InfoCard>
      <InfoCard title="Nhật ký kiểm tra · 60 ngày gần nhất" icon={CheckCircle2}>
        <div className="space-y-4 border-l border-line pl-4 text-xs">
          <div>
            <strong>Cập nhật thông tin bảo mật</strong>
            <p className="text-muted">Đặt lại mật khẩu đã được xác thực qua 2FA</p>
          </div>
          <div>
            <strong>Đã xác minh vai trò tài khoản</strong>
            <p className="text-muted">Được quản trị viên cấp cao Marcus Vance xem xét</p>
          </div>
        </div>
      </InfoCard>
    </aside>
  )
}
function InfoCard({ title, icon: Icon, children }) {
  return (
    <Card>
      <h3 className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.14em] text-muted">
        {title}
        <Icon size={15} />
      </h3>
      <div className="mt-4">{children}</div>
    </Card>
  )
}
function Row({ label, value }) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-line py-3 text-xs last:border-0 sm:flex-row">
      <span className="text-muted">{label}</span>
      <strong className="break-all sm:text-right">{value}</strong>
    </div>
  )
}
function Metric({ value, label }) {
  return (
    <div className="rounded-2xl bg-elevated p-3">
      <strong className="block text-lg text-brand">{value}</strong>
      <span className="text-[8px] uppercase text-muted">{label}</span>
    </div>
  )
}
