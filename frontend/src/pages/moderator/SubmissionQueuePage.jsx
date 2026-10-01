import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  Filter,
  Search,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ModeratorLayout } from '../../layouts'
import { submissionQueue } from '../../data/mock/moderation'
import { Badge, Button, Card, Input, Modal, Select } from '../../components/ui'

const tabs = [
  { value: 'All', label: 'Tất cả' },
  { value: 'Unassigned', label: 'Chưa phân công' },
  { value: 'Assigned to Me', label: 'Đã phân công cho tôi' },
  { value: 'Urgent / SLA Warning', label: 'Khẩn cấp / Cảnh báo SLA' },
]
const priorityLabels = { 'High Priority': 'Ưu tiên cao', Normal: 'Bình thường', 'Urgent Alert': 'Cảnh báo khẩn', 'Similarity Alert': 'Cảnh báo tương đồng' }
const genreLabels = { 'Fantasy & Mythic': 'Kỳ ảo và Thần thoại', 'Sci-Fi & Cyberpunk': 'Khoa học viễn tưởng và Cyberpunk', 'Cyberpunk Thriller': 'Giật gân Cyberpunk', 'Romance & Drama': 'Lãng mạn và Chính kịch', 'High Fantasy': 'Kỳ ảo cao cấp' }
const riskLabels = { '98% Clean Verifiable': '98% sạch, có thể xác minh', '100% Passed Syntax & NLP': '100% đạt kiểm tra cú pháp và NLP', 'Rating Mismatch Flag': 'Cảnh báo sai phân loại', '100% Clean': '100% sạch', '42% Lore Overlap': '42% trùng lặp thế giới truyện' }
const formatAge = value => value.replace('h ago', ' giờ trước')
const formatSla = value => value.replace('h', ' giờ').replace('m', ' phút')
const formatPayload = value => value.replace(' chapters', ' chương').replace(' words', ' từ')

