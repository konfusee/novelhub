import { useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Gavel,
  Scale,
  ShieldAlert,
  Sparkles,
} from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'

const chapters = [
  ['Chương 13: Silver Passage', 'Sạch'],
  ['Chương 14: Echoes', 'Sạch'],
  ['Chương 15: The Threshold', 'Sạch'],
  ['Chương 16: Heart of Ironwood', '1 cảnh báo'],
  ['Chương 17: Afterlight', 'Đang chờ'],
]
const policyChecks = [
  'Đã xác minh quyền tác giả gốc',
  'Ảnh bìa đáp ứng chuẩn 1600×2400',
  'Phân loại PG-13 phù hợp mức bạo lực trong truyện',
  'Không có nội dung quảng cáo hoặc liên kết ngoài bị cấm',
  'Định dạng chương và phông Poppins không chân đạt chuẩn',
]
const prose = [
  'The canopy of the ancient Ironwood did not sway with the wind. It stood rigid, carved of petrified amber and obsidian vines that drank what little starlight escaped the northern haze. Kaelen tightened his wrist bindings, feeling the steady hum of the meridian sigil pulsing beneath his glove.',
  '“Three leagues north,” Sorsha murmured, not lifting her gaze from the cracked slate compass. Her breathing was measured, though the silver embroidery along her mantle had frayed during their descent through the weeping gorge. “If the crest holds, the inner ward will open before dawn. If it fails, we will be standing directly in their line of sight.”',
  'Neither of them spoke of the scouts they had left at the ford. The silence of the Great Weave was answer enough. Across serialized fantasy traditions, silence often preceded reckoning; Kaelen knew the lore better than any novice scribe from the outer ring.',
  'They crossed the frostline in silence. Beneath their soles, the crystalline foliage fractured with a tone like chiming porcelain. With every dozen paces, the ambient temperature dipped further, frosting the bronze edges of their scabbards until small sparks jumped between their cloaks.',
  '“Listen,” Sorsha halted, her gloved fingers resting on the pommel of her side-blade. “The ridge is vacant. The wardens shouldn’t have abandoned the southern overlook unless something broke the gate wards from inside.”',
  'A tremor shuddered through the peat. It was not the organic shudder of shifting earth, but the metallic crunch of iron roots shearing against subterranean rock.',
]

