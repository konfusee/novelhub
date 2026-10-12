import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  FileAudio,
  FolderOpen,
  Grid2X2,
  Image,
  Link2,
  List,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { mediaAssets } from '../../data/mock/author';
import { useMockResource } from '../../context/MockDataContext';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui';

const filters = [
  { value: 'All Assets', label: 'Tất cả tài nguyên' },
  { value: 'Story Covers', label: 'Bìa truyện' },
  { value: 'Chapter Art & Maps', label: 'Minh họa chương và bản đồ' },
  { value: 'Audiobook Narration', label: 'Thuyết minh sách nói' },
];
const statusLabels = {
  'In Use': 'Đang sử dụng',
  Linked: 'Đã liên kết',
  Master: 'Bản gốc',
  Unused: 'Chưa sử dụng',
  Draft: 'Bản nháp',
  New: 'Mới',
};
const statusTones = {
  'In Use': 'green',
  Linked: 'purple',
  Master: 'orange',
  Unused: 'neutral',
  Draft: 'orange',
  New: 'purple',
};
const UNASSIGNED = 'Chưa gán';
const waveform = [35, 70, 45, 90, 55, 75, 40, 85, 60, 30, 70];

const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const assetUrl = (asset) =>
  `https://cdn.novelhub.vn/media/${asset.id}/${encodeURIComponent(asset.name)}`;

