import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Download,
  FileSearch,
  Gavel,
  Link2,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { Badge, Button, Card, Input, Modal } from '../../components/ui'

const metrics = [
  ['Trùng lặp ngữ nghĩa', '68,4%', 'Cosine vector', 'Rủi ro trung bình', 'orange'],
  ['Trùng văn bản nguyên câu', '14,2%', 'Chuỗi cụm từ chính xác', 'Vượt ngưỡng', 'red'],
  ['Nhịp cấu trúc chương', '78,0%', 'Nhịp điểm cảnh', 'Mô-típ cao', 'purple'],
  ['Độ tin cậy mô hình', 'Cao', '1,4M tiêu đề đã lập chỉ mục', 'Chỉ mục đã xác minh', 'green'],
]
const passages = [
  {
    match: '92% match · 64 words',
    target:
      'The wardens of elder days do not slumber lightly, wanderer. They wait within the grain of ancient saplings where no sunlight penetrates, listening with hollow ears to the trespass of mortals who carry blood on their hands. If you draw their breath into your lungs, memory turns to ash before twilight falls upon the ridge.',
    reference:
      'The wardens of elder days do not slumber lightly, wanderer. They sleep within the heartwood of ancient saplings where sun never shines, listening with hollow ears to the feet of travelers who bear unresolved slaughter upon their hands. If you draw their breath into your lungs, memory turns to ash before twilight falls upon the valley.',
  },
  {
    match: '74% match · 48 words',
    target:
      'The iron bell spoke once beneath the drowned sanctuary, and every lantern along the northern causeway answered with a blue flame.',
    reference:
      'The bronze bell sounded beneath the flooded sanctuary, while lanterns on the northern road answered in pale blue fire.',
  },
  {
    match: '61% match · 35 words',
    target:
      'No crown forged by mortal hands could command the root-bound king, whose oath belonged only to winter and stone.',
    reference:
      'No human crown could command the forest king; his covenant was sworn to winter, root and stone.',
  },
]

