import { useMemo, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  Cloud,
  Copy,
  FilePlus2,
  Grid2X2,
  History,
  List,
  MoreHorizontal,
  Search,
  Trash2,
  Upload,
  WandSparkles,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AuthorLayout } from '../../layouts'
import { authorDrafts } from '../../data/mock/author'
import { Badge, Button, Card, Input, Modal, Select } from '../../components/ui'

const filterItems = [
  { value: 'All Drafts', label: 'Tất cả bản nháp' },
  { value: 'Story Chapters', label: 'Chương truyện' },
  { value: 'Standalone Concepts', label: 'Ý tưởng độc lập' },
  { value: 'Ready for Review', label: 'Sẵn sàng xét duyệt' },
]
const snapshots = [
  ['Hôm nay, 14:32', 'Chương 16: Ironwood Tree', 'Đã thêm 480 từ'],
  ['Hôm qua, 21:15', 'Echoes – Astrolabe', 'Đã đồng bộ kiểm tra ngữ pháp'],
  ['24/10, 09:40', 'Ý tưởng khoa học viễn tưởng #2', 'Đã lưu tiền đề ban đầu'],
  ['18/10, 17:02', 'Whispers Alternate', 'Đã tạo nhánh'],
]
const draftTypeLabels = {
  'Story Chapter': 'Chương truyện',
  'Chapter Draft': 'Bản nháp chương',
  'Standalone Concept': 'Ý tưởng độc lập',
  'Special Edition': 'Phiên bản đặc biệt',
}
const draftMetaLabels = {
  'Cloud Synced': 'Đã đồng bộ đám mây',
  'Synced to Cloud': 'Đã đồng bộ đám mây',
  'Tag: Worldbuilding': 'Thẻ: Xây dựng thế giới',
  'Ready for Review': 'Sẵn sàng xét duyệt',
}
const editedLabels = { Yesterday: 'Hôm qua', '12 mins ago': '12 phút trước', '3 days ago': '3 ngày trước', 'Oct 18': '18/10' }

