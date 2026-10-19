import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  RotateCcw,
  Search,
  ShieldCheck,
  UserPlus,
} from '../../components/icons'
import { ModeratorLayout } from '../../layouts'
import { ROUTES } from '../../app/routes'
import { submissionQueue } from '../../data/mock/moderation'
import { StoryCover } from '../../components/story/StoryCover'
import { useMockResource } from '../../context/MockDataContext'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'

const tabs = [
  { value: 'All', label: 'Tất cả', count: 24 },
  { value: 'Unassigned', label: 'Chưa phân công', count: 14 },
  { value: 'Assigned to Me', label: 'Đã phân công cho tôi', count: 6 },
  { value: 'Urgent / SLA Warning', label: 'Khẩn cấp / Cảnh báo SLA', count: 4 },
]
const PAGE_COUNT = 3
const priorityLabels = {
  'High Priority': 'Ưu tiên cao',
  Normal: 'Bình thường',
  'Urgent Alert': 'Cảnh báo khẩn',
  'Similarity Alert': 'Cảnh báo tương đồng',
}
const genreLabels = {
  'Fantasy & Mythic': 'Kỳ ảo và Thần thoại',
  'Sci-Fi & Cyberpunk': 'Khoa học viễn tưởng và Cyberpunk',
  'Cyberpunk Thriller': 'Giật gân Cyberpunk',
  'Romance & Drama': 'Lãng mạn và Chính kịch',
  'High Fantasy': 'Kỳ ảo cao cấp',
}
const riskLabels = {
  '98% Clean Verifiable': '98% sạch, có thể xác minh',
  '100% Passed Syntax & NLP': '100% đạt kiểm tra cú pháp và NLP',
  'Rating Mismatch Flag': 'Cảnh báo sai phân loại',
  '100% Clean': '100% sạch',
  '42% Lore Overlap': '42% trùng lặp thế giới truyện',
}
const toneText = {
  green: 'text-brand-strong',
  red: 'text-rose-strong',
  orange: 'text-orange-strong',
  purple: 'text-purple-strong',
}
const toneBorder = {
  green: 'border-line',
  red: 'border-rose/45',
  orange: 'border-orange/45',
  purple: 'border-purple/40',
}
const toneCover = {
  green: 'var(--primary)',
  red: 'var(--accent-rose)',
  orange: 'var(--accent-orange)',
  purple: 'var(--accent-purple)',
}
const formatAge = value => value.replace('h ago', ' giờ trước')
const formatSla = value => value.replace('h', ' giờ').replace('m', ' phút')
const formatPayload = value => value.replace(' chapters', ' chương').replace(' words', ' từ')