export function MediaLibraryPage() {
  const fileRef = useRef(null);
  const inspectorRef = useRef(null);
  const [assets, setAssets] = useState(mediaAssets);
  const [filter, setFilter] = useState('All Assets');
  const [query, setQuery] = useState('');
  const [story, setStory] = useState('All Stories');
  const [sort, setSort] = useState('Newest Uploads');
  const [view, setView] = useState('grid');
  const [selectedId, setSelectedId] = useState(mediaAssets[0].id);
  const [playing, setPlaying] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStory, setBulkStory] = useState('The Silent Forest');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const media = useMockResource('author:media', assets);
  const library = media.data;
  const selected =
    media.status === 'ready' ? (library.find((asset) => asset.id === selectedId) ?? null) : null;
  const stories = useMemo(
    () => [...new Set(library.map((asset) => asset.story))].filter((name) => name !== UNASSIGNED),
    [library],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map(({ value }) => [
          value,
          value === 'All Assets'
            ? library.length
            : library.filter((asset) => asset.type === value).length,
        ]),
      ),
    [library],
  );
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return library
      .filter(
        (asset) =>
          (filter === 'All Assets' || asset.type === filter) &&
          (story === 'All Stories' || asset.story === story) &&
          (!needle ||
            asset.name.toLowerCase().includes(needle) ||
            asset.story.toLowerCase().includes(needle)),
      )
      .sort((a, b) => (sort === 'Name A–Z' ? a.name.localeCompare(b.name) : b.id - a.id));
  }, [library, filter, query, story, sort]);
  const gridClass = `mt-5 grid gap-3 sm:gap-4 ${view === 'grid' ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3' : ''}`;
  const showCounts = media.status === 'ready' || media.status === 'empty';

  const select = (asset) => {
    setSelectedId(asset.id);
    setCopied(false);
    // Below xl the inspector stacks under the grid; bring it into view after selection.
    if (window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() =>
        inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  };
  const addFile = (file) => {
    if (!file) return;
    const isAudio = file.type.startsWith('audio');
    if (!isAudio && !file.type.startsWith('image')) {
      setUploadNotice({
        tone: 'error',
        text: `“${file.name}” không phải tệp hình ảnh hoặc âm thanh.`,
      });
      return;
    }
    const next = {
      id: Date.now(),
      name: file.name,
      type: isAudio ? 'Audiobook Narration' : 'Chapter Art & Maps',
      kind: isAudio ? 'audio' : 'image',
      color: isAudio ? 'var(--accent-orange)' : 'var(--accent-purple)',
      size: formatSize(file.size),
      dimensions: 'Đang chờ phân tích',
      story: UNASSIGNED,
      status: 'New',
      icon: 'NEW',
    };
    setAssets((current) => [next, ...current]);
    select(next);
    setUploadNotice({ tone: 'success', text: `Đã tải lên “${file.name}”.` });
  };
  const resetFilters = () => {
    setFilter('All Assets');
    setStory('All Stories');
    setQuery('');
  };
  const copyUrl = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard?.writeText(assetUrl(selected));
    } catch {
      // Clipboard can be unavailable (insecure context); the URL is still shown in the panel.
    }
    setCopied(true);
  };

  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <div className="nh-grid-12 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0">
            <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end xl:flex-col xl:items-start 2xl:flex-row 2xl:items-end">
              <div className="min-w-0">
                <p className="nh-eyebrow">Studio tác giả · Sản xuất</p>
                <h1 className="mt-3 text-h2 sm:text-h1">Thư viện media và tài nguyên</h1>
                <p className="mt-2 max-w-[60ch] text-sm leading-6 text-muted">
                  Quản lý bìa sách, minh họa nhân vật, bản đồ thế giới và tệp thu âm sách nói gốc.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setBulkOpen(true)} variant="secondary">
                  <FolderOpen size={16} aria-hidden="true" />
                  Sắp xếp hàng loạt
                </Button>
                <input
                  ref={fileRef}
                  onChange={(event) => {
                    addFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                  className="hidden"
                  type="file"
                  accept="image/*,audio/*"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <Button onClick={() => fileRef.current?.click()}>
                  <Upload size={16} aria-hidden="true" />
                  Tải media mới
                </Button>
              </div>
            </header>

            <Card className="mt-6 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                  <Cloud size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">Dung lượng lưu trữ tác giả</h2>
                    <Badge tone="purple">Hạng: Tác giả Pro</Badge>
                  </div>
                  <p className="mt-1 text-caption text-muted">
                    Phân phối CDN nhanh qua 14 điểm độc giả toàn cầu
                  </p>
                </div>
                <p className="sm:ml-auto sm:text-right">
                  <strong className="text-h3 tabular-nums">4,8 GB</strong>{' '}
                  <span className="text-sm text-muted">đã dùng trên 20 GB</span>
                </p>
              </div>
              <div
                role="img"
                aria-label="Đã dùng 4,8 GB trên 20 GB: hình ảnh 1,2 GB, âm thanh 3,6 GB"
                className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-ink/8"
              >
                <span className="w-[6%] rounded-full bg-brand" />
                <span className="w-[18%] rounded-full bg-orange" />
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                <li className="flex items-baseline gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  <span>
                    Hình ảnh và minh họa: <strong className="text-ink">1,2 GB</strong> (32 tệp)
                  </span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-orange" aria-hidden="true" />
                  <span>
                    Bản âm thanh và track thành phần: <strong className="text-ink">3,6 GB</strong>{' '}
                    (16 tệp)
                  </span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-ink/15" aria-hidden="true" />
                  <span>
                    Dung lượng trống: <strong className="text-ink">15,2 GB</strong>
                  </span>
                </li>
              </ul>
            </Card>

            <div className="mt-6 flex flex-col gap-3 border-b border-hairline pb-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Tabs
                    label="Lọc theo loại tài nguyên"
                    singleRow
                    value={filter}
                    onChange={setFilter}
                    items={filters.map((item) => ({
                      value: item.value,
                      label: showCounts ? `${item.label} (${counts[item.value]})` : item.label,
                    }))}
                  />
                </div>
                <div
                  role="group"
                  aria-label="Chế độ hiển thị"
                  className="flex shrink-0 gap-1 rounded-full border border-hairline bg-elevated p-1"
                >
                  {[
                    ['grid', 'Chế độ lưới', Grid2X2],
                    ['list', 'Chế độ danh sách', List],
                  ].map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setView(value)}
                      aria-label={label}
                      aria-pressed={view === value}
                      className={`grid size-9 place-items-center rounded-full transition-[background-color,color] duration-200 pointer-coarse:size-11 ${view === value ? 'bg-surface text-brand-strong shadow-whisper' : 'text-ink/70 hover:text-ink'}`}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  icon={Search}
                  type="search"
                  enterKeyHint="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm theo tên tệp hoặc truyện..."
                  aria-label="Tìm tài nguyên"
                  className="flex-1"
                />
                <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 md:flex">
                  <Select
                    aria-label="Lọc theo truyện"
                    value={story}
                    onChange={(event) => setStory(event.target.value)}
                  >
                    <option value="All Stories">Tất cả truyện</option>
                    {stories.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </Select>
                  <Select
                    aria-label="Sắp xếp"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                  >
                    <option value="Newest Uploads">Tải lên mới nhất</option>
                    <option value="Name A–Z">Tên A–Z</option>
                  </Select>
                </div>
              </div>
            </div>

            {media.status === 'loading' ? (
              <div aria-busy="true" aria-label="Đang tải tài nguyên" className={gridClass}>
                {Array.from({ length: 6 }, (_, index) => (
                  <AssetCardSkeleton key={index} view={view} />
                ))}
              </div>
            ) : media.status === 'error' ? (
              <Card className="mt-5 p-0">
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được thư viện media"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={media.retry} />}
                />
              </Card>
            ) : media.status === 'empty' ? (
              <Card className="mt-5 p-0">
                <EmptyState
                  icon={Image}
                  title="Thư viện media còn trống"
                  description="Tải lên bìa truyện, minh họa hoặc bản thu âm đầu tiên để dùng cho các chương."
                  action={
                    <Button size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload size={14} aria-hidden="true" />
                      Tải media mới
                    </Button>
                  }
                />
              </Card>
            ) : shown.length ? (
              <section aria-label="Danh sách tài nguyên" className={`nh-fade-enter ${gridClass}`}>
                {shown.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    selected={selected?.id === asset.id}
                    view={view}
                    playing={playing === asset.id}
                    onPlay={() => setPlaying((value) => (value === asset.id ? null : asset.id))}
                    onSelect={() => select(asset)}
                  />
                ))}
              </section>
            ) : (
              <Card className="mt-5 p-0">
                <EmptyState
                  icon={Image}
                  title="Không tìm thấy tài nguyên"
                  description="Thử từ khóa khác hoặc bỏ bộ lọc loại và truyện."
                  action={
                    <Button size="sm" variant="secondary" onClick={resetFilters}>
                      Xóa bộ lọc
                    </Button>
                  }
                />
              </Card>
            )}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFile(event.dataTransfer.files?.[0]);
              }}
              className={`mt-5 flex min-h-36 w-full flex-col items-center justify-center gap-2 whitespace-normal rounded-3xl border border-dashed px-6 py-8 text-center transition-[background-color,border-color] duration-200 ${dragging ? 'border-brand bg-brand-soft' : 'border-brand/50 hover:border-brand hover:bg-brand/5'}`}
            >
              <span
                className={`grid size-11 place-items-center rounded-2xl bg-brand/12 text-brand-strong transition-transform duration-[420ms] ${dragging ? '-translate-y-1 scale-105' : ''}`}
              >
                <Upload size={20} aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-brand-strong">
                {dragging ? 'Thả tệp để tải lên' : 'Thả tệp vào đây hoặc duyệt để tải lên'}
              </span>
              <span className="text-xs text-muted">Hình ảnh hoặc âm thanh, một tệp mỗi lần</span>
            </button>
            <p
              role="status"
              aria-live="polite"
              className={`mt-3 flex min-h-5 items-center gap-2 text-xs ${uploadNotice?.tone === 'error' ? 'text-rose-strong' : 'text-brand-strong'}`}
            >
              {uploadNotice && (
                <>
                  {uploadNotice.tone === 'error' ? (
                    <AlertTriangle size={14} aria-hidden="true" />
                  ) : (
                    <Check size={14} aria-hidden="true" />
                  )}
                  {uploadNotice.text}
                </>
              )}
            </p>
          </div>

          <div
            ref={inspectorRef}
            className="min-w-0 scroll-mt-[calc(var(--app-header-h)+1rem)] xl:sticky xl:top-24"
          >
            {media.status === 'loading' ? (
              <AssetInspectorSkeleton />
            ) : (
              <AssetInspector
                asset={selected}
                copied={copied}
                onCopy={copyUrl}
                onClose={() => setSelectedId(null)}
                onDelete={() => setConfirmDelete(true)}
              />
            )}
          </div>
        </div>

        <Modal open={bulkOpen} title="Sắp xếp hàng loạt" onClose={() => setBulkOpen(false)}>
          <p className="text-sm leading-6 text-muted">
            Gán {shown.length} tài nguyên đang hiển thị theo bộ lọc hiện tại cho một truyện.
          </p>
          <label htmlFor="bulk-story" className="mt-5 block text-sm font-semibold">
            Gán cho truyện
          </label>
          <Select
            id="bulk-story"
            className="mt-2 w-full"
            value={bulkStory}
            onChange={(event) => setBulkStory(event.target.value)}
          >
            {stories.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={!shown.length}
              onClick={() => {
                const ids = new Set(shown.map((asset) => asset.id));
                setAssets((current) =>
                  current.map((asset) =>
                    ids.has(asset.id) ? { ...asset, story: bulkStory } : asset,
                  ),
                );
                setBulkOpen(false);
              }}
            >
              <FolderOpen size={16} aria-hidden="true" />
              Gán {shown.length} tài nguyên
            </Button>
          </div>
        </Modal>

        <Modal
          open={confirmDelete && Boolean(selected)}
          title="Xóa tài nguyên?"
          onClose={() => setConfirmDelete(false)}
        >
          <p className="text-sm leading-6 text-muted">
            <strong className="break-all text-ink">{selected?.name}</strong> sẽ bị xóa khỏi thư viện
            và gỡ liên kết khỏi {selected?.story}.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setAssets((current) => current.filter((item) => item.id !== selected?.id));
                setSelectedId(null);
                setConfirmDelete(false);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Xóa khỏi thư viện
            </Button>
          </div>
        </Modal>
      </div>
    </AuthorLayout>
  );
}