export function DraftsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('All Drafts')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('Last Edited')
  const [view, setView] = useState('grid')
  const [drafts, setDrafts] = useState(authorDrafts)
  const [newOpen, setNewOpen] = useState(false)
  const [restored, setRestored] = useState('')
  const shown = useMemo(
    () =>
      drafts
        .filter(
          draft =>
            (filter === 'All Drafts' ||
              (filter === 'Story Chapters' && draft.type.includes('Chapter')) ||
              (filter === 'Standalone Concepts' && draft.type === 'Standalone Concept') ||
              (filter === 'Ready for Review' && draft.meta === 'Ready for Review')) &&
            `${draft.title} ${draft.story}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'Word Count'
            ? Number(b.words.replace(',', '')) - Number(a.words.replace(',', ''))
            : sort === 'Title'
              ? a.title.localeCompare(b.title)
              : a.id - b.id,
        ),
    [drafts, filter, query, sort],
  )
  const addDraft = () => {
    setDrafts(current => [
      {
        ...authorDrafts[2],
        id: Date.now(),
        title: 'Bản thảo chưa đặt tên',
        edited: 'Vừa xong',
        words: '0',
      },
      ...current,
    ])
    setNewOpen(false)
  }
  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[10px] uppercase tracking-[.18em] text-brand">
              Kho bản thảo · Phiên soạn thảo trực tiếp
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Bản nháp và bản thảo đang viết
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Quản lý chương chưa hoàn thiện, ý tưởng chưa gán truyện và lịch sử đồng bộ ngoại tuyến.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.location.assign('/author/import')} variant="secondary">
              <Upload size={15} />
              Nhập bản thảo
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <FilePlus2 size={15} />
              Bản nháp mới
            </Button>
          </div>
        </div>
        <Card className="mt-6 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex gap-2 overflow-x-auto">
              {filterItems.map(item => (
                <button
                  key={item.value}
                  onClick={() => setFilter(item.value)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs ${filter === item.value ? 'border-brand bg-brand font-semibold text-white' : 'border-line bg-surface'}`}
                >
                  {item.label}
                  {item.value === 'All Drafts' ? ' (14)' : item.value === 'Story Chapters' ? ' (9)' : ''}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-col gap-2 sm:flex-row">
              <Input
                icon={Search}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Tìm bản nháp, thẻ, truyện dài..."
                className="sm:w-64"
              />
              <Select value={sort} onChange={event => setSort(event.target.value)}>
                <option value="Last Edited">Chỉnh sửa gần nhất</option>
                <option value="Word Count">Số từ</option>
                <option value="Title">Tiêu đề</option>
              </Select>
              <div className="flex rounded-xl border border-line bg-elevated p-1">
                <button
                  onClick={() => setView('grid')}
                  aria-label="Chế độ lưới"
                  className={`rounded-lg p-2 ${view === 'grid' ? 'bg-surface text-brand' : ''}`}
                >
                  <Grid2X2 size={16} />
                </button>
                <button
                  onClick={() => setView('list')}
                  aria-label="Chế độ danh sách"
                  className={`rounded-lg p-2 ${view === 'list' ? 'bg-surface text-brand' : ''}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>
        </Card>
        <section
          className={`mt-6 grid gap-5 ${view === 'grid' ? 'md:grid-cols-2' : 'grid-cols-1'}`}
        >
          {shown.map((draft, index) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              featured={index === 0 && view === 'grid'}
              onEdit={() => navigate('/author/stories/demo/chapters/chapter-1/edit')}
              onDelete={() => setDrafts(current => current.filter(item => item.id !== draft.id))}
            />
          ))}
        </section>
        {!shown.length && (
          <Card className="mt-6 py-16 text-center">
            <BookOpen className="mx-auto text-muted" />
            <h2 className="mt-3 font-semibold">Không tìm thấy bản nháp</h2>
            <p className="mt-1 text-sm text-muted">
              Hãy thử bộ lọc khác hoặc tạo bản thảo mới.
            </p>
          </Card>
        )}
        <Card className="mt-7">
          <div className="flex flex-col justify-between gap-3 border-b border-line pb-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <History className="text-brand" />
                Tự động lưu và lịch sử phiên bản đám mây
              </h2>
              <p className="mt-1 text-xs text-muted">
                Khôi phục nội dung bị mất, so sánh các bản lưu theo thời gian và phục hồi nhánh bản
                thảo trong 30 ngày gần nhất.
              </p>
            </div>
            <div className="text-xs text-muted">
              Bộ nhớ đám mây: 14,2 MB / 500 MB{' '}
              <Button onClick={() => window.alert('Đã mở trình quản lý sao lưu (bản mẫu).')} variant="secondary" className="ml-2 min-h-9 px-3 py-1 text-xs">
                Quản lý sao lưu
              </Button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {snapshots.map(([date, title, note]) => (
              <div key={title} className="rounded-2xl border border-line bg-elevated p-4">
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span>{date}</span>
                  <span className="size-2 rounded-full bg-brand" />
                </div>
                <strong className="mt-2 block text-xs">{title}</strong>
                <p className="mt-1 text-[10px] text-muted">{note}</p>
                <button
                  onClick={() => setRestored(title)}
                  className="mt-4 flex items-center gap-1 text-[11px] font-medium text-brand"
                >
                  <History size={13} />
                  {restored === title ? 'Đã khôi phục bản lưu' : 'Khôi phục bản lưu'}
                </button>
              </div>
            ))}
          </div>
        </Card>
        <Modal open={newOpen} title="Tạo bản nháp mới" onClose={() => setNewOpen(false)}>
          <p className="text-sm text-muted">
            Bắt đầu một bản thảo chưa gán. Bạn có thể gắn bản thảo vào truyện sau.
          </p>
          <Input className="mt-4" defaultValue="Bản thảo chưa đặt tên" />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewOpen(false)}>
              Hủy
            </Button>
            <Button onClick={addDraft}>
              <FilePlus2 size={15} />
              Tạo bản nháp
            </Button>
          </div>
        </Modal>
      </main>
    </AuthorLayout>
  )
}

function DraftCard({ draft, featured, onEdit, onDelete }) {
  return (
    <Card className={`${featured ? 'md:min-h-96' : ''} flex flex-col`}>
      <div className="flex items-center gap-2">
        <Badge tone={draft.tone}>{draftTypeLabels[draft.type] ?? draft.type}</Badge>
        {draft.meta.includes('Cloud') && (
          <Badge>
            <Cloud size={12} />
            Đã đồng bộ đám mây
          </Badge>
        )}
        <span className="ml-auto text-[10px] text-muted">Chỉnh sửa lần cuối: {editedLabels[draft.edited] ?? draft.edited}</span>
        <button onClick={() => window.alert('Đã mở tùy chọn bản nháp (bản mẫu).')} aria-label="Tùy chọn bản nháp">
          <MoreHorizontal size={16} />
        </button>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-brand">
        <BookOpen size={14} />
        Truyện: {draft.story}
      </p>
      <h2 className={`mt-2 font-semibold ${featured ? 'text-2xl' : 'text-lg'}`}>{draft.title}</h2>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{draft.excerpt}</p>
      <p className="mt-2 text-[10px] text-muted">{draftMetaLabels[draft.meta] ?? draft.meta}</p>
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-line bg-elevated p-4 text-xs">
        <div>
          <span className="text-[10px] text-muted">Số từ</span>
          <strong className="block">{draft.words} từ</strong>
        </div>
        <div>
          <span className="text-[10px] text-muted">Thời lượng đọc</span>
          <strong className="block">~8,5 phút</strong>
        </div>
        <div>
          <span className="text-[10px] text-muted">Mục tiêu</span>
          <strong className="block text-brand">{draft.progress}%</strong>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <button onClick={() => window.alert('Đã nhân bản bản nháp (bản mẫu).')} className="p-2 text-muted hover:text-brand" aria-label="Nhân bản bản nháp">
          <Copy size={15} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-muted hover:text-rose"
          aria-label="Xóa bản nháp"
        >
          <Trash2 size={15} />
        </button>
        {draft.meta === 'Ready for Review' && (
          <span className="flex items-center gap-1 text-[10px] text-brand">
            <CheckCircle2 size={13} />
            Sẵn sàng
          </span>
        )}
        <Button onClick={() => window.alert('Đã mở xem trước bản nháp (bản mẫu).')} variant="secondary" className="ml-auto min-h-9 px-3 py-1 text-xs">
          Xem trước
        </Button>
        <Button onClick={onEdit} className="min-h-9 px-3 py-1 text-xs">
          <WandSparkles size={14} />
          Tiếp tục chỉnh sửa
        </Button>
      </div>
    </Card>
  )
}