export function SubmissionQueuePage() {
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('All Genres')
  const [risk, setRisk] = useState('All Verification Levels')
  const [selected, setSelected] = useState([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState('Sarah Jenkins')
  const [page, setPage] = useState(1)
  const [assignments, setAssignments] = useState({})
  const queue = useMockResource('moderator:submissions', submissionQueue)
  const rows = useMemo(
    () =>
      queue.data.filter(
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
    [queue.data, tab, genre, risk, query, assignments],
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
  const resetFilters = () => {
    setTab('All')
    setGenre('All Genres')
    setRisk('All Verification Levels')
    setQuery('')
  }
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-caption text-muted">
              Bảng điều khiển kiểm duyệt /{' '}
              <strong className="font-semibold text-brand-strong">
                Hàng đợi bản thảo và quy trình tiếp nhận
              </strong>
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Hàng đợi biên tập</h1>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm shadow-whisper">
            <QueueStat dot="bg-brand" value="24" label="đang chờ" />
            <QueueStat dot="bg-orange" value="8" label="ưu tiên cao" />
            <QueueStat label="Chờ trung bình:" value="3,4 giờ" />
            <QueueStat label="Mục tiêu SLA:" value="24 giờ" />
          </dl>
        </div>

        <Card className="mt-6 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Input
              icon={Search}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Tìm truyện, mã, tác giả..."
              aria-label="Lọc theo truyện, mã bản thảo, tác giả"
              className="w-full xl:w-80 xl:shrink-0"
            />
            <div className="min-w-0 xl:flex-1">
              <Tabs
                label="Lọc theo phân công"
                singleRow
                value={tab}
                onChange={setTab}
                items={tabs.map(item => ({
                  value: item.value,
                  label: (
                    <>
                      {item.label}
                      <span className="tabular-nums opacity-70">{item.count}</span>
                    </>
                  ),
                }))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col flex-wrap gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="queue-genre">
              Thể loại
            </label>
            <Select id="queue-genre" value={genre} onChange={event => setGenre(event.target.value)}>
              <option value="All Genres">Tất cả thể loại</option>
              <option value="Fantasy & Mythic">Kỳ ảo và Thần thoại</option>
              <option value="Sci-Fi & Cyberpunk">Khoa học viễn tưởng và Cyberpunk</option>
              <option value="Cyberpunk Thriller">Giật gân Cyberpunk</option>
              <option value="Romance & Drama">Lãng mạn và Chính kịch</option>
              <option value="High Fantasy">Kỳ ảo cao cấp</option>
            </Select>
            <label className="sr-only" htmlFor="queue-risk">
              Mức xác minh
            </label>
            <Select id="queue-risk" value={risk} onChange={event => setRisk(event.target.value)}>
              <option value="All Verification Levels">Tất cả mức xác minh</option>
              <option value="High AI / Plagiarism Risk">Rủi ro AI / đạo văn cao</option>
            </Select>
            <Button variant="ghost" onClick={resetFilters}>
              <RotateCcw size={15} />
              Đặt lại bộ lọc
            </Button>
            <Button
              variant="secondary"
              disabled={!selected.length}
              onClick={() => setAssignOpen(true)}
              className="sm:ml-auto"
            >
              <UserPlus size={16} />
              Phân công hàng loạt ({selected.length})
            </Button>
          </div>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <Info size={14} className="shrink-0" />
            Chính sách không cho phép phê duyệt hàng loạt trực tiếp · chỉ được phân công
          </p>
        </Card>

        <div
          aria-hidden="true"
          className="mt-6 hidden grid-cols-12 gap-4 px-5 text-[11px] font-semibold uppercase tracking-[.12em] text-muted xl:grid"
        >
          <div className="col-span-4 pl-8">Thông tin bản thảo và tác giả</div>
          <div className="col-span-2">Thời gian tiếp nhận và SLA</div>
          <div className="col-span-2">Phân loại và nội dung</div>
          <div className="col-span-2">Kiểm tra tự động</div>
          <div className="col-span-2 text-right">Phân công và quyết định</div>
        </div>
        {queue.status === 'loading' ? (
          <ul
            aria-busy="true"
            aria-label="Đang tải danh sách bản thảo chờ xét duyệt"
            className="mt-3 min-w-0 space-y-3"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <QueueRowSkeleton key={index} />
            ))}
          </ul>
        ) : queue.status === 'error' ? (
          <Card className="mt-3 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được hàng đợi bản thảo"
              description="Dịch vụ tiếp nhận chưa phản hồi. Bản thảo vẫn được giữ nguyên trong hàng đợi."
              action={
                <Button variant="secondary" size="sm" onClick={queue.retry}>
                  <RotateCcw size={14} />
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : queue.status === 'empty' ? (
          <Card className="mt-3 p-0">
            <EmptyState
              icon={ShieldCheck}
              title="Hàng đợi bản thảo đang trống"
              description="Không còn bản thảo nào chờ xét duyệt. Kiểm tra các báo cáo cộng đồng đang mở."
              action={
                <ButtonLink to="/moderator/reports" variant="secondary" size="sm">
                  Xem hàng đợi báo cáo
                </ButtonLink>
              }
            />
          </Card>
        ) : rows.length ? (
          <ul
            aria-label="Danh sách bản thảo chờ xét duyệt"
            className="nh-fade-enter mt-3 min-w-0 space-y-3"
          >
            {rows.map(row => (
              <QueueRow
                key={row.id}
                row={{ ...row, assigned: assignments[row.id] || row.assigned }}
                checked={selected.includes(row.id)}
                onCheck={() => toggle(row.id)}
                onClaim={() =>
                  setAssignments(current => ({ ...current, [row.id]: 'Sarah Jenkins' }))
                }
              />
            ))}
          </ul>
        ) : (
          <Card className="mt-3 p-0">
            <EmptyState
              icon={Search}
              title="Không có bản thảo nào khớp bộ lọc"
              description="Hãy thử từ khóa khác hoặc đặt lại bộ lọc để xem toàn bộ hàng đợi."
              action={
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  <RotateCcw size={14} />
                  Đặt lại bộ lọc
                </Button>
              }
            />
          </Card>
        )}

        <nav
          aria-label="Phân trang hàng đợi"
          className="mt-6 flex flex-col justify-between gap-3 border-t border-hairline pt-4 text-sm sm:flex-row sm:items-center"
        >
          <span className="text-muted">
            {queue.status === 'loading'
              ? 'Đang tải hàng đợi bản thảo…'
              : `Đang hiển thị ${rows.length ? `1–${rows.length}` : '0'} / 24 bản thảo · Làm mới 42 giây trước`}
          </span>
          <div className="flex items-center gap-1.5 pointer-coarse:gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(value => Math.max(1, value - 1))}
            >
              <ChevronLeft size={14} />
              Trước
            </Button>
            {Array.from({ length: PAGE_COUNT }, (_, index) => index + 1).map(value => (
              <button
                key={value}
                type="button"
                aria-label={`Trang ${value}`}
                aria-current={page === value ? 'page' : undefined}
                onClick={() => setPage(value)}
                className={`grid size-9 place-items-center rounded-full text-sm font-semibold tabular-nums transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.96] pointer-coarse:size-11 ${page === value ? 'bg-brand text-on-brand' : 'border border-line bg-surface hover:border-brand hover:text-brand-strong'}`}
              >
                {value}
              </button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              disabled={page === PAGE_COUNT}
              onClick={() => setPage(value => Math.min(PAGE_COUNT, value + 1))}
            >
              Sau
              <ChevronRight size={14} />
            </Button>
          </div>
        </nav>

        <Modal open={assignOpen} title="Phân công bản thảo" onClose={() => setAssignOpen(false)}>
          <p className="text-sm text-ink/75">
            Phân công {selected.length} mục đã chọn cho một kiểm duyệt viên.
          </p>
          <label htmlFor="queue-assignee" className="mt-4 block text-sm font-semibold">
            Kiểm duyệt viên
          </label>
          <Select
            id="queue-assignee"
            value={assignee}
            onChange={event => setAssignee(event.target.value)}
            className="mt-2 w-full"
          >
            <option>Sarah Jenkins</option>
            <option>Morgan Lee</option>
            <option>Arthur Vance</option>
          </Select>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Hủy
            </Button>
            <Button onClick={assign}>
              <UserPlus size={16} />
              Xác nhận phân công
            </Button>
          </div>
        </Modal>
      </div>
    </ModeratorLayout>
  )
}

function QueueStat({ dot, value, label }) {
  return (
    <div className="flex items-center gap-1.5">
      {dot ? (
        <>
          <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
          <dt className="sr-only">{label}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
          <span aria-hidden="true" className="text-muted">
            {label}
          </span>
        </>
      ) : (
        <>
          <dt className="text-muted">{label}</dt>
          <dd className="font-semibold">{value}</dd>
        </>
      )}
    </div>
  )
}

function QueueRow({ row, checked, onCheck, onClaim }) {
  const checkboxId = `queue-select-${row.id}`
  const flagged = row.tone === 'red' || row.tone === 'purple'
  return (
    <li>
      <Card
        className={`p-4 transition-[border-color,box-shadow] duration-200 ${checked ? 'border-brand ring-2 ring-brand/20' : toneBorder[row.tone]}`}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-12 xl:items-center">
          <div className="min-w-0 sm:col-span-2 xl:col-span-4">
            <div className="flex gap-3">
              {/* 44px hit area around the 16px box; negative margins keep the visual position. */}
              <label
                htmlFor={checkboxId}
                className="-mx-3.5 -my-2.5 grid size-11 shrink-0 cursor-pointer place-items-center"
              >
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={checked}
                  onChange={onCheck}
                  className="size-4 min-h-4 cursor-pointer accent-brand"
                />
                <span className="sr-only">Chọn bản thảo {row.title}</span>
              </label>
              <StoryCover
                story={{ title: row.title, author: row.author, color: toneCover[row.tone] }}
                className="h-20 w-14 shrink-0 rounded-xl"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={row.tone}>{priorityLabels[row.priority] ?? row.priority}</Badge>
                  <span className="text-xs text-muted tabular-nums">#{row.id}</span>
                </div>
                <h2 className="mt-1.5 line-clamp-2 text-base font-semibold leading-snug">
                  {row.title}
                </h2>
                <p className="mt-0.5 text-sm">
                  {row.author} <span className="text-brand-strong">· Tác giả đã xác minh</span>
                </p>
              </div>
            </div>
          </div>
          <div className="xl:col-span-2">
            <p className="flex items-center gap-2 text-sm">
              <Clock3 size={14} className="text-muted" />
              {formatAge(row.age)}
            </p>
            <Badge
              tone={row.tone === 'red' ? 'red' : row.tone === 'orange' ? 'orange' : 'neutral'}
              className="mt-2"
            >
              SLA: còn {formatSla(row.sla)}
            </Badge>
          </div>
          <div className="xl:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge>{genreLabels[row.genre] ?? row.genre}</Badge>
              <Badge tone={row.rating === '18+' ? 'red' : 'neutral'}>{row.rating}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{formatPayload(row.payload)}</p>
          </div>
          <div className="xl:col-span-2">
            <p className={`flex items-start gap-2 text-sm font-semibold ${toneText[row.tone]}`}>
              {flagged ? (
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              ) : (
                <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              )}
              {riskLabels[row.risk] ?? row.risk}
            </p>
            <p className="mt-1 text-xs text-muted">Đã hoàn tất quét tư vấn tự động</p>
          </div>
          <div className="flex flex-col gap-3 border-t border-hairline pt-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between xl:col-span-2 xl:flex-col xl:items-stretch xl:border-0 xl:pt-0">
            <p className="text-sm text-muted xl:text-right xl:text-xs">
              {row.assigned === 'Unassigned' ? (
                'Trạng thái: Chưa phân công'
              ) : (
                <>
                  Đã phân công: <strong className="text-ink">{row.assigned}</strong>
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
              <Button onClick={onClaim} variant="secondary" size="sm">
                {row.assigned === 'Unassigned' ? 'Nhận xử lý' : 'Phân công lại'}
              </Button>
              <ButtonLink
                to={ROUTES.moderatorSubmission(row.id)}
                size="sm"
                trailingIcon={ChevronRight}
                aria-label={`Xét duyệt ${row.title}`}
              >
                Xét duyệt
              </ButtonLink>
            </div>
          </div>
        </div>
      </Card>
    </li>
  )
}

/* Mirrors QueueRow: same grid tracks, 56×80 cover, badge/text stacks and the action column. */
function QueueRowSkeleton() {
  return (
    <li aria-hidden="true">
      <Card as="div" className="p-4">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-12 xl:items-center">
          <div className="min-w-0 sm:col-span-2 xl:col-span-4">
            <div className="flex gap-3">
              <Skeleton className="mt-1 size-4 shrink-0 rounded-[5px]" />
              <Skeleton className="h-20 w-14 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <span className="mt-1.5 flex h-[1.375rem] items-center">
                  <Skeleton className="h-4 w-4/5" />
                </span>
                <span className="mt-0.5 flex h-5 items-center">
                  <Skeleton className="h-3 w-3/5" />
                </span>
              </div>
            </div>
          </div>
          <div className="xl:col-span-2">
            <span className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-24" />
            </span>
            <Skeleton className="mt-2 h-6 w-32" />
          </div>
          <div className="xl:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-24 xl:w-full" />
              <Skeleton className="h-6 w-12" />
            </div>
            <span className="mt-2 flex h-5 items-center">
              <Skeleton className="h-3 w-28" />
            </span>
          </div>
          <div className="xl:col-span-2">
            <span className="flex h-5 flex-col justify-center gap-2 xl:h-10">
              <Skeleton className="h-3.5 w-32 max-w-full" />
              <span className="hidden xl:block">
                <Skeleton className="h-3.5 w-20" />
              </span>
            </span>
            <span className="mt-1 flex h-4 flex-col justify-center gap-1.5 xl:h-8">
              <Skeleton className="h-3 w-36 max-w-full" />
              <span className="hidden xl:block">
                <Skeleton className="h-3 w-16" />
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-3 border-t border-hairline pt-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between xl:col-span-2 xl:flex-col xl:items-stretch xl:border-0 xl:pt-0">
            <span className="flex h-5 items-center xl:h-4 xl:justify-end">
              <Skeleton className="h-3 w-28" />
            </span>
            <div className="flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
              <Skeleton className="h-9 w-28 xl:w-full" />
              <Skeleton className="h-[2.625rem] w-28 xl:w-full" />
            </div>
          </div>
        </div>
      </Card>
    </li>
  )
}
