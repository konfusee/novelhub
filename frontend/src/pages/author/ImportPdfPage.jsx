import { useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  GitMerge,
  Import,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card } from '../../components/ui'

const initialChapters = [
  ['Chapter 1: The Harbor Gate', 'tr. 4–18 · 3.400 từ'],
  ["Chapter 2: The Alchemist's Lantern", 'tr. 19–35 · 4.120 từ'],
  ['Chapter 3: Beneath the Obsidian Arch', 'tr. 36–51 · 3.890 từ'],
  ['Chapter 4: The Whispering Keel', 'tr. 52–68 · 4.450 từ'],
  ['Chapter 5: Songs of the Low Tide', 'tr. 69–84 · 4.030 từ'],
]
const steps = [
  'Tải PDF lên',
  'Nhận diện cấu trúc và chương',
  'Kiểm tra cách tách chương',
  'Nhập thành bản nháp',
]

export function ImportPdfPage() {
  const fileRef = useRef(null)
  const [step, setStep] = useState(2)
  const [fileName, setFileName] = useState('Chronicles of the Sunken Spire.pdf')
  const [chapters, setChapters] = useState(
    initialChapters.map(([title, meta], index) => ({ id: index + 1, title, meta, selected: true })),
  )
  const [active, setActive] = useState(1)
  const [destination, setDestination] = useState('new')
  const [splitView, setSplitView] = useState(true)
  const [imported, setImported] = useState(false)
  const selected = chapters.filter(chapter => chapter.selected).length
  const chooseFile = event => {
    const file = event.target.files?.[0]
    if (file) {
      setFileName(file.name)
      setStep(2)
      setImported(false)
    }
  }
  const addSplit = () =>
    setChapters(current => [
      ...current,
      {
        id: Date.now(),
        title: `Chương ${current.length + 1}: Phần chưa đặt tên`,
        meta: 'Tách thủ công · Đang chờ phân tích',
        selected: true,
      },
    ])
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <Card className="rounded-2xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold">
                <ArrowLeft size={20} />
                Nhập bản thảo từ PDF
              </h1>
              <p className="mt-2 text-sm text-muted">
                Chuyển PDF đã định dạng thành các chương số có cấu trúc, có thể chỉnh sửa và sẵn
                sàng đăng dài kỳ.
              </p>
            </div>
            <Badge className="gap-2 px-4 py-2">
              <ShieldCheck size={15} className="text-brand" />
              Bản thảo chỉ được lưu cục bộ trong bản xem trước này
            </Badge>
          </div>
          <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 xl:grid-cols-4">
            {steps.map((label, index) => {
              const number = index + 1
              return (
                <button
                  key={label}
                  onClick={() => setStep(number)}
                  className="flex items-center gap-3 text-left"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full border ${number < step ? 'border-brand bg-brand/15 text-brand' : number === step ? 'border-brand bg-brand text-white' : 'border-line text-muted'}`}
                  >
                    {number < step ? <Check size={16} /> : number}
                  </span>
                  <span>
                    <small className="block text-[10px] text-muted">
                      Bước {number}
                      {number === step ? ' (Đang thực hiện)' : ''}
                    </small>
                    <strong className={`text-xs ${number === step ? 'text-brand' : ''}`}>
                      {label}
                    </strong>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-5 h-1.5 rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${step * 25}%` }}
            />
          </div>
        </Card>
        {step === 1 ? (
          <UploadStage fileRef={fileRef} chooseFile={chooseFile} />
        ) : (
          <>
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
              <section>
                <Card>
                  <div className="flex flex-col gap-3 bg-elevated p-4 sm:flex-row sm:items-center">
                    <span className="grid size-12 place-items-center rounded-xl bg-brand/15 text-brand">
                      <FileText />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{fileName}</strong>
                      <p className="text-[11px] text-muted">
                        184 trang · 62.400 từ · Chất lượng OCR: 99,4%
                      </p>
                    </div>
                    <input
                      ref={fileRef}
                      onChange={chooseFile}
                      className="hidden"
                      type="file"
                      accept="application/pdf"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => fileRef.current?.click()}
                      className="min-h-9 px-3 py-1 text-xs"
                    >
                      <RefreshCw size={14} />
                      Phân tích lại tệp
                    </Button>
                  </div>
                  <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Chương và cấu trúc đã nhận diện</h2>
                      <p className="text-xs text-muted">
                        Đã nhận diện 12 chương bằng tiêu đề và bộ phân tích số La Mã.
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() =>
                          setChapters(current => current.map(item => ({ ...item, selected: true })))
                        }
                        className="text-brand"
                      >
                        Chọn tất cả (12)
                      </button>
                      <span className="text-line">|</span>
                      <button
                        onClick={() =>
                          setChapters(current =>
                            current.map(item => ({ ...item, selected: false })),
                          )
                        }
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  </div>
                  <div className="mt-5 max-h-[690px] space-y-3 overflow-y-auto pr-1">
                    {chapters.map(chapter => (
                      <ChapterDetection
                        key={chapter.id}
                        chapter={chapter}
                        active={active === chapter.id}
                        onActive={() => setActive(chapter.id)}
                        onToggle={() =>
                          setChapters(current =>
                            current.map(item =>
                              item.id === chapter.id ? { ...item, selected: !item.selected } : item,
                            ),
                          )
                        }
                        onTitle={title =>
                          setChapters(current =>
                            current.map(item =>
                              item.id === chapter.id ? { ...item, title } : item,
                            ),
                          )
                        }
                      />
                    ))}
                  </div>
                  <button
                    onClick={addSplit}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand p-4 text-xs font-semibold text-brand"
                  >
                    <Plus size={15} />
                    Thêm dấu tách chương thủ công
                  </button>
                </Card>
              </section>
              <ExtractionInspector
                splitView={splitView}
                setSplitView={setSplitView}
                title={chapters.find(item => item.id === active)?.title || 'Chưa chọn chương'}
              />
            </div>
            <Card className="mt-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <h2 className="text-xl font-semibold">Nơi lưu nội dung</h2>
                  <p className="mt-1 text-xs text-muted">
                    Chọn cách đưa các chương đã phân tích vào danh mục NovelHub của bạn.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:w-3/5">
                  {[
                    ['new', 'Tạo truyện mới', 'Chronicles of the Sunken Spire (Sách mới)'],
                    ['existing', 'Thêm vào truyện hiện có', 'The Silent Forest (Truyện dài kỳ)'],
                  ].map(([value, label, note]) => (
                    <button
                      key={value}
                      onClick={() => setDestination(value)}
                      className={`rounded-2xl border p-4 text-left ${destination === value ? 'border-brand bg-brand/10' : 'border-line'}`}
                    >
                      <strong className="text-xs">{label}</strong>
                      <p className="mt-1 text-[11px] text-muted">
                        {destination === value ? '●' : '○'} {note}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={14} />
                Quay lại tải lên
              </Button>
              <Button variant="secondary" onClick={() => setStep(2)}>
                <RefreshCw size={14} />
                Phân tích lại tài liệu
              </Button>
              <span className="ml-auto text-xs text-muted">
                Đã chọn {selected} chương (62.400 từ)
              </span>
              <Button
                disabled={!selected}
                onClick={() => {
                  setImported(true)
                  setStep(4)
                }}
              >
                <Import size={15} />
                {imported ? 'Đã nhập vào bản nháp' : `Nhập ${selected} chương thành bản nháp`}
              </Button>
            </div>
          </>
        )}
      </main>
    </AuthorLayout>
  )
}

function UploadStage({ fileRef, chooseFile }) {
  return (
    <Card className="mt-6 grid min-h-[430px] place-items-center border-dashed text-center">
      <div>
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-brand/15 text-brand">
          <Upload size={34} />
        </span>
        <h2 className="mt-5 text-2xl font-semibold">Thả tệp PDF bản thảo vào đây</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Tải lên tệp PDF tối đa 50 MB. NovelHub sẽ nhận diện tiêu đề, điểm ngắt cảnh, định dạng
          đoạn văn và ranh giới chương.
        </p>
        <input
          ref={fileRef}
          onChange={chooseFile}
          className="hidden"
          type="file"
          accept="application/pdf"
        />
        <Button onClick={() => fileRef.current?.click()} className="mt-5">
          <Upload size={16} />
          Chọn tệp PDF
        </Button>
        <p className="mt-4 text-[10px] text-muted">
          Chỉ xem trước cục bộ trên giao diện · không truyền tệp ra ngoài
        </p>
      </div>
    </Card>
  )
}
function ChapterDetection({ chapter, active, onActive, onToggle, onTitle }) {
  return (
    <div
      onClick={onActive}
      className={`rounded-2xl border p-4 ${active ? 'border-brand bg-brand/5' : 'border-line'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={event => {
            event.stopPropagation()
            onToggle()
          }}
          className={`grid size-5 place-items-center rounded-full border ${chapter.selected ? 'border-brand bg-brand text-white' : 'border-line'}`}
        >
          {chapter.selected && <Check size={12} />}
        </button>
        <strong className="text-[10px] uppercase tracking-[.14em] text-brand">
          Chương {String(chapter.id).padStart(2, '0')} · Tiêu đề 1
        </strong>
        <Badge className="ml-auto">{chapter.meta}</Badge>
      </div>
      <input
        value={chapter.title}
        onChange={event => onTitle(event.target.value)}
        className="mt-3 w-full rounded-xl border border-line bg-elevated px-3 py-2 text-sm outline-none focus:border-brand"
      />
      <div className="mt-3 flex justify-end gap-4 text-[10px]">
        <button onClick={() => window.alert('Đã thêm điểm tách (bản mẫu).')} className="flex items-center gap-1">
          <Scissors size={12} />
          Tách tại trang
        </button>
        <button onClick={() => window.alert('Đã gộp chương với phần tiếp theo (bản mẫu).')} className="flex items-center gap-1">
          <GitMerge size={12} />
          Gộp với phần dưới
        </button>
      </div>
    </div>
  )
}
function ExtractionInspector({ splitView, setSplitView, title }) {
  return (
    <Card className="xl:sticky xl:top-24">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h2 className="text-xl font-semibold">Kiểm tra nội dung trích xuất</h2>
          <p className="text-xs text-muted">PDF gốc và Markdown sạch đã trích xuất</p>
        </div>
        <div className="rounded-xl border border-line p-1">
          <button
            onClick={() => setSplitView(true)}
            className={`rounded-lg px-3 py-2 text-[10px] ${splitView ? 'bg-elevated text-brand' : ''}`}
          >
            Chế độ chia đôi
          </button>
          <button
            onClick={() => setSplitView(false)}
            className={`rounded-lg px-3 py-2 text-[10px] ${!splitView ? 'bg-elevated text-brand' : ''}`}
          >
            Chỉ Markdown
          </button>
        </div>
      </div>
      <div className={`mt-4 grid gap-3 ${splitView ? 'sm:grid-cols-2' : ''}`}>
        {splitView && (
          <div className="min-h-[520px] rounded-2xl border border-line bg-[#fffdf9] p-5 text-[#172033]">
            <p className="text-center text-[9px] uppercase tracking-[.18em] text-[#9ca3af]">
              Chronicles of the Sunken Spire
            </p>
            <h3 className="mt-12 border-y border-dashed border-brand py-4 text-center text-lg font-bold">
              CHAPTER I<br />
              THE HARBOR GATE
            </h3>
            <p className="mt-5 text-sm leading-7">
              The mist rolled across the brackish quay before sunrise, clinging to the
              salt-encrusted timbers of the northern breakwater. By the time Kael arrived with his
              copper lantern, the tide had already begun its retreat.
            </p>
          </div>
        )}
        <div className="min-h-[520px] rounded-2xl border border-line bg-elevated p-5">
          <div className="flex items-center justify-between text-[10px] text-brand">
            <span>Markdown Poppins đã trích xuất</span>
            <span>Tự động định dạng</span>
          </div>
          <Badge tone="green" className="mt-5">
            ĐÃ NHẬN DIỆN THẺ H1
          </Badge>
          <h3 className="mt-3 text-xl font-semibold text-brand">{title}</h3>
          <Badge className="mt-5">ĐOẠN 01</Badge>
          <p className="mt-3 text-sm leading-7">
            The mist rolled across the brackish quay before sunrise, clinging to the salt-encrusted
            timbers of the northern breakwater. By the time Kael arrived with his copper lantern,
            the tide had already begun its retreat, exposing the green slick of drowned masonry.
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-brand/10 p-4 text-xs">
        <p className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-brand" />
          Loại bỏ đầu trang lặp lại và số trang
        </p>
        <p className="mt-2 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-brand" />
          Giữ nguyên dấu ngắt cảnh của tác giả (* * *)
        </p>
      </div>
    </Card>
  )
}