export function SimilarityRiskReviewPage() {
  const [passage, setPassage] = useState(0)
  const [sync, setSync] = useState(true)
  const [findings, setFindings] = useState(
    'Có các mô-típ dân gian kỳ ảo phổ biến, nhưng câu mở đầu Chương 2 cho thấy sự phái sinh cấu trúc trực tiếp. Cần yêu cầu làm rõ.',
  )
  const [softHold, setSoftHold] = useState(true)
  const [notify, setNotify] = useState(true)
  const [action, setAction] = useState(null)
  const [recorded, setRecorded] = useState('')
  const selected = passages[passage]
  return (
    <ModeratorLayout>
      <main className="page-moderator py-5">
        <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs text-muted">
              Bảng điều khiển kiểm duyệt / Cảnh báo tương đồng và kiểm tra rủi ro SHTT
            </p>
            <h1 className="mt-1 text-xl font-bold">
              Cảnh báo #SIM-3012: Chronicles of Eldor so với tác phẩm đã đăng ký
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="orange">Cần kiểm tra</Badge>
            <Input icon={Search} placeholder="Tìm trong văn bản bị cảnh báo..." className="w-full sm:w-56" />
            <Button onClick={() => window.alert('Đã xuất báo cáo tương đồng (bản mẫu).')} variant="secondary">
              <Download size={14} />
              Xuất JSON kiểm tra
            </Button>
          </div>
        </div>
        <div className="mt-4 flex gap-3 rounded-2xl bg-orange/10 p-4 text-xs leading-5">
          <AlertTriangle size={18} className="shrink-0 text-orange" />
          <p>
            <strong>Lưu ý: Chỉ số tương đồng AI và vector chỉ là bằng chứng hỗ trợ</strong>, không
            phải kết luận vi phạm bản quyền. Cần đánh giá ngữ cảnh châm biếm, mô-típ dân gian phổ
            biến và chủ ý phong cách.
          </p>
        </div>
        <Card className="mt-6">
          <div className="flex justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileSearch size={16} className="text-brand" />
              Phân tích vector tự động và suy đoán đạo văn
            </h2>
            <p className="text-[9px] text-muted">
              Thuật toán: Sentence-BERT Đa ngôn ngữ v3.2 · Cosine 0,316
            </p>
          </div>
          <div className="nh-grid-12 mt-5 grid nh-cols-2 gap-3 nh-xl-cols-4">
            {metrics.map(([label, value, note, status, tone]) => (
              <div key={label} className="rounded-3xl border border-line bg-elevated p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="text-[10px] text-muted">{label}</span>
                  <Badge tone={tone}>{status}</Badge>
                </div>
                <strong
                  className={`mt-5 block text-3xl ${tone === 'orange' ? 'text-orange' : tone === 'red' ? 'text-rose' : tone === 'purple' ? 'text-purple' : 'text-brand'}`}
                >
                  {value}
                </strong>
                <p className="mt-2 text-[9px] text-muted">{note}</p>
                <div className="mt-4 h-1.5 rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${tone === 'orange' ? 'bg-orange' : tone === 'red' ? 'bg-rose' : tone === 'purple' ? 'bg-purple' : 'bg-brand'}`}
                    style={{ width: value === 'Cao' ? '91%' : value.replace(',', '.') }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 lg:flex-row lg:items-center">
          <strong className="text-xs">Các đoạn trùng khớp:</strong>
          <div className="flex gap-2 overflow-x-auto">
            {passages.map((item, index) => (
              <button
                key={item.match}
                onClick={() => setPassage(index)}
                className={`shrink-0 rounded-full border px-4 py-2 text-[10px] ${passage === index ? 'border-brand bg-brand text-white' : 'border-line'}`}
              >
                Đoạn {index + 1} / 3 · {item.match.replace('match', 'trùng').replace('words', 'từ')}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSync(value => !value)}
            className="ml-auto flex shrink-0 items-center gap-2 text-[10px] text-brand"
          >
            <span
              className={`grid size-5 place-items-center rounded-full border ${sync ? 'border-brand bg-brand text-white' : 'border-line'}`}
            >
              {sync && <Check size={11} />}
            </span>
            Đồng bộ cuộn hai bên
          </button>
        </div>
        <section className="nh-grid-12 mt-5 grid gap-5 nh-lg-cols-2">
          <ComparisonPanel
            label="Bản thảo đã gửi"
            title="Bản thảo mục tiêu: Chronicles of Eldor (Chương 2)"
            meta="Tác giả: Dorian Reed · Gửi tháng 10/2026 · 4.120 từ"
            tone="orange"
            text={selected.target}
          />
          <ComparisonPanel
            label="Tác phẩm gốc đã xuất bản"
            title="Tác phẩm tham chiếu trước đó: Ancient Echoes of Eldoria (Chương 5)"
            meta="Tác giả: Elena J. Park · Xuất bản tháng 03/2024 · 145.000 lượt đọc"
            tone="green"
            text={selected.reference}
          />
        </section>
        <Card className="mt-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles size={16} className="text-purple" />
            Tổng hợp khác biệt ngôn ngữ và phân tích hình thái
          </h2>
          <div className="nh-grid-12 mt-4 grid gap-3 nh-md-cols-3">
            <Diagnostic title="Thay thế từ vựng trực tiếp">
              “sleep within heartwood” → “wait within the grain” vẫn giữ nhịp điệu và cấu trúc mệnh
              đề phụ thuộc.
            </Diagnostic>
            <Diagnostic title="Mệnh đề phụ thuộc giống nhau">
              “where no sunlight penetrates” và “memory turns to ash before twilight falls” có mức
              tương đồng cao.
            </Diagnostic>
            <Diagnostic title="Từ vựng xây dựng thế giới dân gian">
              Tên vùng đất và thực thể khác nhau, trong khi hộ vệ, thời cổ đại và tro gần như hoặc
              hoàn toàn giống nhau.
            </Diagnostic>
          </div>
        </Card>
        <Card className="mt-5">
          <div className="flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Gavel className="text-brand" />
                Đánh giá của kiểm duyệt viên và quyết định cuối cùng
              </h2>
              <p className="text-[10px] text-muted">
                Thao tác được thêm vào sổ kiểm duyệt bất biến và thông báo cho bộ phận quan hệ tác
                giả trong bản mẫu giao diện này.
              </p>
            </div>
            <Badge tone="green">Người xét duyệt: M. Rayne</Badge>
          </div>
          <div className="nh-grid-12 mt-5 grid gap-5 nh-layout-lg-4-8">
            <div className="rounded-3xl bg-elevated p-5">
              <strong className="text-xs text-orange">
                Tiêu chuẩn Chính sách #IP-04: Tri ân và Vi phạm
              </strong>
              <p className="mt-3 text-[10px] leading-5 text-muted">
                Sử dụng hợp lý và tri ân cho phép mô-típ chủ đề; chuỗi cụm từ nguyên văn vượt 50 từ
                cần tác giả giải trình.
              </p>
              <div className="mt-4 border-t border-line pt-4 text-[10px] leading-5">
                <p>
                  • <strong>Bác bỏ:</strong> thiết lập hoặc quy ước thể loại tiêu chuẩn.
                </p>
                <p>
                  • <strong>Làm rõ:</strong> cách diễn đạt phái sinh nhưng tác giả có thể đồng sở hữu.
                </p>
                <p>
                  • <strong>Chuyển cấp:</strong> xác minh có kiếm tiền nhưng không có giấy phép.
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold">
                Kết luận nội bộ và bản nháp thông báo cho tác giả
              </label>
              <textarea
                value={findings}
                onChange={event => setFindings(event.target.value)}
                className="mt-2 min-h-36 w-full rounded-3xl border border-line bg-elevated p-4 text-sm leading-6 outline-none focus:border-brand"
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Toggle
                  checked={softHold}
                  onChange={setSoftHold}
                  label="Tạm giữ chương"
                />
                <Toggle
                  checked={notify}
                  onChange={setNotify}
                  label="Yêu cầu làm rõ thế giới truyện"
                />
              </div>
            </div>
          </div>
          {recorded && (
            <Badge tone="green" className="mt-5">
              Đã ghi nhận: {recorded}
            </Badge>
          )}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={() => setAction('Bác bỏ cảnh báo')} variant="secondary">
              <X size={14} />
              Bác bỏ cảnh báo
            </Button>
            <Button onClick={() => setAction('Đính kèm vào bản xét duyệt')} variant="secondary">
              <Link2 size={14} />
              Đính kèm #MS-88402
            </Button>
            <Button
              onClick={() => setAction('Chuyển Bộ phận Pháp lý Bản quyền')}
              className="border-rose bg-rose"
            >
              <Scale size={14} />
              Chuyển bộ phận pháp lý
            </Button>
            <Button onClick={() => setAction('Yêu cầu tác giả giải trình và cung cấp bằng chứng')}>
              <ClipboardCheck size={14} />
              Yêu cầu tác giả giải trình
            </Button>
          </div>
        </Card>
        <Modal
          open={Boolean(action)}
          title="Xác nhận kết luận tương đồng"
          onClose={() => setAction(null)}
        >
          <div className="rounded-2xl bg-elevated p-4">
            <strong>{action}</strong>
            <p className="mt-2 text-xs leading-5 text-muted">
              Điểm rủi ro, bằng chứng được chọn và kết luận của kiểm duyệt viên sẽ được đưa vào hồ
              sơ kiểm tra cục bộ.
            </p>
          </div>
          <textarea
            defaultValue={findings}
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAction(null)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setRecorded(action)
                setAction(null)
              }}
            >
              <ShieldCheck size={14} />
              Ghi nhận kết luận
            </Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}

function ComparisonPanel({ label, title, meta, tone, text }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-line bg-elevated p-5">
        <Badge tone={tone}>{label}</Badge>
        <h2 className="mt-3 text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-[10px] text-muted">{meta}</p>
      </div>
      <div className="p-5">
        <p className="text-sm leading-7 text-muted">
          The mountain pass opened into a valley choked by grey mists. Keir gripped the hilt of his
          father&apos;s rusted shortsword, watching the crown of ironwood trees shudder against the
          incoming gale.
        </p>
        <div
          className={`my-5 rounded-3xl border p-4 ${tone === 'orange' ? 'border-orange/50 bg-orange/10' : 'border-brand/50 bg-brand/10'}`}
        >
          <div className="flex justify-between text-[9px]">
            <strong className={tone === 'orange' ? 'text-orange' : 'text-brand'}>
              {tone === 'orange' ? 'ĐOẠN BỊ CẢNH BÁO' : 'NGUỒN GỐC CHÍNH THỨC'}
            </strong>
            <span>Dòng 42–48</span>
          </div>
          <p className="mt-3 text-sm leading-7">
            <mark className={`${tone === 'orange' ? 'bg-orange/30' : 'bg-brand/20'} text-ink`}>
              {text}
            </mark>
          </p>
        </div>
        <p className="text-sm leading-7 text-muted">
          The traveler took a steadying breath and continued toward the sanctuary, unaware that the
          oldest oath had already begun to wake.
        </p>
      </div>
    </Card>
  )
}
function Diagnostic({ title, children }) {
  return (
    <div className="rounded-3xl bg-elevated p-4">
      <strong className="text-xs">{title}</strong>
      <p className="mt-2 text-[10px] leading-5 text-muted">{children}</p>
    </div>
  )
}
function Toggle({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-left text-[10px]"
    >
      <span
        className={`grid size-5 shrink-0 place-items-center rounded-full border ${checked ? 'border-brand bg-brand text-white' : 'border-line'}`}
      >
        {checked && <Check size={11} />}
      </span>
      {label}
    </button>
  )
}
