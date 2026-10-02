import { useState } from 'react'
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  FileWarning,
  Flag,
  Gavel,
  Scale,
  ShieldCheck,
} from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { moderationStats, urgentModerationItems } from '../../data/mock/moderation'
import { Badge, Button, Card, Modal } from '../../components/ui'

const metricIcons = [BookOpenCheck, Flag, Bot, Scale, Gavel]
const workload = [
  ['Kỳ ảo và Thần thoại', 42, 'còn 2 giờ 15 phút', 'brand'],
  ['Lãng mạn và Chính kịch đương đại', 28, 'còn 3 giờ 40 phút', 'rose'],
  ['Khoa học viễn tưởng và Cyberpunk', 18, 'còn 4 giờ 05 phút', 'purple'],
  ['Bí ẩn và Giật gân', 12, 'còn 5 giờ 20 phút', 'orange'],
]
const audit = [
  ['14:22', 'Đã phê duyệt Chương 15 của “A Dragon’s Wish”', 'Đã xác minh đạt'],
  ['14:05', 'Đã yêu cầu chỉnh sửa “Echoes of Void”', 'Cần hành động'],
  ['13:40', 'Đã bác bỏ báo cáo sai về “The Last Kingdom”', 'Đã bác bỏ'],
  ['12:55', 'Đã chuyển hồ sơ SHTT #IP-4402 tới Bộ phận Pháp lý Cấp cao', 'Chuyển cấp 2'],
]
const statLabels = { 'Pending Queue': 'Hàng đợi đang chờ', 'User Reports': 'Báo cáo người dùng', 'AI Signals': 'Tín hiệu AI', Escalations: 'Chuyển cấp', 'Decisions Today': 'Quyết định hôm nay' }
const statNotes = { '+6 this hr': '+6 trong giờ này', '4 Urgent': '4 khẩn cấp', '3 Copyright': '3 bản quyền', 'Tier-2 Legal': 'Pháp lý cấp 2', '34 Approvals': '34 phê duyệt' }
const kindLabels = { Manuscript: 'Bản thảo', Report: 'Báo cáo', 'Similarity Flag': 'Cảnh báo tương đồng' }
const actionLabels = { 'Quick Review': 'Xét duyệt nhanh', 'Open Dossier': 'Mở hồ sơ', Inspect: 'Kiểm tra', Compare: 'So sánh' }
const formatItemText = value => value
  .replace('Submitted ', 'Đã gửi ')
  .replace('Reported ', 'Đã báo cáo ')
  .replace('Cross-indexed ', 'Đối chiếu chỉ mục ')
  .replace(' ago', ' trước')
  .replace('Severity: High', 'Mức độ: Cao')
  .replace('Severity: Medium', 'Mức độ: Trung bình')
  .replace('Author:', 'Tác giả:')
  .replace('Complaint:', 'Khiếu nại:')
  .replace('Flag:', 'Cảnh báo:')
  .replace('Trigger:', 'Tác nhân:')
  .replace('AI Safety Score:', 'Điểm an toàn AI:')
  .replace('AI Vector Check:', 'Kiểm tra vector AI:')
  .replace('semantic overlap detected with registered IP', 'phát hiện trùng lặp ngữ nghĩa với SHTT đã đăng ký')
  .replace('Fantasy', 'Kỳ ảo')
  .replace('Ch. ', 'Chương ')
  .replace('24m', '24 phút')
  .replace('45m', '45 phút')
  .replace('1h 10m', '1 giờ 10 phút')
  .replace('1h 35m', '1 giờ 35 phút')
  .replace('Graphic violence keyword density', 'Mật độ từ khóa bạo lực trực diện')
  .replace('Plagiarism claim on Scene 4 dialogue', 'Khiếu nại đạo văn trong lời thoại Cảnh 4')
  .replace('words', 'từ')

