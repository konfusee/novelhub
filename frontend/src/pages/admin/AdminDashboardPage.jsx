import { useState } from 'react'
import {
  Activity,
  BookOpen,
  Download,
  Ellipsis,
  Gauge,
  ShieldAlert,
  UserRoundCheck,
} from '../../components/icons'
import { AdminLayout } from '../../layouts'
import { adminAudit, adminStats, serviceHealth } from '../../data/mock/admin'
import { Badge, Button, Card, Modal, Tabs } from '../../components/ui'

const icons = [Activity, BookOpen, UserRoundCheck, BookOpen, ShieldAlert, Gauge]
const bars = [
  [55, 35],
  [69, 46],
  [91, 66],
  [78, 52],
]
const statLabels = { 'Active Users (MAU)': 'Người dùng hoạt động (MAU)', 'Registered Readers': 'Độc giả đã đăng ký', 'Active Authors': 'Tác giả hoạt động', 'Published Stories': 'Truyện đã xuất bản', 'Moderation Queue': 'Hàng đợi kiểm duyệt', 'Platform Uptime': 'Thời gian hoạt động nền tảng' }
const statNotes = { '88% total': '88% tổng số', '14,200 active': '14.200 đang hoạt động', Healthy: 'Ổn định', '30d': '30 ngày' }
const statusLabels = { Success: 'Thành công', 'Policy Violation': 'Vi phạm chính sách', 'High Severity Alert': 'Cảnh báo nghiêm trọng cao' }
const eventLabels = {
  'Updated TTS Neural Voice Engine endpoint': 'Đã cập nhật điểm cuối bộ máy giọng nói TTS thần kinh',
  'Auto-scaled storage mesh node us-east-2': 'Tự động mở rộng nút mạng lưu trữ us-east-2',
  'Revoked publication rights for Author #AUT-9921': 'Đã thu hồi quyền xuất bản của Tác giả #AUT-9921',
  'Mitigated IP rate-limit anomaly (142 blocked)': 'Đã xử lý bất thường giới hạn tốc độ IP (chặn 142)',
}

