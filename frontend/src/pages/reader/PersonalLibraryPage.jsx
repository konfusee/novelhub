import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Cloud,
  Filter,
  Grid2X2,
  List,
  RefreshCw,
  Search,
  Trophy,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { LibraryCard, LibraryCardSkeleton } from '../../components/reader/LibraryCard'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  ProgressBar,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui'
import { useMockResource } from '../../context/MockDataContext'
import { libraryItems } from '../../data/mock/reader'

const tabs = [
  ['all', 'Tất cả'],
  ['reading', 'Đang đọc'],
  ['listening', 'Đang nghe'],
  ['completed', 'Đã hoàn thành'],
  ['offline', 'Đã lưu ngoại tuyến'],
]

const views = [
  ['grid', 'Dạng lưới', Grid2X2],
  ['list', 'Dạng danh sách', List],
]

export function PersonalLibraryPage() {
  const library = useMockResource('reader:library', libraryItems)
  const loading = library.status === 'loading'
  const [removed, setRemoved] = useState([])
  const items = useMemo(
    () => library.data.filter(item => !removed.includes(item.id)),
    [library.data, removed],
  )
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [sort, setSort] = useState('recent')
  const [view, setView] = useState('grid')
  const filtered = useMemo(
    () =>
      items
        .filter(item => {
          const tabMatch = tab === 'all' || (tab === 'offline' ? item.offline : item.status === tab)
          const typeMatch = type === 'all' || item.type === type
          return (
            tabMatch &&
            typeMatch &&
            `${item.title} ${item.author}`.toLowerCase().includes(query.toLowerCase())
          )
        })
        .sort((a, b) =>
          sort === 'title'
            ? a.title.localeCompare(b.title)
            : sort === 'progress'
              ? b.progress - a.progress
              : 0,
        ),
    [items, query, sort, tab, type],
  )
  const countFor = key =>
    key === 'all'
      ? items.length
      : key === 'offline'
        ? items.filter(i => i.offline).length
        : items.filter(i => i.status === key).length
  const offlineCount = items.filter(i => i.offline).length
  const resetFilters = () => {
    setTab('all')
    setType('all')
    setQuery('')
  }
  return (
    <ReaderLayout>
      <div className="page-reader py-6">
        <Card
          bezel
          innerClassName="flex flex-col justify-between gap-5 p-5 sm:p-6 lg:flex-row lg:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-h2 sm:text-h1">Thư viện của tôi</h1>
              {library.status === 'ready' ? (
                <Badge tone="green">Tổng cộng {items.length} tác phẩm</Badge>
              ) : (
                loading && <Skeleton className="h-6 w-36" />
              )}
            </div>
            {loading ? (
              <span className="mt-2 flex h-5 items-center">
                <Skeleton className="h-3 w-72 max-w-full" />
              </span>
            ) : (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span>{items.filter(i => i.type === 'story').length} truyện chữ</span>
                <span aria-hidden="true">•</span>
                <span>{items.filter(i => i.type === 'audio').length} truyện âm thanh</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  •
                </span>
                <span className="font-medium text-orange-strong">6 tác phẩm đang đọc tuần này</span>
              </p>
            )}
          </div>
          <div className="w-full rounded-2xl border border-hairline bg-elevated p-4 lg:w-80">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 font-medium">
                <Cloud size={16} className="text-brand" />
                Bộ nhớ ngoại tuyến
              </span>
              <strong className="tabular-nums">2.4 GB / 10 GB</strong>
            </div>
            <ProgressBar value={2.4} max={10} label="Bộ nhớ ngoại tuyến" className="mt-2" />
            {loading ? (
              <span className="mt-2 flex h-4 items-center">
                <Skeleton className="h-2.5 w-52" />
              </span>
            ) : (
              <p className="mt-2 text-xs text-ink/70">
                {offlineCount} tác phẩm đã sẵn sàng để đọc ngoại tuyến
              </p>
            )}
          </div>
        </Card>

        <section
          aria-label="Bộ lọc thư viện"
          className="mt-6 space-y-3 border-b border-hairline pb-4"
        >
          <Tabs
            singleRow
            label="Lọc theo trạng thái"
            value={tab}
            onChange={setTab}
            items={tabs.map(([value, label]) => ({
              value,
              label: library.status === 'ready' ? `${label} (${countFor(value)})` : label,
            }))}
          />
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Input
              icon={Search}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Lọc thư viện..."
              aria-label="Lọc thư viện"
              className="sm:min-w-56 sm:flex-1 lg:max-w-sm"
            />
            <div
              role="group"
              aria-label="Chế độ hiển thị"
              className="flex items-center gap-1 rounded-full border border-hairline bg-elevated p-1 sm:order-last pointer-coarse:gap-2"
            >
              {views.map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={`grid size-9 place-items-center rounded-full transition-[background-color,color] duration-200 pointer-coarse:size-11 ${view === value ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-surface hover:text-ink'}`}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
              <Select
                value={type}
                onChange={e => setType(e.target.value)}
                aria-label="Lọc theo định dạng"
              >
                <option value="all">Mọi định dạng</option>
                <option value="story">Truyện chữ</option>
                <option value="audio">Truyện âm thanh</option>
              </Select>
              <Select
                value={sort}
                onChange={e => setSort(e.target.value)}
                aria-label="Sắp xếp thư viện"
              >
                <option value="recent">Mở gần đây</option>
                <option value="title">Tên A–Z</option>
                <option value="progress">Tiến độ cao nhất</option>
              </Select>
            </div>
          </div>
        </section>

        {loading ? (
          <section
            aria-busy="true"
            aria-label="Đang tải thư viện"
            className={`mt-6 ${view === 'grid' ? 'nh-grid-12 grid nh-cols-2 gap-3 nh-md-cols-3 nh-xl-cols-4' : 'space-y-3'}`}
          >
            {libraryItems.map(item => (
              <LibraryCardSkeleton key={item.id} view={view} />
            ))}
          </section>
        ) : library.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được thư viện"
              description="Kết nối tới máy chủ bị gián đoạn. Tác phẩm của bạn vẫn an toàn, hãy thử lại."
              action={
                <Button variant="secondary" size="sm" onClick={library.retry}>
                  <RefreshCw size={14} aria-hidden="true" />
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : !items.length ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={BookOpen}
              title="Thư viện của bạn đang trống"
              description="Lưu truyện chữ hoặc truyện âm thanh để đọc tiếp trên mọi thiết bị."
              action={
                <ButtonLink to="/reader/explore" size="sm" trailingIcon={ArrowRight}>
                  Khám phá truyện
                </ButtonLink>
              }
            />
          </Card>
        ) : filtered.length ? (
          <section
            aria-label="Tác phẩm trong thư viện"
            className={`nh-fade-enter mt-6 ${view === 'grid' ? 'nh-grid-12 grid nh-cols-2 gap-3 nh-md-cols-3 nh-xl-cols-4' : 'space-y-3'}`}
          >
            {filtered.map(item => (
              <LibraryCard
                key={item.id}
                item={item}
                view={view}
                onRemove={id => setRemoved(current => [...current, id])}
              />
            ))}
          </section>
        ) : (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={Filter}
              title="Không tìm thấy tác phẩm"
              description="Hãy thử từ khóa hoặc bộ lọc khác."
              action={
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              }
            />
          </Card>
        )}

        <Card className="mt-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
              <Trophy />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold sm:text-h3">Mục tiêu đọc hằng tuần</h2>
              <p className="text-sm text-muted">
                Bạn đã đọc 4,5 giờ trong mục tiêu 5 giờ tuần này. Hãy tiếp tục!
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <ButtonLink to="/reader/history" variant="secondary">
              Xem thống kê
            </ButtonLink>
            <ButtonLink to="/read/silent-forest/chapter-1">
              <BookOpen size={16} />
              Tiếp tục đọc
            </ButtonLink>
          </div>
        </Card>
      </div>
    </ReaderLayout>
  )
}