export function SubmissionQueuePage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All Genres')
  const [risk, setRisk] = useState('All Verification Levels')
  const [selected, setSelected] = useState([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState('Sarah Jenkins')
  const [page, setPage] = useState(1)
  const [assignments, setAssignments] = useState({})
  const rows = useMemo(
    () =>
      submissionQueue.filter(
        row =>
          (tab === 'All' ||
            (tab === 'Unassigned' && (assignments[row.id] || row.assigned) === 'Unassigned') ||
            (tab === 'Assigned to Me' && (assignments[row.id] || row.assigned).includes('Sarah')) ||
            (tab === 'Urgent / SLA Warning' && row.tone === 'red')) &&
          (genre === 'All Genres' || row.genre === genre) &&
          (risk === 'All Verification Levels' ||
            (risk === 'High AI / Plagiarism Risk' &&
              (row.tone === 'red' || row.tone === 'purple'))) &&
          `${row.title} ${row.id} ${row.author}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [tab, genre, risk, query, assignments],
  )
  const toggle = id =>
    setSelected(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id],
    )
  const assign = () => {
    setAssignments(current => ({
      ...current,
      ...Object.fromEntries(selected.map(id => [id, assignee])),
    }))
    setSelected([])
    setAssignOpen(false)
  }
  return (
    <ModeratorLayout>
      <main className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs text-muted">
              Bảng điều khiển kiểm duyệt /{' '}
              <strong className="text-brand">Hàng đợi bản thảo và quy trình tiếp nhận</strong>
            </p>
            <h1 className="mt-2 text-2xl font-bold">Hàng đợi biên tập</h1>
          </div>
          <div className="flex flex-wrap gap-3 rounded-2xl border border-line bg-elevated px-4 py-3 text-xs">
            <span>
              <strong className="text-brand">● 24</strong> đang chờ
            </span>
            <span>
              <strong className="text-orange">● 8</strong> ưu tiên cao
            </span>
            <span>
              Chờ trung bình: <strong>3,4 giờ</strong>
            </span>
            <span>
              Mục tiêu SLA: <strong>24 giờ</strong>
            </span>
          </div>
        </div>
        <Card className="mt-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Input
              icon={Search}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Lọc theo truyện, mã bản thảo, tác giả..."
              className="xl:w-80"
            />
            <div className="flex max-w-full gap-2 overflow-x-auto xl:flex-1">
              {tabs.map(item => (
                <button
                  key={item.value}
                  onClick={() => setTab(item.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs ${tab === item.value ? 'bg-surface font-semibold text-brand shadow-sm' : 'text-muted'}`}
                >
                  {item.label}{' '}
                  {item.value === 'All'
                    ? '(24)'
                    : item.value === 'Unassigned'
                      ? '(14)'
                      : item.value === 'Assigned to Me'
                        ? '(6)'
                        : '(4)'}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 lg:flex-row">
            <Select value={genre} onChange={event => setGenre(event.target.value)}>
              <option value="All Genres">Tất cả thể loại</option>
              <option value="Fantasy & Mythic">Kỳ ảo và Thần thoại</option>
              <option value="Sci-Fi & Cyberpunk">Khoa học viễn tưởng và Cyberpunk</option>
              <option value="Cyberpunk Thriller">Giật gân Cyberpunk</option>
              <option value="Romance & Drama">Lãng mạn và Chính kịch</option>
              <option value="High Fantasy">Kỳ ảo cao cấp</option>
            </Select>
            <Select value={risk} onChange={event => setRisk(event.target.value)}>
              <option value="All Verification Levels">Tất cả mức xác minh</option>
              <option value="High AI / Plagiarism Risk">Rủi ro AI / đạo văn cao</option>
            </Select>
            <Button
              variant="ghost"
              onClick={() => {
                setTab('All')
                setGenre('All Genres')
                setRisk('All Verification Levels')
                setQuery('')
              }}
            >
              <Filter size={14} />
              Đặt lại bộ lọc
            </Button>
            <Button
              variant="secondary"
              disabled={!selected.length}
              onClick={() => setAssignOpen(true)}
              className="lg:ml-auto"
            >
              <UserPlus size={15} />
              Phân công hàng loạt ({selected.length})
            </Button>
          </div>
          <p className="mt-3 text-[10px] italic text-muted">
            Chính sách không cho phép phê duyệt hàng loạt trực tiếp · chỉ được phân công
          </p>
        </Card>
        <div className="mt-6 hidden grid-cols-12 gap-4 px-5 text-[10px] font-semibold uppercase tracking-[.14em] text-muted xl:grid">
          <div className="col-span-4">Thông tin bản thảo và tác giả</div>
          <div className="col-span-2">Thời gian tiếp nhận và SLA</div>
          <div className="col-span-2">Phân loại và nội dung</div>
          <div className="col-span-2">Kiểm tra tự động</div>
          <div className="col-span-2 text-right">Phân công và quyết định</div>
        </div>
        <section className="mt-3 min-w-0 space-y-4">
          {rows.map(row => (
            <QueueRow
              key={row.id}
              row={{ ...row, assigned: assignments[row.id] || row.assigned }}
              checked={selected.includes(row.id)}
              onCheck={() => toggle(row.id)}
              onClaim={() => setAssignments(current => ({ ...current, [row.id]: 'Sarah Jenkins' }))}
              onReview={() => navigate(`/moderator/submissions/${row.id}`)}
            />
          ))}
        </section>
        {!rows.length && (
          <Card className="mt-4 py-14 text-center">
            <Search className="mx-auto text-muted" />
            <p className="mt-3 text-sm text-muted">Không có bản thảo nào khớp bộ lọc.</p>
          </Card>
        )}
        <div className="mt-6 flex flex-col justify-between gap-3 border-t border-line pt-4 text-xs sm:flex-row sm:items-center">
          <span>Đang hiển thị 1–{rows.length} / 24 bản thảo · Làm mới 42 giây trước</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page === 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
              className="min-h-9 px-3 py-1 text-xs"
            >
              Trước
            </Button>
            {[1, 2, 3].map(value => (
              <button
                key={value}
                onClick={() => setPage(value)}
                className={`size-9 rounded-full ${page === value ? 'bg-brand text-white' : 'border border-line'}`}
              >
                {value}
              </button>
            ))}
            <Button
              variant="secondary"
              onClick={() => setPage(value => Math.min(5, value + 1))}
              className="min-h-9 px-3 py-1 text-xs"
            >
              Sau
            </Button>
          </div>
        </div>
        <Modal open={assignOpen} title="Phân công bản thảo" onClose={() => setAssignOpen(false)}>
          <p className="text-sm text-muted">
            Phân công {selected.length} mục đã chọn cho một kiểm duyệt viên.
          </p>
          <Select
            value={assignee}
            onChange={event => setAssignee(event.target.value)}
            className="mt-4 w-full"
          >
            <option>Sarah Jenkins</option>
            <option>Morgan Lee</option>
            <option>Arthur Vance</option>
          </Select>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Hủy
            </Button>
            <Button onClick={assign}>
              <UserPlus size={15} />
              Xác nhận phân công
            </Button>
          </div>
        </Modal>
      </main>
    </ModeratorLayout>
  )
}

function QueueRow({ row, checked, onCheck, onClaim, onReview }) {
  return (
    <Card
      className={`${row.tone === 'red' ? 'border-rose/50' : row.tone === 'purple' ? 'border-purple/50' : 'border-line'} p-4`}
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-12 xl:items-center">
        <div className="min-w-0 xl:col-span-4">
          <div className="flex gap-3">
            <button
              onClick={onCheck}
              className={`mt-1 grid size-5 shrink-0 place-items-center rounded border ${checked ? 'border-brand bg-brand text-white' : 'border-line'}`}
            >
              {checked && <Check size={12} />}
            </button>
            <span
              className={`grid h-20 w-14 shrink-0 place-items-center rounded-xl text-[10px] font-bold text-white ${row.tone === 'red' ? 'bg-rose' : row.tone === 'purple' ? 'bg-purple' : row.tone === 'orange' ? 'bg-orange' : 'bg-brand'}`}
            >
              NH
              <br />
              VOL
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={row.tone}>{priorityLabels[row.priority] ?? row.priority}</Badge>
                <span className="text-xs text-muted">#{row.id}</span>
              </div>
              <h2 className="mt-2 truncate font-semibold">{row.title}</h2>
              <p className="mt-1 text-xs">
                {row.author} <span className="text-brand">· Tác giả đã xác minh</span>
              </p>
            </div>
          </div>
        </div>
        <div className="xl:col-span-2">
          <p className="flex items-center gap-2 text-xs">
            <Clock3 size={14} />
            {formatAge(row.age)}
          </p>
          <Badge tone={row.tone === 'red' ? 'red' : 'orange'} className="mt-2">
            SLA: còn {formatSla(row.sla)}
          </Badge>
        </div>
        <div className="xl:col-span-2">
          <div className="flex gap-2">
            <Badge>{genreLabels[row.genre] ?? row.genre}</Badge>
            <Badge>{row.rating}</Badge>
          </div>
          <p className="mt-2 text-xs">{formatPayload(row.payload)}</p>
        </div>
        <div className="xl:col-span-2">
          <p
            className={`flex items-center gap-2 text-xs font-semibold ${row.tone === 'red' ? 'text-rose' : row.tone === 'purple' ? 'text-purple' : 'text-brand'}`}
          >
            {row.tone === 'red' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}{' '}
            {riskLabels[row.risk] ?? row.risk}
          </p>
          <p className="mt-2 text-[10px] text-muted">Đã hoàn tất quét tư vấn tự động</p>
        </div>
        <div className="xl:col-span-2 xl:text-right">
          <p className="text-xs text-muted">
            {row.assigned === 'Unassigned' ? (
              'Trạng thái: Chưa phân công'
            ) : (
              <>
                Đã phân công: <strong className="text-ink">{row.assigned}</strong>
              </>
            )}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={onClaim} variant="secondary" className="min-h-9 px-3 py-1 text-xs">
              {row.assigned === 'Unassigned' ? 'Nhận xử lý' : 'Phân công lại'}
            </Button>
            <Button
              onClick={onReview}
              className={`${row.tone === 'red' ? 'border-rose bg-rose' : row.tone === 'purple' ? 'border-purple bg-purple' : ''} min-h-9 px-3 py-1 text-xs`}
            >
              Xét duyệt <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
