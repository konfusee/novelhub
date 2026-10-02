import { useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Coins,
  Edit3,
  Eye,
  GripVertical,
  Headphones,
  Info,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { managedChapters } from '../../data/mock/author'
import { Badge, Button, Card, Input, Tabs } from '../../components/ui'

const tabItems = [
  { value: 'chapters', label: 'Chương · 16' },
  { value: 'details', label: 'Thông tin và tóm tắt truyện' },
  { value: 'media', label: 'Media và bản âm thanh · 8' },
  { value: 'reviews', label: 'Bản gửi và đánh giá' },
  { value: 'analytics', label: 'Phân tích truyện' },
]
const filters = [
  { value: 'All', label: 'Tất cả' },
  { value: 'Published', label: 'Đã xuất bản' },
  { value: 'Scheduled', label: 'Đã lên lịch' },
  { value: 'In Review', label: 'Đang xét duyệt' },
  { value: 'Draft', label: 'Bản nháp' },
]
const statusLabels = { Published: 'Đã xuất bản', Scheduled: 'Đã lên lịch', 'In Review': 'Đang xét duyệt', Draft: 'Bản nháp' }
const formatChapterNote = note => note
  .replace('Scheduled for Nov 2, 2026', 'Đã lên lịch ngày 02/11/2026')
  .replace('Draft · Autosaved 12m ago', 'Bản nháp · Tự động lưu 12 phút trước')
  .replace('Published on Oct 24, 2026', 'Xuất bản ngày 24/10/2026')
  .replace('Published on Oct 17, 2026', 'Xuất bản ngày 17/10/2026')
  .replace('Published on Oct 10, 2026', 'Xuất bản ngày 10/10/2026')
  .replace('Published on Jul 18, 2026', 'Xuất bản ngày 18/07/2026')
  .replace('Published on Jul 11, 2026', 'Xuất bản ngày 11/07/2026')
const formatChapterMetric = value => value
  .replace('Est. ', 'Khoảng ')
  .replace(' min', ' phút')
  .replace('Target ', 'Mục tiêu ')
  .replace(' reads', ' lượt đọc')
const priceLabels = { '25 Coins': '25 xu', Pending: 'Chờ thiết lập', Free: 'Miễn phí' }

export function StoryManagerPage() {
  const [tab, setTab] = useState('chapters')
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const chapters = useMemo(
    () =>
      managedChapters.filter(
        chapter =>
          (filter === 'All' || chapter.status === filter) &&
          chapter.title.toLowerCase().includes(query.toLowerCase()),
      ),
    [filter, query],
  )
  return (
    <AuthorLayout>
      <main className="page-author py-6">
        <p className="mb-4 text-xs text-muted">
          Studio tác giả&nbsp; / &nbsp;Truyện&nbsp; / &nbsp;
          <strong className="text-ink">The Silent Forest</strong>
        </p>
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="grid h-32 w-24 shrink-0 place-items-center rounded-2xl bg-[#31584c] text-center text-white shadow-sm">
              <BookOpen />
              <strong className="text-xs">
                THE
                <br />
                SILENT
                <br />
                FOREST
              </strong>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">The Silent Forest</h1>
                <Badge tone="green">Truyện dài kỳ</Badge>
              </div>
              <Badge tone="orange" className="mt-2">
                Kỳ ảo và Bí ẩn
              </Badge>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                The wind moved gently through the ancient trees, carrying whispers of forgotten
                stories. Mira Lane&apos;s bestselling slow-burn mystery epic.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                <span>
                  ▤ <strong>184.200</strong> từ
                </span>
                <span>
                  ▥ <strong>15</strong> chương đã xuất bản
                </span>
                <span>
                  ◉ <strong>1,2M</strong> lượt đọc
                </span>
                <span>
                  ★ <strong>4,8</strong> (3,4K đánh giá)
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
              <Button onClick={() => window.location.assign('/author/stories/demo/chapters/chapter-1/edit')}>
                <Plus size={15} />
                Thêm chương mới
              </Button>
              <Button onClick={() => window.alert('Đã mở trình sửa thông tin truyện (bản mẫu).')} variant="secondary">
                <Edit3 size={15} />
                Sửa thông tin
              </Button>
              <Button onClick={() => window.location.assign('/stories/demo')} variant="secondary">
                <Eye size={15} />
                Xem trước như độc giả
              </Button>
              <Button onClick={() => window.alert('Đã mở thêm thao tác truyện (bản mẫu).')} variant="secondary" className="min-h-11 px-4">
                <MoreHorizontal size={17} />
              </Button>
            </div>
          </div>
        </Card>
        <div className="mt-5 overflow-x-auto border-b border-line">
          <Tabs value={tab} onChange={setTab} items={tabItems} />
        </div>
        {tab !== 'chapters' ? (
          <Card className="mt-5 min-h-80 text-center">
            <div className="grid min-h-64 place-items-center">
              <div>
                <Sparkles className="mx-auto text-purple" />
                <h2 className="mt-3 text-xl font-semibold">
                  {tabItems.find(item => item.value === tab)?.label}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Bảng quản lý này đã sẵn sàng cho dữ liệu quy trình tác giả.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="nh-grid-12 mt-5 grid items-start gap-6 nh-layout-xl-8-4">
            <section className="min-w-0">
              <Card className="rounded-b-none p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Input
                    icon={Search}
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Tìm tiêu đề chương..."
                    className="sm:max-w-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    {filters.map(item => (
                      <button
                        key={item.value}
                        onClick={() => setFilter(item.value)}
                        className={`rounded-full border px-3 py-1.5 text-[11px] ${filter === item.value ? 'border-brand bg-brand text-white' : 'border-line bg-surface'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
              <div className="overflow-x-auto border-x border-line bg-surface">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="bg-elevated text-[10px] uppercase tracking-[.15em] text-muted">
                    <tr>
                      <th className="px-4 py-3">Chương và tiêu đề</th>
                      <th className="px-3 py-3">Trạng thái</th>
                      <th className="px-3 py-3">Chỉ số</th>
                      <th className="px-3 py-3">Mức giá</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {chapters.map(chapter => (
                      <ChapterRow key={chapter.number} chapter={chapter} />
                    ))}
                  </tbody>
                </table>
                {!chapters.length && (
                  <p className="p-10 text-center text-sm text-muted">
                    Không có chương nào khớp bộ lọc.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-b-3xl border border-line bg-surface p-4 text-xs text-muted">
                <span>Đang hiển thị {chapters.length} / 16 chương</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(value => Math.max(1, value - 1))}
                    className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40"
                  >
                    Trước
                  </button>
                  <span>Trang {page} / 3</span>
                  <button
                    onClick={() => setPage(value => Math.min(3, value + 1))}
                    className="rounded-lg border border-line px-3 py-1.5"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </section>
            <StoryHealth />
          </div>
        )}
      </main>
    </AuthorLayout>
  )
}

function ChapterRow({ chapter }) {
  const tone =
    chapter.status === 'Published' ? 'green' : chapter.status === 'Scheduled' ? 'orange' : 'purple'
  return (
    <tr className="hover:bg-elevated/50">
      <td className="px-4 py-4">
        <div className="flex gap-3">
          <GripVertical size={15} className="mt-1 shrink-0 text-muted" />
          <div>
            <strong className="text-xs">
              Chương {chapter.number}: {chapter.title}
            </strong>
            <p className="mt-1 text-[10px] leading-4 text-muted">{formatChapterNote(chapter.note)}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-4">
        <Badge tone={tone}>● {statusLabels[chapter.status] ?? chapter.status}</Badge>
      </td>
      <td className="px-3 py-4 text-xs">
        <strong>{chapter.words} từ</strong>
        <p className="text-[10px] text-orange">{formatChapterMetric(chapter.reads)}</p>
      </td>
      <td className="px-3 py-4 text-xs">
        <span className="flex items-center gap-1">
          <Coins size={13} className="text-orange" />
          {priceLabels[chapter.price] ?? chapter.price}
        </span>
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <Button
            variant={chapter.status === 'Draft' ? 'primary' : 'secondary'}
            onClick={() => window.location.assign('/author/stories/demo/chapters/chapter-1/edit')}
            className="min-h-8 px-3 py-1 text-[10px]"
          >
            {chapter.status === 'Draft'
              ? 'Tiếp tục chỉnh sửa'
              : chapter.status === 'Scheduled'
                ? 'Đổi lịch'
                : 'Chỉnh sửa'}
          </Button>
          <button
            onClick={() => window.location.assign('/author/analytics')}
            className="rounded-lg border border-line p-2"
            aria-label={`Xem phân tích ${chapter.title}`}
          >
            <BarChart3 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function StoryHealth() {
  return (
    <aside className="space-y-5 xl:sticky xl:top-24">
      <Card>
        <div className="flex items-center justify-between border-b border-line pb-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="text-brand" />
            Sức khỏe truyện và cột mốc
          </h2>
          <Info size={16} />
        </div>
        <Metric label="Mức độ cập nhật đều đặn hằng tuần" value="100%" width="100%" />
        <Metric label="Tỷ lệ giữ chân độc giả" value="68%" width="68%" />
        <div className="mt-5 rounded-2xl border border-line bg-elevated p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs">
              <Headphones size={16} className="text-orange" />
              Trạng thái thuyết minh âm thanh
            </span>
            <Badge tone="orange">6/15 chương</Badge>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-surface">
            <div className="h-full w-2/5 rounded-full bg-orange" />
          </div>
          <button onClick={() => window.location.assign('/author/media')} className="mt-2 text-[10px] text-orange">Quản lý bản âm thanh</button>
        </div>
        <p className="mt-5 text-xs font-semibold">Cột mốc xuất bản</p>
        <div className="mt-3 space-y-3">
          {[
            ['Vượt mốc 100.000 từ', true],
            ['Đạt tổng 1.000.000 lượt đọc', true],
            ['Thu âm đủ 15 chương', false],
            ['Mở khóa phiên bản bìa cứng cao cấp', false],
          ].map(([label, done]) => (
            <div key={label} className="flex gap-2 text-[11px]">
              <CheckCircle2 size={15} className={done ? 'text-brand' : 'text-muted'} />
              <span className={done ? 'line-through text-muted' : ''}>{label}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => window.location.assign('/author/analytics')} variant="secondary" className="mt-5 w-full">
          <BarChart3 size={15} />
          Xem phân tích truyện
        </Button>
      </Card>
      <Card>
        <p className="flex items-center gap-2 text-xs font-semibold text-orange">
          <Sparkles size={15} />
          Lời khuyên của biên tập viên cho Hồi II
        </p>
        <p className="mt-3 text-xs leading-5 text-muted">
          Tỷ lệ giữ chân độc giả tăng 74% quanh Chương 14. Hãy duy trì nhịp kể gọn ở Chương 16 để
          giữ đà mở khóa thuê bao.
        </p>
      </Card>
    </aside>
  )
}
function Metric({ label, value, width }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <strong className="text-brand">{value}</strong>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-elevated">
        <div className="h-full rounded-full bg-brand" style={{ width }} />
      </div>
    </div>
  )
}
