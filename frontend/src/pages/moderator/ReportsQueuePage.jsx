import { useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  Gavel,
  MessageSquareWarning,
  Scale,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ModeratorLayout } from '../../layouts'
import { communityReports } from '../../data/mock/moderation'
import { Badge, Button, Card, Input, Modal, Select } from '../../components/ui'

const statusTabs = [
  { value: 'Open', label: 'Đang mở' },
  { value: 'In Review', label: 'Đang xét duyệt' },
  { value: 'Resolved', label: 'Đã giải quyết' },
  { value: 'Escalated', label: 'Đã chuyển cấp' },
]
const severityLabels = { High: 'Cao', Medium: 'Trung bình', Low: 'Thấp' }
const statusLabels = { Open: 'Đang mở', 'In Review': 'Đang xét duyệt', Resolved: 'Đã giải quyết', Escalated: 'Đã chuyển cấp' }
const titleLabels = { 'Copyright & Plagiarism Claim': 'Khiếu nại bản quyền và đạo văn', 'Comment Harassment / Toxic Behavior': 'Bình luận quấy rối / hành vi độc hại', 'Unrated Mature Content (Missing 18+ Gate)': 'Nội dung trưởng thành chưa phân loại (thiếu cổng 18+)', 'Misleading Story Metadata': 'Thông tin truyện gây hiểu nhầm' }
const formatAge = value => value.replace('m ago', ' phút trước').replace('h ago', ' giờ trước')
const formatTarget = value => value
  .replace('Reader comment on ', 'Bình luận độc giả về ')
  .replace('(Ch. ', '(Chương ')
const formatReportMeta = value => value
  .replace('Similarity Index', 'chỉ số tương đồng')
  .replace('Trust & Safety review', 'Xét duyệt Tin cậy và An toàn')
  .replace('Rating audit', 'Kiểm tra phân loại')
  .replace('Metadata check', 'Kiểm tra thông tin')
  .replace(' readers flagged', ' độc giả báo cáo')
  .replace(' users flagged', ' người dùng báo cáo')
  .replace(' reader flagged', ' độc giả báo cáo')

