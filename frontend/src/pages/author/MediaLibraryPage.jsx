import { useMemo, useRef, useState } from 'react'
import {
  Check,
  Cloud,
  Copy,
  FileAudio,
  FolderOpen,
  Grid2X2,
  Image,
  Link2,
  List,
  MoreVertical,
  Pause,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { mediaAssets } from '../../data/mock/author'
import { Badge, Button, Card, Input, Select } from '../../components/ui'

const filters = [
  { value: 'All Assets', label: 'Tất cả tài nguyên' },
  { value: 'Story Covers', label: 'Bìa truyện' },
  { value: 'Chapter Art & Maps', label: 'Minh họa chương và bản đồ' },
  { value: 'Audiobook Narration', label: 'Thuyết minh sách nói' },
]
const statusLabels = { 'In Use': 'Đang sử dụng', Linked: 'Đã liên kết', Master: 'Bản gốc', Unused: 'Chưa sử dụng', Draft: 'Bản nháp', New: 'Mới' }

export function MediaLibraryPage() {
  const fileRef = useRef(null)
  const [assets, setAssets] = useState(mediaAssets)
  const [filter, setFilter] = useState('All Assets')
  const [query, setQuery] = useState('')
  const [story, setStory] = useState('All Stories')
  const [sort, setSort] = useState('Newest Uploads')
  const [view, setView] = useState('grid')
  const [selected, setSelected] = useState(mediaAssets[0])
  const [playing, setPlaying] = useState(null)
  const [copied, setCopied] = useState(false)
  const shown = useMemo(
    () =>
      assets
        .filter(
          asset =>
            (filter === 'All Assets' || asset.type === filter) &&
            (story === 'All Stories' || asset.story === story) &&
            asset.name.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => (sort === 'Name A–Z' ? a.name.localeCompare(b.name) : b.id - a.id)),
    [assets, filter, query, story, sort],
  )
  const upload = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const next = {
      id: Date.now(),
      name: file.name,
      type: file.type.startsWith('audio') ? 'Audiobook Narration' : 'Chapter Art & Maps',
      kind: file.type.startsWith('audio') ? 'audio' : 'image',
      color: '#3b6f92',
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      dimensions: 'Đang chờ phân tích',
      story: 'Chưa gán',
      status: 'New',
      icon: 'NEW',
    }
    setAssets(current => [next, ...current])
    setSelected(next)
  }
  return (
    <AuthorLayout>
      <main className="page-author py-7">
        <div className="nh-grid-12 grid items-start gap-6 nh-layout-2xl-8-4">
          <div className="min-w-0">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className="text-[10px] uppercase tracking-[.18em] text-brand">
                  Studio tác giả · Sản xuất{' '}
                  <span className="ml-4 text-muted">● Mạng lưu trữ v2.4</span>
                </p>
                <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Thư viện media và tài nguyên</h1>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                  Quản lý bìa sách, minh họa nhân vật, bản đồ thế giới và tệp thu âm sách nói gốc.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.alert('Đã mở thư mục media (bản mẫu).')} variant="secondary">
                  <FolderOpen size={16} />
                  Sắp xếp hàng loạt
                </Button>
                <input
                  ref={fileRef}
                  onChange={upload}
                  className="hidden"
                  type="file"
                  accept="image/*,audio/*"
                />
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload size={16} />
                  Tải media mới
                </Button>
              </div>
            </div>
            <Card className="mt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-12 place-items-center rounded-full bg-brand/15 text-brand">
                  <Cloud />
                </span>
                <div>
                  <h2 className="font-semibold">
                    Dung lượng lưu trữ tác giả <Badge className="ml-2">Hạng: Tác giả Pro</Badge>
                  </h2>
                  <p className="text-xs text-muted">
                    Phân phối CDN nhanh qua 14 điểm độc giả toàn cầu
                  </p>
                </div>
                <p className="sm:ml-auto">
                  <strong>4,8 GB</strong> <span className="text-sm text-muted">đã dùng trên 20 GB</span>
                </p>
              </div>
              <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-elevated">
                <span className="w-[6%] bg-brand" />
                <span className="w-[18%] bg-orange" />
              </div>
              <div className="mt-3 flex flex-wrap gap-5 text-[11px] text-muted">
                <span>
                  ● Hình ảnh và minh họa: <strong className="text-ink">1,2 GB</strong> (32 tệp)
                </span>
                <span className="text-orange">
                  ● Bản âm thanh và track thành phần: <strong>3,6 GB</strong> (16 tệp)
                </span>
                <span>
                  Dung lượng trống: <strong className="text-ink">15,2 GB</strong>
                </span>
              </div>
            </Card>
            <div className="mt-6 flex flex-col gap-4 border-b border-line pb-4">
              <div className="flex max-w-full gap-2 overflow-x-auto">
                {filters.map(item => (
                  <button
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs ${filter === item.value ? 'bg-brand font-semibold text-white' : 'text-muted hover:bg-elevated'}`}
                  >
                    {item.label}{' '}
                    {item.value === 'All Assets'
                      ? '(48)'
                      : item.value === 'Story Covers'
                        ? '(8)'
                        : item.value === 'Chapter Art & Maps'
                          ? '(24)'
                          : '(16)'}
                  </button>
                ))}
                <div className="sticky right-0 ml-auto flex shrink-0 rounded-xl border border-line bg-elevated p-1">
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
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  icon={Search}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Tìm tài nguyên theo tên hoặc thẻ..."
                  className="flex-1"
                />
                <Select value={story} onChange={event => setStory(event.target.value)}>
                  <option value="All Stories">Tất cả truyện</option>
                  <option>The Silent Forest</option>
                  <option>Echoes of Eldoria</option>
                  <option>Whispers of You</option>
                </Select>
                <Select value={sort} onChange={event => setSort(event.target.value)}>
                  <option value="Newest Uploads">Tải lên mới nhất</option>
                  <option value="Name A–Z">Tên A–Z</option>
                </Select>
              </div>
            </div>
            <section
              className={`nh-grid-12 mt-5 gap-4 ${view === 'grid' ? 'nh-sm-cols-2 nh-xl-cols-3' : 'nh-cols-1'}`}
            >
              {shown.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selected?.id === asset.id}
                  view={view}
                  playing={playing === asset.id}
                  onPlay={() => setPlaying(value => (value === asset.id ? null : asset.id))}
                  onSelect={() => {
                    setSelected(asset)
                    setCopied(false)
                  }}
                />
              ))}
            </section>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-5 flex min-h-36 w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-brand text-sm font-semibold text-brand"
            >
              <Upload />
              Thả tệp vào đây hoặc duyệt để tải lên
            </button>
          </div>
          <AssetInspector
            asset={selected}
            copied={copied}
            onCopy={() => setCopied(true)}
            onClose={() => setSelected(null)}
            onDelete={() => {
              setAssets(current => current.filter(item => item.id !== selected?.id))
              setSelected(null)
            }}
          />
        </div>
      </main>
    </AuthorLayout>
  )
}

function AssetCard({ asset, selected, view, playing, onPlay, onSelect }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={`cursor-pointer overflow-hidden rounded-3xl border bg-surface text-left ${selected ? 'border-brand ring-2 ring-brand/20' : 'border-line'} ${view === 'list' ? 'flex items-center' : ''}`}
    >
      <div
        className={`relative grid place-items-center text-white ${view === 'list' ? 'h-24 w-28 shrink-0' : 'aspect-[4/3]'}`}
        style={{ backgroundColor: asset.color }}
      >
        {asset.kind === 'audio' ? (
          <>
            <button
              onClick={event => {
                event.stopPropagation()
                onPlay()
              }}
              className="grid size-14 place-items-center rounded-full bg-white/20"
              aria-label={playing ? 'Tạm dừng âm thanh' : 'Phát âm thanh'}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <div className="absolute inset-x-5 bottom-5 flex h-10 items-end justify-between">
              {[35, 70, 45, 90, 55, 75, 40, 85, 60, 30, 70].map((height, index) => (
                <span
                  key={index}
                  className="w-1 rounded-full bg-white/80"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="text-3xl font-bold opacity-80">{asset.icon}</span>
            <Image className="absolute bottom-4 right-4 opacity-40" />
          </>
        )}
        <Badge className="absolute left-3 top-3 bg-black/40 text-white">{statusLabels[asset.status] ?? asset.status}</Badge>
        {selected && (
          <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-brand">
            <Check size={14} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-center">
          <h3 className="truncate text-xs font-semibold">{asset.name}</h3>
          <MoreVertical size={14} className="ml-auto shrink-0 text-muted" />
        </div>
        <p className="mt-2 text-[10px] text-muted">
          {asset.dimensions} · {asset.size}
        </p>
        <p className="mt-1 truncate text-[10px] text-brand">{asset.story}</p>
      </div>
    </div>
  )
}
function AssetInspector({ asset, copied, onCopy, onClose, onDelete }) {
  if (!asset)
    return (
      <aside className="hidden min-h-96 rounded-3xl border border-line bg-surface p-6 text-center 2xl:block">
        <Image className="mx-auto mt-20 text-muted" />
        <p className="mt-3 text-sm text-muted">Chọn một tài nguyên để kiểm tra</p>
      </aside>
    )
  return (
    <aside className="rounded-3xl border border-line bg-surface p-5 2xl:sticky 2xl:top-24">
      <div className="flex items-start justify-between border-b border-line pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">
            Kiểm tra tài nguyên
          </p>
          <h2 className="mt-1 text-xl font-semibold">Chi tiết tài nguyên</h2>
        </div>
        <button onClick={onClose} aria-label="Đóng bảng kiểm tra">
          <X size={18} />
        </button>
      </div>
      <div
        className="mt-5 grid aspect-[4/3] place-items-center rounded-3xl text-4xl font-bold text-white"
        style={{ backgroundColor: asset.color }}
      >
        {asset.kind === 'audio' ? <FileAudio size={52} /> : asset.icon}
      </div>
      <h3 className="mt-4 truncate font-semibold">{asset.name}</h3>
      <div className="mt-5 space-y-3 rounded-2xl bg-elevated p-4 text-xs">
        <Detail label="Kích thước / Thời lượng" value={asset.dimensions} />
        <Detail label="Dung lượng tệp" value={asset.size} />
        <Detail
          label="Định dạng / MIME"
          value={asset.kind === 'audio' ? 'audio/wav (Không mất dữ liệu)' : 'image/png (Không mất dữ liệu)'}
        />
        <Detail label="Thời gian tải lên" value="14/10/2026 · 10:24" />
      </div>
      <div className="mt-5 rounded-2xl border border-line p-4">
        <p className="text-[10px] uppercase tracking-[.12em] text-muted">Liên kết xuất bản</p>
        <Badge tone="green" className="mt-3">
          {statusLabels[asset.status] ?? asset.status}
        </Badge>
        <p className="mt-3 flex items-center gap-2 text-xs">
          <Link2 size={14} className="text-brand" />
          {asset.story}
        </p>
      </div>
      <Button variant="secondary" onClick={onCopy} className="mt-5 w-full">
        <Copy size={15} />
        {copied ? 'Đã sao chép URL tài nguyên' : 'Sao chép URL tài nguyên'}
      </Button>
      <Button variant="ghost" onClick={onDelete} className="mt-2 w-full text-rose">
        <Trash2 size={15} />
        Xóa khỏi thư viện
      </Button>
    </aside>
  )
}
function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <strong className="text-right font-medium">{value}</strong>
    </div>
  )
}
