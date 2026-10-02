import { useState } from 'react'
import {
  ArrowLeft,
  BarChart3,
  BookCheck,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  LockKeyhole,
  Send,
  ShieldCheck,
  Tags,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'

const checklist = [
  [
    'Thông tin bắt buộc',
    'Đã hoàn thiện tiêu đề, tóm tắt và ảnh bìa.',
    'Bìa: 1600×2400 độ phân giải cao · Tóm tắt: 180 từ',
    FileCheck2,
  ],
  [
    'Số chương và số từ tối thiểu',
    'Đã chuẩn bị 5 chương, tổng cộng 14.200 từ.',
    'Chương 13–17 · Trung bình 2.840 từ/chương',
    BookCheck,
  ],
  [
    'Phân loại nội dung và cảnh báo nhạy cảm',
    'Được gắn PG-13 do có hiểm nguy kỳ ảo nhẹ.',
    'PG-13: Hiểm nguy / Hành động · Không phát hiện bạo lực trực diện',
    Tags,
  ],
  [
    'Thỏa thuận tác phẩm gốc và quyền tác giả',
    'Đã xác nhận sở hữu bản quyền tác phẩm gốc.',
    'Chữ ký điện tử trong hồ sơ đã được xác minh',
    ShieldCheck,
  ],
  [
    'Kiểm tra định dạng và kiểu chữ',
    'Định dạng Poppins hợp lệ, không có liên kết media hỏng.',
    'Thụt đầu dòng: Hợp lệ · 0 thẻ mồ côi',
    Eye,
  ],
]

export function SubmissionReviewPage() {
  const [verified, setVerified] = useState(checklist.map(() => true))
  const [notes, setNotes] = useState(
    'Tập II tiếp nối thế giới truyện từ Tập I. Chương 16 có một số cảnh chiến đấu thần thoại ngắn, phù hợp hướng dẫn PG-13.',
  )
  const [detail, setDetail] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const passed = verified.filter(Boolean).length
  const percent = Math.round((passed / checklist.length) * 100)
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <p className="text-xs text-muted">
          Studio tác giả / Tiểu thuyết / The Silent Forest /{' '}
          <strong className="text-brand">Kiểm duyệt và gửi duyệt</strong>
        </p>
        <Card className="mt-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid h-28 w-20 shrink-0 place-items-center rounded-xl bg-[#31584c] text-center text-xs font-bold text-white">
              THE
              <br />
              SILENT
              <br />
              FOREST
            </div>
            <div className="min-w-0 flex-1">
              <Badge tone="green">Tập bản thảo · ID: #MS-88402</Badge>
              <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
                Gửi bản thảo để kiểm duyệt và xuất bản
              </h1>
              <p className="mt-2 text-sm">
                Truyện: <strong>The Silent Forest — Tập II: Roots of Eldoria</strong>
              </p>
            </div>
            <div className="nh-grid-12 grid nh-cols-2 rounded-2xl border border-line bg-elevated p-4 text-center text-xs">
              <div className="border-r border-line px-4">
                <span className="text-muted">Tổng số chương</span>
                <strong className="block text-base">5 chương mới</strong>
              </div>
              <div className="px-4">
                <span className="text-muted">Số từ</span>
                <strong className="block text-base text-brand">14.200 từ</strong>
              </div>
            </div>
          </div>
        </Card>
        <div className="mt-5 flex flex-col gap-4 border border-line bg-elevated p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 place-items-center rounded-full bg-brand text-white">
            <CheckCircle2 />
          </span>
          <div>
            <strong>
              {submitted ? 'Đã gửi vào hàng đợi kiểm duyệt' : 'Đang kiểm tra bản nháp'}
            </strong>
            <p className="text-xs text-muted">
              {submitted
                ? 'Bản thảo đang chờ biên tập, thời gian dự kiến 12–24 giờ.'
                : `Sẵn sàng gửi (${percent}% danh sách kiểm tra đạt yêu cầu)`}
            </p>
          </div>
          <div className="sm:ml-auto sm:w-56">
            <div className="h-2 rounded-full bg-surface">
              <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-brand">{percent}%</p>
          </div>
        </div>
        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="space-y-6">
            <Card>
              <div className="flex items-center justify-between border-b border-line pb-5">
                <div>
                  <h2 className="text-xl font-semibold">Danh sách kiểm tra trước khi gửi</h2>
                  <p className="mt-1 text-xs text-muted">
                    Các tiêu chí xác thực bắt buộc theo Tiêu chuẩn Chất lượng NovelHub
                  </p>
                </div>
                <Badge>{passed} / 5 đã xác minh</Badge>
              </div>
              <div className="mt-5 space-y-3">
                {checklist.map(([title, description, meta, Icon], index) => (
                  <div
                    key={title}
                    className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-start"
                  >
                    <button
                      onClick={() =>
                        setVerified(current =>
                          current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
                        )
                      }
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${verified[index] ? 'bg-brand/15 text-brand' : 'bg-rose/15 text-rose'}`}
                    >
                      {verified[index] ? <Check size={15} /> : <span>!</span>}
                    </button>
                    <Icon size={18} className="mt-1 shrink-0 text-brand" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">
                        {index + 1}. {title}
                      </h3>
                      <p className="mt-1 text-xs text-muted">{description}</p>
                      <Badge className="mt-2">{meta}</Badge>
                    </div>
                    <button
                      onClick={() => setDetail(index)}
                      className="text-xs font-medium text-brand"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Ghi chú của tác giả cho kiểm duyệt viên</h2>
                  <p className="mt-2 text-xs text-muted">
                    Thêm thông tin về tính nhất quán thế giới truyện, nội dung nhạy cảm hoặc bối
                    cảnh để biên tập viên đánh giá nhanh hơn.
                  </p>
                </div>
                <span className="text-[10px] text-muted">Thông tin không bắt buộc</span>
              </div>
              <textarea
                value={notes}
                maxLength={500}
                onChange={event => setNotes(event.target.value)}
                className="mt-5 min-h-36 w-full rounded-2xl border border-line bg-elevated p-4 text-sm leading-6 outline-none focus:border-brand"
              />
              <p className="mt-2 text-right text-[10px] text-muted">
                {notes.length} / 500 ký tự
              </p>
              <p className="mt-3 flex items-center gap-2 text-[10px] text-muted">
                <LockKeyhole size={13} className="text-brand" />
                Ghi chú này chỉ hiển thị cho bạn và bộ phận biên tập kiểm duyệt.
              </p>
            </Card>
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="grid size-10 place-items-center rounded-full bg-orange/15 text-orange">
                <Clock3 />
              </span>
              <div>
                <strong className="text-sm">Có thể gửi ngay</strong>
                <p className="text-xs text-muted">
                  Bản thảo sẽ được phân công trong vòng 10 phút sau khi gửi.
                </p>
              </div>
          <Button onClick={() => window.alert('Đã mở bản xem trước nội dung gửi duyệt (bản mẫu).')} variant="secondary" className="sm:ml-auto">
                <ArrowLeft size={14} />
                Lưu và quay lại trình soạn thảo
              </Button>
              <Button disabled={passed < 5 || submitted} onClick={() => setConfirmOpen(true)}>
                <Send size={15} />
                {submitted ? 'Đã gửi' : 'Gửi xét duyệt'}
              </Button>
            </Card>
          </div>
          <aside className="space-y-5 xl:sticky xl:top-24">
            <Card>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                Quy trình xuất bản và thời gian xét duyệt <BarChart3 className="text-brand" size={18} />
              </h2>
              <div className="mt-5 space-y-0">
                <PipelineStep
                  number="✓"
                  title="Kiểm tra trước khi gửi"
                  note="Hệ thống kiểm tra cú pháp, tính toàn vẹn chương và thông tin."
                  active
                />
                <PipelineStep
                  number="2"
                  title="Hàng đợi kiểm duyệt"
                  note="Được phân công cho Đội Biên tập Cấp cao để kiểm tra tuân thủ nội dung."
                />
                <PipelineStep
                  number="3"
                  title="Phê duyệt và phát hành"
                  note="Xuất bản ngay vào danh mục độc giả và gửi thông báo tới người đăng ký."
                  muted
                />
              </div>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Lịch sử xét duyệt gần đây</h2>
              <p className="text-xs text-muted">Nhật ký trước đây của bộ tiểu thuyết này</p>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between">
                  <strong className="text-xs">Tập I (Chương 1–12)</strong>
                  <Badge tone="green">Đã phê duyệt</Badge>
                </div>
                <p className="mt-2 text-[10px] text-muted">
                  Được Bộ phận Kiểm duyệt #4 xét duyệt ngày 14/10/2026
                </p>
                <p className="mt-3 rounded-xl bg-surface p-3 text-xs italic leading-5">
                  “Văn phong sạch, thế giới cuốn hút. Thẻ phân loại chính xác. Sẵn sàng phân phối
                  cao cấp.”
                </p>
              </div>
            </Card>
            <Card className="text-center text-sm italic leading-6">
              “Truyện hay còn trở nên tốt hơn nhờ biên tập kỹ lưỡng. Đội ngũ xét duyệt luôn cố gắng
              giữ tiếng nói sáng tạo của bạn đồng thời bảo vệ độc giả.”
              <p className="mt-3 text-xs not-italic text-brand">— Tiêu chuẩn Biên tập NovelHub</p>
            </Card>
          </aside>
        </div>
        <Modal
          open={detail !== null}
          title={detail !== null ? checklist[detail][0] : ''}
          onClose={() => setDetail(null)}
        >
          <p className="text-sm leading-6 text-muted">{detail !== null && checklist[detail][1]}</p>
          <div className="mt-4 rounded-2xl bg-elevated p-4 text-sm">
            {detail !== null && checklist[detail][2]}
          </div>
          <Button onClick={() => setDetail(null)} className="mt-5 w-full">
            Đóng chi tiết
          </Button>
        </Modal>
        <Modal open={confirmOpen} title="Xác nhận gửi duyệt" onClose={() => setConfirmOpen(false)}>
          <p className="text-sm leading-6 text-muted">
            Bản mô phỏng giao diện này sẽ đưa bản thảo vào hàng đợi kiểm duyệt. Không có yêu cầu ra
            bên ngoài hoặc hoạt động xuất bản thật nào diễn ra.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setSubmitted(true)
                setConfirmOpen(false)
              }}
            >
              <Send size={15} />
              Xác nhận gửi bản mẫu
            </Button>
          </div>
        </Modal>
      </main>
    </AuthorLayout>
  )
}

function PipelineStep({ number, title, note, active, muted }) {
  return (
    <div className={`relative flex gap-3 pb-6 ${muted ? 'opacity-50' : ''}`}>
      <div className="absolute left-3 top-6 h-full w-px bg-line" />
      <span
        className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs ${active ? 'border-brand bg-brand text-white' : 'border-brand bg-surface text-brand'}`}
      >
        {number}
      </span>
      <div>
        <strong className="text-xs">{title}</strong>
        <p className="mt-1 text-[10px] leading-4 text-muted">{note}</p>
        {active && <p className="mt-2 text-[10px] text-brand">Trạng thái: Đạt và đã xác minh</p>}
      </div>
    </div>
  )
}
