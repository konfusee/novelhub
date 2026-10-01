import { useMemo, useState } from 'react'
import {
  AlignLeft,
  AtSign,
  Bold,
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  Heading2,
  Heading3,
  Image,
  Italic,
  ListTree,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Quote,
  Save,
  Send,
  Sparkles,
  Underline,
} from 'lucide-react'
import { AuthorLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'

const initialText = `The mist clung to the forest floor like cold wool, muffling the sound of Kaelen’s boots against the moss-encrusted roots. Overhead, the Ironwood canopy arched into an unbroken cathedral of black bark and silver veins, filtering the late afternoon light into razor-thin shafts of emerald dust. He reached into his coat, his fingertips brushing against the cool, etched brass of the astrolabe. Its inner dials ticked with an irregular, organic rhythm—a cadence that matched the pulse of the ancient wood itself.

“You’re walking too fast,” Vrena murmured from behind him, her voice low enough to stay beneath the hum of the canopy spirits. She held her shortbow slack at her hip, her gaze tracking the twisting branches forty cubits up. “The wood doesn’t like to be hurried, Kaelen. Especially not now. Not when the sap has started to run blue.”

*     *     *

Kaelen halted before the clearing. Here, at the geographic fulcrum of the grove, stood the Mother Oak. Her trunk was broader than five galleons moored abreast, scarred with ancient carvings from civilizations that predated the Fall. Deep within the hollow formed by two converging roots, a pool of memory-clear water reflected stars that did not belong to the daylight sky above them.`

const chapterGroups = [
  {
    act: 'ACT I: ROOTS',
    count: 12,
    chapters: ['Ch. 1: The Whispering Grove', 'Ch. 2: Silver Sap'],
  },
  {
    act: 'ACT II: THE WHISPERING CANOPY',
    count: 4,
    chapters: ['Ch. 14: Elder Roots', 'Ch. 15: The Silent Forest', 'Ch. 16: Heart of the Ironwood'],
  },
]
const utilityTabs = ['Outline', 'Notes', 'AI Assistant', 'Checklist']
const utilityLabels = { Outline: 'Dàn ý', Notes: 'Ghi chú', 'AI Assistant': 'Trợ lý AI', Checklist: 'Danh sách kiểm tra' }

export function ChapterEditorPage() {
  const [title, setTitle] = useState('Chapter 16: Heart of the Ironwood')
  const [body, setBody] = useState(initialText)
  const [saved, setSaved] = useState(true)
  const [utility, setUtility] = useState('AI Assistant')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [suggested, setSuggested] = useState(false)
  const words = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body])
  const updateBody = value => {
    setBody(value)
    setSaved(false)
  }
  return (
    <AuthorLayout>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-reader">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-3">
          <button
            onClick={() => setLeftOpen(value => !value)}
            className="rounded-xl border border-line p-2 xl:hidden"
            aria-label="Bật tắt dàn ý chương"
          >
            <PanelLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted">Tác phẩm của tôi / The Silent Forest</p>
            <strong className="block truncate text-sm text-brand">{title}</strong>
          </div>
          <Badge tone={saved ? 'green' : 'orange'}>
            {saved ? 'Đã lưu cục bộ' : 'Có thay đổi chưa lưu'}
          </Badge>
          <Badge>{words} từ</Badge>
          <Badge>Đọc trong 9 phút</Badge>
          <Button onClick={() => window.alert('Đã mở bản xem trước cho độc giả (bản mẫu).')} variant="secondary" className="min-h-9 px-3 py-1 text-xs">
            <Eye size={14} />
            Xem trước
          </Button>
          <Button onClick={() => setSubmitOpen(true)} className="min-h-9 px-3 py-1 text-xs">
            Gửi chương <Send size={14} />
          </Button>
          <button
            onClick={() => setRightOpen(value => !value)}
            className="rounded-xl border border-line p-2 xl:hidden"
            aria-label="Bật tắt trợ lý sáng tác"
          >
            <PanelRight size={18} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 xl:grid-cols-[250px_minmax(0,1fr)_330px]">
          <ChapterTree open={leftOpen} onClose={() => setLeftOpen(false)} />
          <main className="min-w-0">
            <Toolbar onSave={() => setSaved(true)} />
            <article className="mx-auto max-w-[820px] px-5 py-10 sm:px-10 lg:py-16">
              <input
                value={title}
                onChange={event => {
                  setTitle(event.target.value)
                  setSaved(false)
                }}
                className="w-full border-b border-transparent bg-transparent pb-3 text-2xl font-bold outline-none hover:border-line focus:border-brand sm:text-4xl"
              />
              <textarea
                value={body}
                onChange={event => updateBody(event.target.value)}
                className="mt-8 min-h-[720px] w-full resize-none bg-transparent text-base leading-8 text-ink outline-none sm:text-lg sm:leading-9"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-muted">
                <span className="flex items-center gap-2">
                  <Save size={14} />
                  {saved ? 'Bản nháp đã được lưu cục bộ và đồng bộ.' : 'Các thay đổi đang chờ lưu.'}
                </span>
                <button onClick={() => window.alert('Đã mở Chương 17 (bản mẫu).')} className="font-semibold text-brand">Tiếp tục đến Chương 17 →</button>
              </div>
            </article>
          </main>
          <WriterUtility
            open={rightOpen}
            onClose={() => setRightOpen(false)}
            tab={utility}
            setTab={setUtility}
            suggested={suggested}
            onSuggest={() => setSuggested(true)}
            onInsert={() => {
              updateBody(
                `${body}\n\nBefore the third ring could collapse, a sudden silence fell over the canopy—not even the wind dared disturb the surface.`,
              )
              setSuggested(false)
            }}
          />
        </div>
        <Modal open={submitOpen} title="Gửi chương" onClose={() => setSubmitOpen(false)}>
          <p className="text-sm leading-6 text-muted">
            Chương 16 sẽ được thêm vào hàng đợi biên tập. Đây là bản xem trước giao diện; không có
            dữ liệu nào được gửi đi.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSubmitOpen(false)}>
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              onClick={() => {
                setSubmitOpen(false)
                setSaved(true)
              }}
            >
              <Check size={15} />
              Gửi bản mẫu
            </Button>
          </div>
        </Modal>
      </div>
    </AuthorLayout>
  )
}