export function AdminDashboardPage() {
  const [metric, setMetric] = useState('signups')
  const [range, setRange] = useState('30d')
  const [exported, setExported] = useState(false)
  const [maintenance, setMaintenance] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [safeguard, setSafeguard] = useState(null)
  return (
    <AdminLayout>
      <main className="page-admin py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs text-muted">Bảng điều khiển quản trị / Vận hành và tình trạng hệ thống</p>
            <h1 className="mt-2 text-2xl font-bold">Bảng vận hành nền tảng</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.alert('Dữ liệu trực tiếp đang cập nhật theo thời gian thực (bản mẫu).')} className="flex items-center gap-2 rounded-2xl border border-line px-4 py-2 text-xs">
              <span className="size-2 rounded-full bg-brand" />
              Luồng trực tiếp <span className="rounded-full bg-brand px-2 py-1 text-white">BẬT</span>
            </button>
            <Button variant="secondary" onClick={() => setExported(true)}>
              <Download size={15} />
              {exported ? 'KPI đã sẵn sàng' : 'Xuất KPI tuần'}
            </Button>
          </div>
        </div>
        <section className="nh-grid-12 mt-6 grid nh-cols-1 nh-sm-cols-2 gap-3 nh-xl-cols-3">
          {adminStats.map(([label, value, note], index) => {
            const Icon = icons[index]
            return (
              <Card key={label} className="p-4">
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted">{statLabels[label] ?? label}</span>
                  <Icon
                    size={16}
                    className={
                      index === 1 ? 'text-orange' : index === 3 ? 'text-purple' : 'text-brand'
                    }
                  />
                </div>
                <strong className="mt-4 block text-2xl">{value}</strong>
                <span
                  className={`mt-2 block text-[10px] ${index === 1 ? 'text-orange' : 'text-brand'}`}
                >
                  {statNotes[note] ?? note}
                </span>
                <div className="mt-3 h-1 rounded-full bg-elevated">
                  <div className="h-full w-3/4 rounded-full bg-brand" />
                </div>
              </Card>
            )
          })}
        </section>
        <div className="nh-grid-12 mt-6 grid min-w-0 items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                <div>
                  <h2 className="text-xl font-semibold">Tăng trưởng nền tảng và xu hướng hoạt động</h2>
                  <p className="text-xs text-muted">
                    So sánh chỉ số tiếp nhận và người tham gia nền tảng
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tabs
                    value={metric}
                    onChange={setMetric}
                    items={[
                      { value: 'signups', label: 'Đăng ký người dùng' },
                      { value: 'stories', label: 'Tiếp nhận truyện' },
                      { value: 'royalty', label: 'Nhuận bút xu' },
                    ]}
                  />
                  <select
                    value={range}
                    onChange={event => setRange(event.target.value)}
                    className="rounded-xl border border-line bg-surface px-3 text-xs"
                  >
                    <option value="30d">30 ngày gần nhất</option>
                    <option value="90d">90 ngày gần nhất</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex h-64 items-end justify-around gap-5 border-b border-line px-4">
                {bars.map(([readers, authors], index) => {
                  const first = metric === 'stories' ? authors : metric === 'royalty' ? Math.round((readers + authors) / 2) : readers
                  const second = metric === 'stories' ? readers : metric === 'royalty' ? Math.max(18, authors - 8) : authors
                  const scale = range === '90d' ? 0.88 : 1
                  return (
                  <div key={index} className="flex h-full flex-1 items-end justify-center gap-2">
                    <div
                      className="w-1/3 max-w-12 rounded-t-xl bg-brand"
                      style={{ height: `${Math.round(first * scale)}%` }}
                    />
                    <div
                      className="w-1/3 max-w-12 rounded-t-xl bg-orange"
                      style={{ height: `${Math.round(second * scale)}%` }}
                    />
                  </div>
                  )
                })}
              </div>
              <div className="nh-grid-12 mt-3 grid nh-cols-4 text-center text-[9px] text-muted">
                <span>Tuần 1</span>
                <span>Tuần 2</span>
                <strong className="text-ink">Tuần 3 ★</strong>
                <span>Tuần 4</span>
              </div>
              <div className="nh-grid-12 mt-6 grid gap-3 rounded-3xl bg-elevated p-5 nh-sm-cols-3">
                <Metric label="Người dùng hoạt động hằng ngày" value="245.600" note="↑ 4,1% mỗi tuần" />
                <Metric
                  label="Phiên đọc trung bình"
                  value="38,5 phút"
                  note="Trên 6,2 chương/ngày"
                />
                <Metric
                  label="Dòng lưu thông xu"
                  value="184.200 USD"
                  note="99,4% đối soát hoàn tất"
                />
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Thao tác quản trị quan trọng gần đây</h2>
                  <p className="text-xs text-muted">
                    Nhật ký kiểm tra bất biến theo thời gian phục vụ tuân thủ nền tảng
                  </p>
                </div>
                <button onClick={() => window.location.assign('/admin/audit-logs')} className="text-xs text-brand">Xem toàn bộ nhật ký kiểm tra →</button>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-line text-[9px] uppercase tracking-[.12em] text-muted">
                    <tr>
                      <th className="pb-3">Thời gian</th>
                      <th className="pb-3">Người vận hành / Chủ thể</th>
                      <th className="pb-3">Sự kiện hệ thống và phạm vi</th>
                      <th className="pb-3">Kết quả</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {adminAudit.map(([time, operator, event, status]) => (
                      <tr key={time}>
                        <td className="py-4 font-mono text-muted">{time}</td>
                        <td className="py-4 font-semibold">{operator}</td>
                        <td className="py-4">{eventLabels[event] ?? event}</td>
                        <td className="py-4">
                          <Badge
                            tone={
                              status === 'Success'
                                ? 'green'
                                : status.includes('High')
                                  ? 'red'
                                  : 'orange'
                            }
                          >
                            {statusLabels[status] ?? status}
                          </Badge>
                        </td>
                        <td>
                          <Ellipsis size={15} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            <Card>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Tình trạng dịch vụ</h2>
                  <p className="text-xs text-muted">Ping và độ trễ vi dịch vụ theo thời gian thực</p>
                </div>
                <Badge tone="green">100% ổn định</Badge>
              </div>
              <div className="mt-5 space-y-3">
                {serviceHealth.map(([name, stack, latency, uptime]) => (
                  <div key={name} className="rounded-2xl bg-elevated p-4">
                    <div className="flex justify-between">
                      <strong className="text-xs">{name}</strong>
                      <span className="text-[10px] text-brand">● {latency}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] text-muted">
                      <span>{stack}</span>
                      <span>{uptime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="text-xl font-semibold">Lưu trữ và dung lượng</h2>
              <Capacity label="Cụm PostgreSQL chính" value="6,4 TB / 12 TB" percent={53} />
              <Capacity
                label="Kho đối tượng media và âm thanh"
                value="84,2 TB / 150 TB"
                percent={56}
                tone="orange"
              />
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-xl font-semibold text-rose">
                <ShieldAlert />
                Biện pháp bảo vệ nền tảng
              </h2>
              <p className="mt-2 text-xs text-muted">
                Cơ chế ứng phó sự cố khẩn cấp và kích hoạt an toàn
              </p>
              <Toggle
                label="Chế độ bảo trì"
                note="Hiển thị màn hình bảo trì cho độc giả"
                value={maintenance}
                setValue={setMaintenance}
              />
              <Toggle
                label="Khóa chỉ đọc"
                note="Tạm dừng bản gửi mới của tác giả"
                value={readOnly}
                setValue={setReadOnly}
              />
              <Button
                variant="secondary"
                onClick={() => setSafeguard('Xóa bộ nhớ đệm CDN biên toàn cầu')}
                className="mt-4 w-full"
              >
                Xóa bộ nhớ đệm CDN biên toàn cầu
              </Button>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(safeguard)}
          title="Xác nhận biện pháp bảo vệ nền tảng"
          onClose={() => setSafeguard(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-rose/10 p-4">
            <ShieldAlert className="shrink-0 text-rose" />
            <p className="text-sm">
              {safeguard} sẽ chỉ được mô phỏng cục bộ. Không dịch vụ nền tảng nào bị thay đổi.
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSafeguard(null)}>
              Hủy
            </Button>
            <Button onClick={() => setSafeguard(null)}>Xác nhận thao tác mẫu</Button>
          </div>
        </Modal>
      </main>
    </AdminLayout>
  )
}
function Metric({ label, value, note }) {
  return (
    <div>
      <span className="text-[10px] text-muted">{label}</span>
      <strong className="mt-1 block text-xl">{value}</strong>
      <span className="text-[9px] text-brand">{note}</span>
    </div>
  )
}
function Capacity({ label, value, percent, tone = 'brand' }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-elevated">
        <div
          className={`h-full rounded-full ${tone === 'orange' ? 'bg-orange' : 'bg-brand'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-[9px] text-muted">Đã dùng {percent}% · các bản sao cân bằng</p>
    </div>
  )
}
function Toggle({ label, note, value, setValue }) {
  return (
    <button
      onClick={() => setValue(!value)}
      className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-elevated p-3 text-left"
    >
      <div className="flex-1">
        <strong className="block text-xs">{label}</strong>
        <span className="text-[10px] text-muted">{note}</span>
      </div>
      <span
        className={`flex h-6 w-11 items-center rounded-full p-1 ${value ? 'justify-end bg-brand' : 'justify-start bg-line'}`}
      >
        <span className="size-4 rounded-full bg-white" />
      </span>
    </button>
  )
}