function AssetPreview({ asset, large = false, children }) {
  if (asset.type === 'Story Covers') {
    return (
      <div className="relative grid h-full place-items-center bg-elevated p-4">
        <StoryCover
          story={{ title: asset.story, color: asset.color }}
          className={`aspect-[2/3] h-full max-h-full shadow-soft ${large ? 'rounded-2xl' : 'rounded-xl'}`}
        />
        {children}
      </div>
    );
  }
  const Icon = asset.kind === 'audio' ? FileAudio : Image;
  return (
    <div
      className="relative grid h-full place-items-center overflow-hidden text-white"
      style={{
        backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${asset.color} 78%, white), ${asset.color} 55%, color-mix(in oklab, ${asset.color} 70%, black))`,
      }}
    >
      {asset.kind === 'audio' ? (
        <div
          aria-hidden="true"
          className="absolute inset-x-5 bottom-4 flex h-1/3 items-end justify-between"
        >
          {waveform.map((height, index) => (
            <span
              key={index}
              className="w-1 rounded-full bg-white/70"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : (
        <span className="flex flex-col items-center gap-2" aria-hidden="true">
          <Icon size={large ? 40 : 28} className="opacity-85" />
          <span className="rounded-full bg-white/18 px-2.5 py-0.5 text-[11px] font-semibold tracking-[.12em]">
            {asset.icon}
          </span>
        </span>
      )}
      {children}
    </div>
  );
}

function AssetCard({ asset, selected, view, playing, onPlay, onSelect }) {
  const list = view === 'list';
  return (
    <article
      className={`group relative overflow-hidden rounded-3xl border bg-surface shadow-whisper transition-[transform,box-shadow,border-color] duration-[420ms] hover:-translate-y-0.5 hover:shadow-lift ${selected ? 'border-brand ring-2 ring-brand/20' : 'border-line'} ${list ? 'flex items-stretch' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Xem chi tiết ${asset.name}`}
        className="absolute inset-0 z-0 rounded-3xl"
      />
      <div
        className={`pointer-events-none relative ${list ? 'w-28 shrink-0 sm:w-36' : 'aspect-[4/3]'}`}
      >
        <AssetPreview asset={asset}>
          {asset.kind === 'audio' && (
            <button
              type="button"
              onClick={onPlay}
              aria-pressed={playing}
              className="pointer-events-auto relative z-10 grid size-12 place-items-center rounded-full bg-white/22 text-white ring-1 ring-white/40 transition-transform duration-200 hover:scale-105 active:scale-[0.96]"
              aria-label={playing ? `Tạm dừng ${asset.name}` : `Phát ${asset.name}`}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
          )}
          {selected && (
            <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-brand text-on-brand shadow-whisper">
              <Check size={14} aria-hidden="true" />
            </span>
          )}
        </AssetPreview>
      </div>
      <div className="pointer-events-none relative min-w-0 flex-1 p-4">
        <h3 className="truncate text-sm font-semibold" title={asset.name}>
          {asset.name}
        </h3>
        <p className="mt-1 text-xs text-muted tabular-nums">
          {asset.dimensions} · {asset.size}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Badge tone={statusTones[asset.status]}>
            {statusLabels[asset.status] ?? asset.status}
          </Badge>
          <span className="min-w-0 truncate text-xs font-medium text-brand-strong">
            {asset.story}
          </span>
        </div>
      </div>
    </article>
  );
}

function AssetInspector({ asset, copied, onCopy, onClose, onDelete }) {
  if (!asset)
    return (
      <Card as="aside" className="hidden p-0 xl:block">
        <EmptyState
          icon={Image}
          headingAs="h2"
          title="Chưa chọn tài nguyên"
          description="Chọn một tài nguyên để kiểm tra chi tiết và liên kết xuất bản."
        />
      </Card>
    );
  return (
    <Card as="aside" aria-label="Chi tiết tài nguyên" className="p-5">
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand-strong">Kiểm tra tài nguyên</p>
          <h2 className="mt-1 text-h3">Chi tiết tài nguyên</h2>
        </div>
        <IconButton label="Đóng bảng kiểm tra" shape="circle" size="sm" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
      <div className="mt-5 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-6 xl:block">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl">
            <AssetPreview asset={asset} large />
          </div>
          <h3 className="mt-4 break-words text-base font-semibold">{asset.name}</h3>
        </div>
        <div className="min-w-0">
          <dl className="mt-5 divide-y divide-hairline rounded-2xl bg-elevated px-4 text-xs md:mt-0 xl:mt-5">
            <Detail label="Kích thước / Thời lượng" value={asset.dimensions} />
            <Detail label="Dung lượng tệp" value={asset.size} />
            <Detail
              label="Định dạng / MIME"
              value={
                asset.kind === 'audio'
                  ? 'audio/wav (Không mất dữ liệu)'
                  : 'image/png (Không mất dữ liệu)'
              }
            />
            <Detail label="Thời gian tải lên" value="14/10/2026 · 10:24" />
          </dl>
          <div className="mt-4 rounded-2xl border border-hairline p-4">
            <p className="text-xs font-semibold text-ink/70">Liên kết xuất bản</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={statusTones[asset.status]}>
                {statusLabels[asset.status] ?? asset.status}
              </Badge>
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                <Link2 size={14} className="shrink-0 text-brand" aria-hidden="true" />
                <span className="truncate">{asset.story}</span>
              </span>
            </div>
          </div>
          <Button variant="secondary" onClick={onCopy} className="mt-5 w-full">
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied ? 'Đã sao chép URL tài nguyên' : 'Sao chép URL tài nguyên'}
          </Button>
          <Button variant="danger" onClick={onDelete} className="mt-2 w-full">
            <Trash2 size={16} aria-hidden="true" />
            Xóa khỏi thư viện
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-2.5">
      <dt className="text-ink/70">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
}

function AssetCardSkeleton({ view }) {
  const list = view === 'list';
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden rounded-3xl border border-line bg-surface shadow-whisper ${list ? 'flex items-stretch' : ''}`}
    >
      <Skeleton
        className={`rounded-none ${list ? 'w-28 shrink-0 sm:w-36' : 'aspect-[4/3] w-full'}`}
      />
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <Skeleton className="my-0.5 h-4 w-4/5" />
        <Skeleton className="mb-0.5 mt-1.5 h-3 w-2/5" />
        <div className="mt-3 flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </div>
  );
}

