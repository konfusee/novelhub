import { useMemo, useState } from 'react'
import {
  Bot,
  Cloud,
  Database,
  Download,
  Headphones,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from '../../components/icons'
import { AdminLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal, Select, Tabs } from '../../components/ui'

const services = [
  [
    'TTS Neural Engine',
    'ElevenLabs & Custom WaveNet v3.4',
    '99.98%',
    '180ms',
    Headphones,
    'Configure Voices',
  ],
  ['AI Writing Co-Pilot', 'NovelCraft Engine 4.2 Pro', '99.92%', '820 RPM', Bot, 'Adjust Quota'],
  [
    'Storage & CDN Mesh',
    'AWS S3 + Cloudflare Enterprise',
    '100%',
    '14.8 TB',
    Cloud,
    'Purge Edge Cache',
  ],
  [
    'PostgreSQL Cluster',
    'Aurora Multi-AZ · Read Replicas',
    '99.99%',
    '28ms',
    Database,
    'Manage Backups',
  ],
]
const logs = [
  [
    '2026-10-24 16:12:04',
    'Marcus Vance',
    'service.update',
    'TTS Engine endpoint',
    'Medium',
    'ElevenLabs Voice Cluster',
  ],
  [
    '2026-10-24 15:40:22',
    'System Worker #02',
    'backup.snapshot',
    'Full PostgreSQL db',
    'Low',
    'RDS Aurora Cluster',
  ],
  [
    '2026-10-24 14:15:10',
    'Sarah Jenkins',
    'story.publish_approval',
    'Editorial queue',
    'Low',
    'Story #MS-88402',
  ],
  [
    '2026-10-24 11:02:45',
    'SecOps Daemon',
    'security.ip_block',
    'Edge perimeter firewall',
    'High',
    'IP Range 185.22.0.101/24',
  ],
  [
    '2026-10-24 09:18:30',
    'Marcus Vance',
    'rbac.permission_grant',
    'Staff capability update',
    'Critical',
    'Role: Moderator',
  ],
]
const sections = [
  'Platform Settings',
  'External Services & APIs',
  'TTS & Audio Narration',
  'AI Models & Orchestrator',
  'Storage & Media Mesh',
  'Audit Logs',
]
const sectionLabels = {
  'Platform Settings': 'Cài đặt nền tảng', 'External Services & APIs': 'Dịch vụ ngoài và API',
  'TTS & Audio Narration': 'TTS và thuyết minh âm thanh', 'AI Models & Orchestrator': 'Mô hình AI và bộ điều phối',
  'Storage & Media Mesh': 'Lưu trữ và mạng media', 'Audit Logs': 'Nhật ký kiểm tra',
}
const actionLabels = { 'Configure Voices': 'Cấu hình giọng đọc', 'Adjust Quota': 'Điều chỉnh hạn mức', 'Purge Edge Cache': 'Xóa bộ nhớ đệm biên', 'Manage Backups': 'Quản lý bản sao lưu' }
const impactLabels = { Low: 'Thấp', Medium: 'Trung bình', High: 'Cao', Critical: 'Nghiêm trọng' }
const serviceLabels = { 'TTS Neural Engine': 'Bộ máy TTS thần kinh', 'AI Writing Co-Pilot': 'Trợ lý viết AI', 'Storage & CDN Mesh': 'Mạng lưu trữ và CDN', 'PostgreSQL Cluster': 'Cụm PostgreSQL' }
const logDetailLabels = {
  'TTS Engine endpoint': 'Điểm cuối bộ máy TTS', 'Full PostgreSQL db': 'Toàn bộ cơ sở dữ liệu PostgreSQL',
  'Editorial queue': 'Hàng đợi biên tập', 'Edge perimeter firewall': 'Tường lửa biên ngoài',
  'Staff capability update': 'Cập nhật quyền nhân viên', 'Role: Moderator': 'Vai trò: Kiểm duyệt viên',
}

export function PlatformSettingsPage() {
  const [section, setSection] = useState('External Services & APIs')
  const [maintenance, setMaintenance] = useState(false)
  const [query, setQuery] = useState('')
  const [actor, setActor] = useState('All')
  const [modal, setModal] = useState('')
  const [saved, setSaved] = useState(false)
  const filtered = useMemo(
    () =>
      logs.filter(
        row =>
          (actor === 'All' || row[1] === actor) &&
          row.join(' ').toLowerCase().includes(query.toLowerCase()),
      ),
    [query, actor],
  )
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs text-muted">
              Bảng điều khiển quản trị / Vận hành nền tảng / Dịch vụ và cài đặt hệ thống
            </p>
            <h1 className="mt-1 text-2xl font-bold">
              Cài đặt nền tảng, dịch vụ ngoài và kiểm tra
            </h1>
            <Badge tone="green">Môi trường thật · Cụm US-East · Kho khóa đang hoạt động</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModal('Đã xuất luồng kiểm tra (bản mẫu).')}>
              <Download size={15} />
              Xuất luồng kiểm tra
            </Button>
            <button
              onClick={() => setMaintenance(!maintenance)}
              className={`rounded-2xl border px-4 py-2 text-xs ${maintenance ? 'border-orange bg-orange/15 text-orange' : 'border-line bg-surface'}`}
            >
              Chế độ bảo trì {maintenance ? 'BẬT' : 'TẮT'}
            </button>
          </div>
        </div>
        <div className="mt-6 overflow-x-auto border-b border-line pb-3">
          <Tabs
            value={section}
            onChange={setSection}
            items={sections.map(value => ({ value, label: sectionLabels[value] }))}
          />
        </div>
        {section !== 'Platform Settings' && section !== 'Audit Logs' && <section className="mt-6">
          <h2 className="text-xl font-semibold">Dịch vụ ngoài và cổng hạ tầng</h2>
          <p className="text-xs text-muted">
            Trạng thái vận hành, dữ liệu mạng dịch vụ và thông tin xác thực cổng.
          </p>
          <div className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2 nh-2xl-cols-4">
            {services.filter(service => section === 'External Services & APIs' || service[0].toLowerCase().includes(section.split(' ')[0].toLowerCase()) || (section === 'Storage & Media Mesh' && service[0].includes('Storage'))).map(service => (
              <ServiceCard
                key={service[0]}
                service={service}
                onAction={() => setModal(actionLabels[service[5]] ?? service[5])}
              />
            ))}
          </div>
        </section>}
        {section === 'Platform Settings' && <Card className="mt-6">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="text-brand" />
            <div>
              <h2 className="text-xl font-semibold">Tham số cấu hình chung của nền tảng</h2>
              <p className="text-xs text-muted">
                Nhận diện nền tảng, mặc định cho độc giả, tỷ lệ doanh thu và giới hạn tài nguyên.
              </p>
            </div>
          </div>
          <div className="nh-grid-12 mt-6 grid gap-5 nh-lg-cols-2">
            <Field label="Tên trang" defaultValue="NovelHub" />
            <Field label="Khẩu hiệu nền tảng" defaultValue="Những câu chuyện cho ngày mai tươi sáng hơn." />
            <label className="text-xs font-semibold">
              Giao diện mặc định của độc giả
              <Select className="mt-2 w-full" defaultValue="light">
                <option value="light">Giao diện sáng (Giấy da)</option>
                <option value="dark">Giao diện tối (Nửa đêm)</option>
                <option value="system">Theo hệ thống</option>
              </Select>
            </label>
            <Field label="Tỷ lệ quy đổi xu sang USD" defaultValue="100 xu = 0,99 USD" />
            <Field
              label="Tỷ lệ phân chia doanh thu tác giả"
              defaultValue="70% tác giả / 20% âm thanh / 10% nền tảng"
            />
            <Field label="Dung lượng PDF tải lên tối đa" defaultValue="50 MB" />
          </div>
          <div className="mt-6">
            <p className="text-xs font-semibold">Ngưỡng khóa chương mặc định</p>
            <div className="nh-grid-12 mt-2 grid gap-3 nh-sm-cols-3">
              {['Từ chương 3', 'Từ chương 4 cần xu để mở khóa', 'Từ chương 6'].map(
                (item, index) => (
                  <label
                    key={item}
                    className={`flex items-center gap-3 rounded-2xl border p-4 text-xs ${index === 1 ? 'border-brand bg-brand/5' : 'border-line'}`}
                  >
                    <input type="radio" name="threshold" defaultChecked={index === 1} />
                    {item}
                  </label>
                ),
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSaved(false)}>
              Hủy thay đổi
            </Button>
            <Button onClick={() => setSaved(true)}>
              {saved ? 'Đã lưu cấu hình' : 'Lưu cấu hình'}
            </Button>
          </div>
        </Card>}
        {section === 'Audit Logs' && <Card className="mt-6">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <ShieldCheck className="text-brand" />
                Luồng nhật ký kiểm tra hệ thống bất biến
              </h2>
              <p className="text-xs text-muted">
                Bản ghi chỉ ghi một lần, được xác minh bằng mật mã về thao tác và thay đổi phân quyền.
              </p>
            </div>
            <Badge tone="green">Đã xác minh lưu trữ WORM</Badge>
          </div>
          <div className="nh-grid-12 mt-5 grid gap-3 nh-layout-lg-8-4">
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm mã sự kiện, mã chủ thể hoặc IP..."
            />
            <Select value={actor} onChange={event => setActor(event.target.value)}>
              <option value="All">Tất cả chủ thể</option>
              {[...new Set(logs.map(row => row[1]))].map(name => (
                <option key={name}>{name}</option>
              ))}
            </Select>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-elevated text-[9px] uppercase tracking-[.12em] text-muted">
                <tr>
                  <th className="px-4 py-4">Thời gian UTC</th><th>Chủ thể và mã</th>
                  <th>Thao tác và tài nguyên</th><th>Mức tác động</th><th>Đối tượng / Thực thể</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(row => (
                  <tr key={row[0]}>
                    <td className="px-4 py-4 font-mono text-[10px]">{row[0]}</td>
                    <td className="font-semibold">{row[1]}</td>
                    <td>
                      <code className="rounded-lg bg-brand/10 px-2 py-1 text-brand">{row[2]}</code>
                      <small className="mt-1 block text-muted">{logDetailLabels[row[3]] ?? row[3]}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          row[4] === 'Critical'
                            ? 'red'
                            : row[4] === 'High' || row[4] === 'Medium'
                              ? 'orange'
                              : 'blue'
                        }
                      >
                        {impactLabels[row[4]] ?? row[4]}
                      </Badge>
                    </td>
                    <td>{logDetailLabels[row[5]] ?? row[5]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap justify-between gap-3 text-[10px] text-muted">
            <span>Được ký bằng mật mã và sao chép trên các kho lưu trữ chỉ ghi một lần.</span>
            <button
              onClick={() => setModal('Đã làm mới luồng kiểm tra.')}
              className="flex items-center gap-1 text-brand"
            >
              <RefreshCw size={13} />
              Làm mới luồng
            </button>
          </div>
        </Card>}
        <Modal open={Boolean(modal)} title="Thao tác nền tảng" onClose={() => setModal('')}>
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <KeyRound className="shrink-0 text-brand" />
            <p className="text-sm">{modal} Thao tác được bảo vệ này chỉ được mô phỏng cục bộ.</p>
          </div>
          <Button onClick={() => setModal('')} className="mt-5 w-full">
            Xác nhận thao tác mẫu
          </Button>
        </Modal>
      </main>
    </AdminLayout>
  )
}
function ServiceCard({ service, onAction }) {
  const [name, provider, uptime, metric, Icon, action] = service
  return (
    <Card>
      <div className="flex justify-between">
        <span className="grid size-10 place-items-center rounded-2xl bg-brand/10 text-brand">
          <Icon size={19} />
        </span>
        <Badge tone="green">● thời gian hoạt động {uptime}</Badge>
      </div>
      <h3 className="mt-5 font-semibold">{serviceLabels[name] ?? name}</h3>
      <p className="text-[10px] text-muted">{provider}</p>
      <div className="mt-4 rounded-2xl bg-elevated p-3">
        <div className="flex justify-between text-[10px]">
          <span>Chỉ số vận hành</span>
          <strong>{metric}</strong>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-line">
          <div className="h-full w-3/4 rounded-full bg-brand" />
        </div>
      </div>
      <Button variant="secondary" onClick={onAction} className="mt-4 w-full">
        {actionLabels[action] ?? action}
      </Button>
    </Card>
  )
}
function Field({ label, defaultValue }) {
  return (
    <label className="text-xs font-semibold">
      {label}
      <Input className="mt-2" defaultValue={defaultValue} />
    </label>
  )
}