export function ReportsQueuePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Open')
  const [severity, setSeverity] = useState('All')
  const [reason, setReason] = useState('All Infraction Types')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(communityReports[0])
  const [resolution, setResolution] = useState(null)
  const [resolved, setResolved] = useState([])
  const rows = useMemo(
    () =>
      communityReports.filter(
        report =>
          !resolved.includes(report.id) &&
          (status === 'Open'
            ? ['Open', 'In Review'].includes(report.status)
            : report.status === status) &&
          (severity === 'All' || report.severity === severity) &&
          (reason === 'All Infraction Types' || report.title.includes(reason.split(' / ')[0])) &&
          `${report.id} ${report.title} ${report.target} ${report.lead}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [status, severity, reason, query, resolved],
  )
  const confirm = () => {
    if (resolution === 'Bác bỏ do không có căn cứ') setResolved(current => [...current, selected.id])
    setResolution(null)
  }
  return (
    <ModeratorLayout>
      <main className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs text-muted">
              Bảng điều khiển kiểm duyệt / <strong>Báo cáo cộng đồng và An toàn</strong>
            </p>
            <h1 className="mt-2 text-2xl font-bold">Hàng đợi báo cáo</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>15 báo cáo đang mở</Badge>
            <Badge tone="red">4 mức nghiêm trọng cao</Badge>
            <Badge tone="orange">8 đang xét duyệt</Badge>
            <Badge tone="purple">3 đã chuyển cấp</Badge>
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm mã báo cáo, người dùng, đoạn trích..."
              className="w-full sm:w-72"
            />
          </div>
        </div>
        <Card className="mt-5 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex gap-2 overflow-x-auto">
              {statusTabs.map(item => (
                <button
                  key={item.value}
                  onClick={() => setStatus(item.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs ${status === item.value ? 'bg-surface font-semibold text-brand shadow-sm' : 'text-muted'}`}
                >
                  {item.label}{' '}
                  {item.value === 'Open'
                    ? '15'
                    : item.value === 'In Review'
                      ? '8'
                      : item.value === 'Resolved'
                        ? '142'
                        : '3'}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row xl:ml-auto">
              <Select value={severity} onChange={event => setSeverity(event.target.value)}>
                <option value="All">Tất cả</option>
                <option value="High">Cao</option>
                <option value="Medium">Trung bình</option>
                <option value="Low">Thấp</option>
              </Select>
              <Select value={reason} onChange={event => setReason(event.target.value)}>
                <option value="All Infraction Types">Tất cả loại vi phạm</option>
                <option value="Copyright / Plagiarism">Bản quyền / Đạo văn</option>
                <option value="Harassment / Toxicity">Quấy rối / Độc hại</option>
                <option value="Unrated Mature Content">Nội dung trưởng thành chưa phân loại</option>
              </Select>
            </div>
          </div>
        </Card>
        <div className="mt-5 grid min-h-[760px] gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
          <section>
            <div className="mb-3 flex justify-between text-xs text-muted">
              <span>Đang hiển thị 1–{rows.length} / 15 báo cáo sự cố chờ xử lý</span>
              <span>
                Sắp xếp theo: <strong className="text-ink">Mức khẩn cấp và thời gian gần nhất</strong>
              </span>
            </div>
            <div className="space-y-4">
              {rows.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  active={selected?.id === report.id}
                  onSelect={() => setSelected(report)}
                />
              ))}
            </div>
            {!rows.length && (
              <Card className="py-14 text-center">
                <CheckCircle2 className="mx-auto text-brand" />
                <p className="mt-3 text-sm">Không có báo cáo trong hàng đợi này.</p>
              </Card>
            )}
          </section>
          <IncidentInspector
            report={selected}
            onResolution={setResolution}
            onSimilarity={() => navigate('/moderator/similarity-review/demo')}
          />
        </div>
        <Modal
          open={Boolean(resolution)}
          title="Xác nhận thao tác kiểm duyệt"
          onClose={() => setResolution(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <Gavel className="shrink-0 text-orange" />
            <div>
              <strong>{resolution}</strong>
              <p className="mt-1 text-xs text-muted">
                Hồ sơ #{selected?.id} · Thao tác này chỉ cập nhật bản xem trước cục bộ.
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Lý do giải quyết..."
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResolution(null)}>
              Hủy
            </Button>
            <Button onClick={confirm}>Ghi nhận thao tác</Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}