function AssetInspectorSkeleton() {
  return (
    <Card as="div" aria-busy="true" aria-label="Đang tải chi tiết tài nguyên" className="p-5">
      <div className="flex items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <Skeleton className="my-0.5 h-3 w-28" />
          <Skeleton className="mb-1 mt-2 h-5 w-40" />
        </div>
        <Skeleton className="size-9 shrink-0" />
      </div>
      <div className="mt-5 md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-6 xl:block">
        <div className="flex flex-col">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <Skeleton className="mb-1 mt-5 h-4 w-3/4" />
        </div>
        <div className="min-w-0">
          <div className="mt-5 divide-y divide-hairline rounded-2xl bg-elevated px-4 md:mt-0 xl:mt-5">
            {['w-28', 'w-20', 'w-24', 'w-24'].map((width, index) => (
              <div key={index} className="flex justify-between gap-3 py-2.5">
                <Skeleton className={`my-0.5 h-3 ${width}`} />
                <Skeleton className="my-0.5 h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-col rounded-2xl border border-hairline p-4">
            <Skeleton className="my-0.5 h-3 w-28" />
            <div className="mt-3 flex items-center gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          <Skeleton className="mt-5 h-11 w-full" />
          <Skeleton className="mt-2 h-11 w-full" />
        </div>
      </div>
    </Card>
  );
}