export function ContentReviewDetailPage() {
  const [activeChapter, setActiveChapter] = useState(3)
  const [reviewed, setReviewed] = useState(false)
  const [checks, setChecks] = useState(policyChecks.map(() => true))
  const [notes, setNotes] = useState(
    'Đã xác minh văn phong. Các cảnh hành động ở Chương 16 tuân thủ hướng dẫn kỳ ảo PG-13. Không có máu me trực diện. Thẻ chính xác và phù hợp để độc giả khám phá.',
  )
  const [decision, setDecision] = useState(null)
  const [completed, setCompleted] = useState('')
  return (
    <ModeratorLayout>
      <main className="page-moderator py-5">
        <div className="flex flex-col gap-4 border-b border-line pb-4 lg:flex-row lg:items-center">
          <button onClick={() => window.location.assign('/moderator/submissions')} className="flex items-center gap-2 text-xs text-brand">
            <ArrowLeft size={14} />
            Quay lại hàng đợi bản thảo
          </button>
          <div className="lg:border-l lg:border-line lg:pl-5">
            <p className="text-xs">
              Đang xét duyệt bản thảo <strong>#MS-88402</strong>
            </p>
            <p className="text-[10px] text-muted">
              Elena Vance · Tác giả đã xác minh · Gửi 18 giờ trước
            </p>
          </div>
          <Badge tone="orange" className="lg:ml-auto">
            SLA: còn 5 giờ 42 phút
          </Badge>
          <Button onClick={() => setDecision('Phê duyệt')} className="min-h-9 text-xs">
            Phê duyệt
          </Button>
          <Button
            onClick={() => setDecision('Yêu cầu chỉnh sửa')}
            variant="secondary"
            className="min-h-9 text-xs"
          >
            Yêu cầu chỉnh sửa
          </Button>
        </div>
        <div className="nh-grid-12 mt-5 grid items-start gap-5 nh-layout-xl-2-7-3">
          <aside className="space-y-4">
            <Card className="p-4">
              <div className="flex gap-3">
                <span className="grid h-24 w-16 place-items-center rounded-xl bg-brand text-center text-[10px] font-bold text-white">
                  THE
                  <br />
                  SILENT
                  <br />
                  FOREST
                </span>
                <div>
                  <Badge tone="orange">PG-13</Badge>
                  <h2 className="mt-2 text-xs font-semibold">The Silent Forest: Volume II</h2>
                  <p className="mt-1 text-[9px] text-muted">Kỳ ảo · 14.200 từ</p>
                </div>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-[10px] text-muted">
                Lô: 5 chương · Lô #4 / 6
              </p>
            </Card>
            <Card className="p-4">
              <h2 className="text-xs font-semibold">Các chương gửi duyệt</h2>
              <div className="mt-4 space-y-2">
                {chapters.map(([title, status], index) => (
                  <button
                    key={title}
                    onClick={() => setActiveChapter(index)}
                    className={`w-full rounded-xl p-3 text-left ${activeChapter === index ? 'bg-brand/10 text-brand' : 'hover:bg-elevated'}`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} />
                      <span className="truncate text-[10px]">{title}</span>
                      <Badge
                        tone={status === '1 cảnh báo' ? 'orange' : 'neutral'}
                        className="ml-auto px-2 py-0.5 text-[8px]"
                      >
                        {status}
                      </Badge>
                    </div>
                    {activeChapter === index && (
                      <p className="mt-1 pl-5 text-[8px] text-muted">Đang mở trong vùng xét duyệt</p>
                    )}
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <h2 className="text-xs font-semibold">Thông số bản gửi</h2>
              <div className="mt-3 space-y-2 text-[9px] text-muted">
                <p>Độc giả mục tiêu: Thanh thiếu niên (14+)</p>
                <p>Tỷ lệ bìa: 1600 × 2400</p>
                <p>Khớp bản quyền: 100%</p>
                <p>Kiếm tiền: Khóa bằng xu (từ Chương 15)</p>
              </div>
            </Card>
          </aside>
          <article className="min-w-0 rounded-3xl border border-line bg-reader p-5 sm:p-8">
            <p className="text-[9px] uppercase tracking-[.15em] text-muted">
              The Silent Forest · Volume II
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Chương 16: Heart of the Ironwood
            </h1>
            <p className="mt-2 text-[10px] text-muted">
              Số từ: 2.150 · Thời gian đọc: ~9 phút · Phông: Poppins 17px/31px
            </p>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
              <strong className="flex items-center gap-2 text-xs">
                <FileText size={14} className="text-brand" />
                Ghi chú gửi duyệt của tác giả (Elena Vance):
              </strong>
              <p className="mt-2 text-[10px] leading-5 text-muted">
                Tập II tiếp nối thế giới truyện từ Tập I. Chương 16 có cảnh chiến đấu thần thoại
                tuân thủ tiêu chuẩn PG-13.
              </p>
            </div>
            <div className="mt-7 space-y-6">
              {prose.map((paragraph, index) =>
                index === 5 ? (
                  <FlaggedText
                    key={paragraph}
                    reviewed={reviewed}
                    onReview={() => setReviewed(true)}
                  >
                    {paragraph}
                  </FlaggedText>
                ) : (
                  <p key={paragraph} className="text-sm leading-8 sm:text-base sm:leading-9">
                    {paragraph}
                  </p>
                ),
              )}
            </div>
            <div className="mt-8 flex flex-col justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-[10px] text-brand">
                <CheckCircle2 size={14} />
                Dấu xác minh cuối Chương 16 · Đã hiển thị 2.150 từ
              </span>
              <div className="flex gap-2">
                <Button onClick={() => setActiveChapter(value => Math.max(0, value - 1))} variant="secondary" className="min-h-8 px-3 py-1 text-[10px]">
                  <ChevronLeft size={12} />
                  Trước
                </Button>
                <Button onClick={() => setActiveChapter(value => Math.min(chapters.length - 1, value + 1))} variant="secondary" className="min-h-8 px-3 py-1 text-[10px]">
                  Sau
                  <ChevronRight size={12} />
                </Button>
              </div>
            </div>
          </article>
          <aside className="space-y-4 xl:sticky xl:top-24">
            <Card>
              <div className="flex justify-between">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Sparkles size={16} className="text-purple" />
                  Chỉ số và tín hiệu AI
                </h2>
                <Badge tone="purple">Bộ máy v4.2</Badge>
              </div>
              <p className="mt-2 text-[9px] text-muted">
                Tín hiệu chỉ là dữ liệu hỗ trợ, không phải phán quyết tự động.
              </p>
              <div className="nh-grid-12 mt-4 grid nh-cols-2 gap-2">
                <Signal label="Điểm an toàn nội dung" value="98,2%" note="Nội dung sạch" />
                <Signal
                  label="Chỉ số bạo lực/máu me"
                  value="14%"
                  note="Vùng an toàn PG-13"
                  tone="orange"
                />
                <Signal label="Chỉ số đạo văn" value="1,2%" note="Văn phong gốc 100%" />
                <Signal
                  label="Mức phù hợp nhịp độ"
                  value="94%"
                  note="Mạch truyện kỳ ảo dài kỳ"
                  tone="purple"
                />
              </div>
            </Card>
            <Card>
              <div className="flex justify-between">
                <h2 className="font-semibold">Danh sách kiểm tra chính sách biên tập</h2>
                <Badge tone="green">{checks.filter(Boolean).length} / 5</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {policyChecks.map((label, index) => (
                  <button
                    key={label}
                    onClick={() =>
                      setChecks(current =>
                        current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
                      )
                    }
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${checks[index] ? 'bg-brand text-white' : 'bg-rose/20 text-rose'}`}
                    >
                      {checks[index] ? <Check size={12} /> : <span>!</span>}
                    </span>
                    <span className="text-[10px] leading-4">{label}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Ghi chú và lý do của kiểm duyệt viên</h2>
              <textarea
                value={notes}
                maxLength={500}
                onChange={event => setNotes(event.target.value)}
                className="mt-3 min-h-28 w-full rounded-2xl border border-line bg-elevated p-3 text-xs leading-5 outline-none"
              />
              <p className="mt-2 text-right text-[9px] text-muted">
                {notes.length} / 500 ký tự
              </p>
            </Card>
            <Card>
              <p className="text-[9px] uppercase tracking-[.15em] text-muted">Quyết định cuối cùng</p>
              {completed && (
                <Badge tone="green" className="mt-3 w-full justify-center">
                  Đã ghi nhận quyết định: {completed}
                </Badge>
              )}
              <Button onClick={() => setDecision('Phê duyệt và xuất bản')} className="mt-3 w-full">
                <CheckCircle2 size={15} />
                Phê duyệt và xuất bản
              </Button>
              <Button
                onClick={() => setDecision('Yêu cầu tác giả chỉnh sửa')}
                variant="secondary"
                className="mt-2 w-full text-orange"
              >
                Yêu cầu tác giả chỉnh sửa
              </Button>
              <div className="nh-grid-12 mt-2 grid nh-cols-2 gap-2">
                <Button
                  onClick={() => setDecision('Chuyển bộ phận pháp lý')}
                  variant="secondary"
                  className="px-2 text-[10px]"
                >
                  <Scale size={13} />
                  Chuyển cấp
                </Button>
                <Button
                  onClick={() => setDecision('Từ chối bản thảo')}
                  variant="secondary"
                  className="px-2 text-[10px] text-rose"
                >
                  <Gavel size={13} />
                  Từ chối
                </Button>
              </div>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(decision)}
          title="Ghi nhận quyết định kiểm duyệt"
          onClose={() => setDecision(null)}
        >
          <div className="flex gap-3 rounded-2xl bg-elevated p-4">
            <ShieldAlert className="shrink-0 text-orange" />
            <div>
              <strong className="text-sm">{decision}</strong>
              <p className="mt-1 text-xs leading-5 text-muted">
                Thao tác mẫu này chỉ thêm quyết định vào nhật ký kiểm tra cục bộ.
              </p>
            </div>
          </div>
          <textarea
            className="mt-4 min-h-24 w-full rounded-2xl border border-line bg-surface p-3 text-sm outline-none"
            placeholder="Lý do đưa ra quyết định..."
            defaultValue={notes}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDecision(null)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setCompleted(decision)
                setDecision(null)
              }}
            >
              Xác nhận quyết định
            </Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}

function FlaggedText({ children, reviewed, onReview }) {
  return (
    <div className="rounded-2xl border border-orange bg-orange/10 p-5">
      <div className="flex flex-wrap items-center gap-2 text-[9px] text-orange">
        <AlertTriangle size={13} />
        Kiểm tra thẻ cảnh báo: Chiến đấu thần thoại và thương tích
        <Badge tone="orange">Phù hợp tiêu chí PG-13</Badge>
      </div>
      <p className="mt-4 text-sm leading-8 sm:text-base sm:leading-9">{children}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-orange/30 pt-3 text-[9px] text-muted">
        <span>Chỉ số xét duyệt: Cường độ va chạm 14% · Giao chiến phòng vệ</span>
        <button onClick={onReview} className="font-semibold text-brand">
          {reviewed ? 'Đã xem xét ✓' : 'Đánh dấu đã xem xét'}
        </button>
      </div>
    </div>
  )
}
function Signal({ label, value, note, tone = 'green' }) {
  return (
    <div className="rounded-xl bg-elevated p-3">
      <span className="text-[9px] text-muted">{label}</span>
      <strong
        className={`mt-2 block text-lg ${tone === 'orange' ? 'text-orange' : tone === 'purple' ? 'text-purple' : 'text-brand'}`}
      >
        {value}
      </strong>
      <span className="text-[8px] text-muted">{note}</span>
    </div>
  )
}