export function ModeratorOverviewPage() {
  const [priority, setPriority] = useState('All')
  const [selected, setSelected] = useState(null)
  const [decision, setDecision] = useState('')
  const items = urgentModerationItems.filter(
    item => priority === 'All' || item.tone === priority.toLowerCase(),
  )
  return (
    <ModeratorLayout>
      <main className="page-moderator py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-muted">
              Ca làm: 03 giờ 45 phút · Đã xét hôm nay: <strong className="text-ink">42 mục</strong> · SLA
              đạt: <strong className="text-brand">98,4%</strong>
            </p>
            <h1 className="mt-1 text-2xl font-bold">Tổng quan hoạt động kiểm duyệt</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {['All', 'Green', 'Orange', 'Red', 'Purple'].map(item => (
              <button
                key={item}
                onClick={() => setPriority(item)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs ${priority === item ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}
              >
                {item === 'All' ? 'Tất cả mức ưu tiên' : item === 'Green' ? 'Xanh lá' : item === 'Orange' ? 'Cam' : item === 'Red' ? 'Đỏ' : 'Tím'}
              </button>
            ))}
          </div>
        </div>
        <section className="nh-grid-12 mt-6 grid nh-cols-1 nh-sm-cols-2 gap-3 nh-xl-cols-3">
          {moderationStats.map(([label, value, note, tone], index) => {
            const Icon = metricIcons[index]
            return (
              <Card key={label} className="p-4">
                <div className="flex justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[.12em] text-muted">
                    {statLabels[label] ?? label}
                  </span>
                  <Icon
                    size={16}
                    className={
                      tone === 'red'
                        ? 'text-rose'
                        : tone === 'orange'
                          ? 'text-orange'
                          : tone === 'purple'
                            ? 'text-purple'
                            : 'text-brand'
                    }
                  />
                </div>
                <strong className="mt-4 block text-3xl">{value}</strong>
                <Badge tone={tone} className="mt-2">
                  {statNotes[note] ?? note}
                </Badge>
                <div className="mt-3 h-1 rounded-full bg-elevated">
                  <div
                    className={`h-full w-2/3 rounded-full ${tone === 'red' ? 'bg-rose' : tone === 'orange' ? 'bg-orange' : tone === 'purple' ? 'bg-purple' : 'bg-brand'}`}
                  />
                </div>
              </Card>
            )
          })}
        </section>
        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <span className="size-2 rounded-full bg-red-600" />
                  Mục hành động ưu tiên khẩn cấp
                </h2>
                <span className="text-[10px] text-muted">{items.length} mục cần xử lý</span>
              </div>
              <div className="mt-5 space-y-3">
                {items.map(item => (
                  <UrgentItem key={item.id} item={item} onOpen={() => setSelected(item)} />
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Khối lượng công việc và lượng tiếp nhận theo thể loại
                  </h2>
                  <p className="text-xs text-muted">
                    Phân bổ hàng đợi theo thể loại xuất bản theo thời gian thực
                  </p>
                </div>
                <Badge>Cập nhật mỗi 60 giây</Badge>
              </div>
              <div className="mt-5 space-y-5">
                {workload.map(([label, value, sla, tone]) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 text-xs">
                      <span>{label}</span>
                      <span className="ml-auto text-[10px] text-brand">SLA: {sla}</span>
                      <strong>{value}%</strong>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-elevated">
                      <div
                        className={`h-full rounded-full ${tone === 'rose' ? 'bg-rose' : tone === 'purple' ? 'bg-purple' : tone === 'orange' ? 'bg-orange' : 'bg-brand'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <h2 className="text-lg font-semibold">
                  Quyết định kiểm duyệt và nhật ký gần đây
                </h2>
                <button onClick={() => window.location.assign('/moderator/audit-trail')} className="text-xs text-brand">Xem toàn bộ nhật ký kiểm tra</button>
              </div>
              <div className="mt-5 space-y-4 border-l border-line pl-5">
                {audit.map(([time, title, status], index) => (
                  <div key={time} className="relative">
                    <span
                      className={`absolute -left-[25px] top-1 size-2.5 rounded-full ${index === 0 ? 'bg-brand' : index === 1 ? 'bg-orange' : index === 2 ? 'bg-blue-500' : 'bg-purple'}`}
                    />
                    <p className="text-xs">
                      <strong>{time}</strong> · {title} <Badge className="ml-2">{status}</Badge>
                    </p>
                    <p className="mt-1 text-[10px] text-muted">
                      Ghi nhận bởi Sarah Jenkins · Tham chiếu kiểm tra bất biến
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="text-brand" />
                Chỉ thị chính sách
              </h2>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between">
                  <strong className="text-xs">Creator Rights v4.2</strong>
                  <Badge tone="green">Đang áp dụng</Badge>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-muted">
                  Hướng dẫn trích dẫn sử dụng hợp lý được mở rộng đến 350 từ cho nội dung bình luận
                  phản biện và châm biếm.
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-orange/40 bg-orange/10 p-4">
                <strong className="flex gap-2 text-xs text-orange">
                  <AlertTriangle size={14} />
                  Hướng dẫn tín hiệu AI
                </strong>
                <p className="mt-2 text-[10px] leading-5 text-muted">
                  Điểm đo lường tự động chỉ là mốc tham khảo, không phải kết luận cuối cùng.
                </p>
              </div>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Tốc độ hàng đợi và SLA</h2>
              <div className="mt-4 space-y-5">
                <Sla label="Phân loại sơ bộ" value={100} />
                <Sla label="SLA phê duyệt xuất bản" value={94} />
                <Sla label="Giải quyết báo cáo người dùng" value={96} />
              </div>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Bộ phận chuyển cấp</h2>
              <div className="mt-4 space-y-3">
                {['Bộ phận Pháp lý Cấp cao', 'Trưởng nhóm Kiểm duyệt'].map((name, index) => (
                  <div key={name} className="flex items-center gap-3 rounded-2xl bg-elevated p-3">
                    <span
                      className={`grid size-9 place-items-center rounded-full ${index ? 'bg-orange/20 text-orange' : 'bg-brand/20 text-brand'}`}
                    >
                      {index ? 'LM' : 'LD'}
                    </span>
                    <div>
                      <strong className="text-xs">{name}</strong>
                      <p className="text-[9px] text-muted">Trực tuyến · Chuyên gia trực ca</p>
                    </div>
                    <Button onClick={() => window.alert('Đã gửi tín hiệu tới kiểm duyệt viên (bản mẫu).')} variant="secondary" className="ml-auto min-h-8 px-2 py-1 text-[9px]">
                      Báo hiệu
                    </Button>
                  </div>
                ))}
              </div>
              <button onClick={() => window.alert('Đã yêu cầu đóng băng hàng đợi khẩn cấp (bản mẫu).')} className="mt-4 w-full rounded-2xl border border-dashed border-line p-3 text-xs text-muted">
                Kích hoạt đóng băng hàng đợi khẩn cấp
              </button>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(selected)}
          title={selected ? `${kindLabels[selected.kind] ?? selected.kind} #${selected.id}` : ''}
          onClose={() => setSelected(null)}
        >
          <h3 className="font-semibold">{selected?.title}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">{selected && formatItemText(selected.detail)}</p>
          <textarea
            value={decision}
            onChange={event => setDecision(event.target.value)}
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Thêm ghi chú quyết định nội bộ..."
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Hoãn xử lý
            </Button>
            <Button
              onClick={() => {
                setSelected(null)
                setDecision('')
              }}
            >
              <CheckCircle2 size={15} />
              Ghi nhận quyết định
            </Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}
function UrgentItem({ item, onOpen }) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border p-4 sm:flex-row sm:items-center ${item.tone === 'red' ? 'border-rose/40' : item.tone === 'purple' ? 'border-purple/40' : 'border-line'}`}
    >
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-2xl ${item.tone === 'red' ? 'bg-rose/15 text-rose' : item.tone === 'orange' ? 'bg-orange/15 text-orange' : item.tone === 'purple' ? 'bg-purple/15 text-purple' : 'bg-brand/15 text-brand'}`}
      >
        {item.kind === 'Report' ? (
          <FileWarning />
        ) : item.kind === 'Similarity Flag' ? (
          <ShieldCheck />
        ) : (
          <BookOpenCheck />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <Badge tone={item.tone}>
          {kindLabels[item.kind] ?? item.kind} #{item.id}
        </Badge>
        <p className="mt-1 text-[10px] text-muted">{formatItemText(item.meta)}</p>
        <h3 className="mt-2 font-semibold">{item.title}</h3>
        <p className="mt-1 text-[10px] text-muted">{formatItemText(item.detail)}</p>
      </div>
      <Button
        onClick={onOpen}
        className={`${item.tone === 'red' ? 'border-rose bg-rose' : item.tone === 'purple' ? 'border-purple bg-purple' : ''} shrink-0`}
      >
        {actionLabels[item.action] ?? item.action}
      </Button>
    </div>
  )
}
function Sla({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <strong className="text-brand">Đạt {value}%</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-elevated">
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