function ReportCard({ report, active, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-3xl border bg-surface p-5 text-left ${active ? 'border-brand ring-2 ring-brand/20' : report.tone === 'red' ? 'border-rose/30' : 'border-line'}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <span
          className={`grid size-12 shrink-0 place-items-center rounded-full ${report.tone === 'red' ? 'bg-rose/15 text-rose' : 'bg-orange/15 text-orange'}`}
        >
          {report.title.includes('Harassment') ? <MessageSquareWarning /> : <FileWarning />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-brand">#{report.id}</strong>
            <Badge tone={report.tone}>Mức {severityLabels[report.severity] ?? report.severity}</Badge>
            <Badge tone="orange">{statusLabels[report.status] ?? report.status}</Badge>
            <span className="text-xs text-muted">· {formatAge(report.age)}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold">{titleLabels[report.title] ?? report.title}</h2>
          <p className="mt-2 text-sm">
            <BookOpen size={14} className="mr-2 inline" />
            Đối tượng: <strong>{formatTarget(report.target)}</strong>
          </p>
          <div className="mt-4 rounded-2xl bg-elevated p-3 text-sm italic text-muted">
            “{report.excerpt}”
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs text-muted">
            <span>{formatReportMeta(report.score)}</span>
            <span>{formatReportMeta(report.reporters)}</span>
            <span>
              Người báo cáo chính: <strong className="text-brand">{report.lead}</strong>
            </span>
            <Badge className="ml-auto">Phân công: {report.assigned === 'Unassigned' ? 'Chưa phân công' : report.assigned}</Badge>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>
    </button>
  )
}
function IncidentInspector({ report, onResolution, onSimilarity }) {
  if (!report)
    return (
      <Card className="hidden xl:block">
        <p className="text-muted">Chọn một báo cáo để kiểm tra.</p>
      </Card>
    )
  return (
    <aside className="rounded-3xl border border-line bg-surface p-5 xl:sticky xl:top-24">
      <div className="flex justify-between border-b border-line pb-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="text-brand" />
          Kiểm tra sự cố
        </h2>
        <span className="text-xs text-muted">Bộ phận xác minh P30</span>
      </div>
      <div className="mt-5 flex justify-between">
        <strong className="text-brand">Hồ sơ #{report.id}</strong>
        <Badge tone={report.tone}>Mức {severityLabels[report.severity] ?? report.severity}</Badge>
      </div>
      <h2 className="mt-4 text-2xl font-bold">
        {report.title === 'Copyright & Plagiarism Claim'
          ? 'Khiếu nại đạo văn: Đã xác minh đoạn trùng khớp'
          : titleLabels[report.title] ?? report.title}
      </h2>
      <p className="mt-2 text-sm text-muted">
        Mở {formatAge(report.age)} · Phân công cho <strong className="text-ink">{report.assigned === 'Unassigned' ? 'Chưa phân công' : report.assigned}</strong>
      </p>
      <div className="mt-5 rounded-3xl bg-elevated p-5">
        <strong className="flex items-center gap-2">
          <UserRoundCheck size={16} className="text-brand" />
          Tường trình của người báo cáo
        </strong>
        <p className="mt-3 text-sm leading-6">
          “Nội dung bị báo cáo có dấu hiệu vi phạm hướng dẫn an toàn và xuất bản NovelHub. Vui lòng
          xác minh đoạn trích được dẫn và ngữ cảnh xung quanh.”
        </p>
      </div>
      <div className="mt-5 rounded-3xl border border-rose/50 bg-rose/5 p-5">
        <div className="flex justify-between text-xs">
          <strong>Đoạn bị cảnh báo trong “{formatTarget(report.target)}”</strong>
          <span className="text-rose">Trùng khớp chính xác (94%)</span>
        </div>
        <blockquote className="mt-4 border-l-2 border-rose pl-4 text-sm italic leading-7">
          “{report.excerpt} They harvest each vow broken upon the shore, waiting for salt to bleach
          the memory of kings.”
        </blockquote>
        <p className="mt-3 text-xs text-muted">Vị trí: Đoạn 24–26</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted">Tác giả bị báo cáo</p>
          <strong className="mt-3 block">@erik_pen</strong>
          <p className="mt-2 text-xs text-muted">
            2 tác phẩm đã xuất bản
            <br />0 vi phạm bản quyền trước đây
            <br />
            <span className="text-brand">Hồ sơ sạch</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted">Độ tin cậy người báo cáo</p>
          <strong className="mt-3 block text-2xl text-brand">94%</strong>
          <p className="mt-2 text-xs text-muted">
            Cộng tác viên đáng tin cậy
            <br />
            18 cảnh báo đã xác nhận
          </p>
        </Card>
      </div>
      <Button onClick={onSimilarity} className="mt-5 w-full">
        <ShieldCheck size={15} />
        Mở so sánh tương đồng (P31)
      </Button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => onResolution('Bác bỏ do không có căn cứ')} variant="secondary">
          <X size={14} />
          Bác bỏ
        </Button>
        <Button
          onClick={() => onResolution('Yêu cầu chỉnh sửa')}
          variant="secondary"
          className="text-orange"
        >
          Yêu cầu sửa
        </Button>
      </div>
      <Button
        onClick={() => onResolution('Chuyển Đội Pháp lý Sở hữu trí tuệ')}
        className="mt-2 w-full border-rose bg-rose"
      >
        <Scale size={15} />
        Chuyển Đội Pháp lý Sở hữu trí tuệ
      </Button>
    </aside>
  )
}