function ChapterTree({ open, onClose }) {
  return (
    <aside
      className={`${open ? 'fixed inset-y-0 left-0 z-40 w-72 shadow-2xl' : 'hidden'} overflow-y-auto border-r border-line bg-surface p-4 xl:static xl:block xl:w-auto xl:shadow-none`}
    >
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <strong className="text-sm">The Silent Forest</strong>
          <p className="text-[10px] text-muted">Kỳ ảo · Dài kỳ</p>
        </div>
        {open && (
          <button onClick={onClose} className="text-xs text-brand xl:hidden">
            Đóng
          </button>
        )}
      </div>
      <div className="mt-5 space-y-6">
        {chapterGroups.map(group => (
          <section key={group.act}>
            <div className="flex items-start gap-2">
              <ChevronDown size={14} className="mt-0.5 text-brand" />
              <strong className="flex-1 text-[11px] tracking-[.1em] text-brand">{group.act}</strong>
              <span className="text-[10px] text-muted">{group.count} CHƯƠNG</span>
            </div>
            <div className="mt-2 space-y-1 border-l border-line pl-3">
              {group.chapters.map(chapter => {
                const active = chapter.startsWith('Ch. 16')
                return (
                  <button
                    key={chapter}
                    onClick={() => window.alert(`Đã chọn ${chapter}.`)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs ${active ? 'bg-brand/10 font-semibold text-brand' : 'text-muted hover:bg-elevated'}`}
                  >
                    <span className="truncate">{chapter}</span>
                    <span
                      className={`ml-auto size-1.5 shrink-0 rounded-full ${active ? 'bg-orange' : 'bg-line'}`}
                    />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <Button onClick={() => window.alert('Đã thêm bản nháp chương mới (bản mẫu).')} variant="secondary" className="mt-8 w-full">
        <BookOpen size={15} />
        Thêm chương
      </Button>
    </aside>
  )
}

function Toolbar({ onSave }) {
  const tools = [
    [Bold, 'In đậm', 'bold'],
    [Italic, 'In nghiêng', 'italic'],
    [Underline, 'Gạch chân', 'underline'],
    [Heading2, 'Tiêu đề 2', 'formatBlock'],
    [Heading3, 'Tiêu đề 3', 'formatBlock'],
    [Quote, 'Trích dẫn', 'formatBlock'],
    [AlignLeft, 'Đường phân cách', 'insertHorizontalRule'],
    [MessageSquare, 'Hội thoại', 'formatBlock'],
    [AtSign, 'Đề cập', 'insertText'],
    [Image, 'Hình ảnh', 'insertImage'],
  ]
  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap gap-1">
        {tools.map(([Icon, label, command]) => (
          <button
            key={label}
            title={label}
            onClick={() => document.execCommand?.(command)}
            className="grid size-9 place-items-center rounded-xl hover:bg-elevated hover:text-brand"
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted">
        <span>Đoạn 18 · Dòng 142</span>
        <Button onClick={onSave} variant="secondary" className="min-h-8 px-3 py-1 text-[10px]">
          <Save size={13} />
          Lưu
        </Button>
      </div>
    </div>
  )
}

function WriterUtility({ open, onClose, tab, setTab, suggested, onSuggest, onInsert }) {
  return (
    <aside
      className={`${open ? 'fixed inset-y-0 right-0 z-40 block w-[min(92vw,360px)] shadow-2xl' : 'hidden'} overflow-y-auto border-l border-line bg-surface xl:static xl:block xl:w-auto xl:shadow-none`}
    >
      <div className="flex overflow-x-auto border-b border-line px-2 pt-2">
        {utilityTabs.map(item => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`shrink-0 border-b-2 px-3 py-3 text-xs ${tab === item ? 'border-purple font-semibold text-purple' : 'border-transparent text-muted'}`}
          >
            {utilityLabels[item]}
          </button>
        ))}
      </div>
      {open && (
        <button onClick={onClose} className="m-3 text-xs text-brand xl:hidden">
          Đóng bảng
        </button>
      )}
      <div className="space-y-5 p-5">
        {tab === 'AI Assistant' ? (
          <>
            <Card className="rounded-3xl bg-elevated p-4">
              <div className="flex items-center justify-between">
                <strong className="flex items-center gap-2 text-sm">
                  <ListTree size={16} className="text-purple" />
                  Phân tích nhịp độ
                </strong>
                <Badge tone="green">Cân bằng tốt</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">
                Hình ảnh cảm giác (62%) và hội thoại (38%) được cân bằng tốt. Sức căng của cảnh
                tăng đều về phía thời điểm phát hiện dòng suối.
              </p>
            </Card>
            <Card className="border-purple/40 bg-purple/10 p-4">
              <strong className="flex items-center gap-2 text-sm text-purple">
                <Sparkles size={16} />
                Chuyển đoạn tiếp theo theo ngữ cảnh
              </strong>
              <p className="mt-3 text-xs leading-5 text-muted">
                Gợi ý một nhịp nối không khí liền mạch khi Kaelen chuẩn bị giải mã các ký tự nước
                đang co lại.
              </p>
              <Button onClick={onSuggest} className="mt-4 w-full border-purple bg-purple">
                <Sparkles size={14} />
                Gợi ý đoạn tiếp theo
              </Button>
              {suggested && (
                <div className="mt-4 rounded-2xl bg-surface p-3">
                  <p className="text-[10px] text-muted">Phương án gợi ý:</p>
                  <p className="mt-1 text-xs italic leading-5">
                    “Before the third ring could collapse, a sudden silence fell over the canopy...”
                  </p>
                  <button onClick={onInsert} className="mt-2 text-xs font-semibold text-purple">
                    Chèn vào trình soạn thảo →
                  </button>
                </div>
              )}
            </Card>
            <Card className="p-4">
              <strong className="text-xs">Theo dõi tính nhất quán</strong>
              <p className="mt-3 text-xs font-semibold">
                Kaelen <span className="float-right font-normal text-muted">Nhân vật chính</span>
              </p>
              <p className="mt-2 text-[11px] leading-5 text-muted">
                ✓ Vật phẩm hiện tại: la bàn thiên văn bằng đồng được theo dõi chính xác từ Chương 15.
                <br />ⓘ Tay phải bị thương ở Chương 12; hiện đang cầm dụng cụ.
              </p>
            </Card>
          </>
        ) : (
          <UtilityPlaceholder tab={tab} />
        )}
      </div>
    </aside>
  )
}
function UtilityPlaceholder({ tab }) {
  return (
    <div className="grid min-h-72 place-items-center text-center">
      <div>
        <Sparkles className="mx-auto text-purple" />
        <h2 className="mt-3 font-semibold">{utilityLabels[tab]}</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Các tiện ích tác giả cho chương hiện tại đã sẵn sàng tại đây.
        </p>
      </div>
    </div>
  )
}
