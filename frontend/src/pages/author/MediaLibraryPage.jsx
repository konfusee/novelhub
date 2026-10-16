import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  FolderOpen,
  Grid2X2,
  Image,
  Link2,
  List,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { useBackendDocument } from '../../api/useBackendResource';
import { apiRequest, API_BASE } from '../../api/client';
import { useLocale } from '../../context/LocaleContext';
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

const formatSize = (bytes) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const assetUrl = (asset) =>
  asset.url ? new URL(`${API_BASE}${asset.url}`, window.location.origin).href : '';
const emptyMedia = { items: [], stories: [], stats: { bytes: 0, count: 0 }, nextCursor: null };

export function MediaLibraryPage() {
  const { t } = useLocale();
  const [cursor, setCursor] = useState('');
  const [previous, setPrevious] = useState([]);
  const resource = useBackendDocument(
    `/author/media${cursor ? `?cursor=${cursor}` : ''}`,
    emptyMedia,
  );
  const media = {
    ...resource,
    status:
      resource.status === 'ready' && !previous.length && !resource.data.items.length
        ? 'empty'
        : resource.status,
  };
  const reload = () => {
    setPrevious([]);
    setCursor('');
    resource.retry();
  };
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [kind, setKind] = useState('image');
  const [uploadStory, setUploadStory] = useState('');
  const fileRef = useRef(null);
  const inspectorRef = useRef(null);
  const [filter, setFilter] = useState('All Assets');
  const [query, setQuery] = useState('');
  const [story, setStory] = useState('All Stories');
  const [sort, setSort] = useState('Newest Uploads');
  const [view, setView] = useState('grid');
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [bulkItems, setBulkItems] = useState(null);
  const [bulkStory, setBulkStory] = useState('');
  const [bulkError, setBulkError] = useState('');

  const library = useMemo(
    () =>
      [...previous, ...resource.data.items].map((asset) => ({
        ...asset,
        type: asset.kind === 'cover' ? 'Story Covers' : 'Chapter Art & Maps',
        kind: 'image',
        color: 'var(--primary)',
        icon: 'IMG',
        size: asset.sizeBytes == null ? '—' : formatSize(asset.sizeBytes),
        dimensions: asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—',
        story:
          resource.data.stories.find((item) => item.id === asset.storyId)?.title ??
          (asset.storyId ? t('mediaData.associatedStory') : UNASSIGNED),
        status: t('mediaData.stored'),
      })),
    [previous, resource.data, t],
  );
  const selected =
    media.status === 'ready' ? (library.find((asset) => asset.id === selectedId) ?? null) : null;
  const stories = resource.data.stories;
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
          (story === 'All Stories' || asset.storyId === story) &&
          (!needle ||
            asset.name.toLowerCase().includes(needle) ||
            asset.story.toLowerCase().includes(needle)),
      )
      .sort((a, b) =>
        sort === 'Name A–Z' ? a.name.localeCompare(b.name) : b.id.localeCompare(a.id),
      );
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
  const addFile = async (file) => {
    if (!file || busyRef.current) return;
    if (!/\.(png|jpe?g|webp)$/iu.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) {
      setUploadNotice({ tone: 'error', text: t('mediaData.invalidFile') });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setUploadNotice(null);
    try {
      const query = new URLSearchParams({
        name: file.name,
        kind,
        ...(uploadStory ? { storyId: uploadStory } : {}),
      });
      const result = await apiRequest(`/author/media?${query}`, {
        method: 'POST',
        body: file,
        binary: true,
      });
      setSelectedId(result.asset.id);
      reload();
      setUploadNotice({ tone: 'success', text: t('mediaData.uploaded') });
    } catch (failure) {
      setUploadNotice({ tone: 'error', text: failure.message });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const resetFilters = () => {
    setFilter('All Assets');
    setStory('All Stories');
    setQuery('');
  };
  const copyUrl = async () => {
    if (!selected) return;
    try {
      if (!navigator.clipboard || !assetUrl(selected)) throw new Error(t('mediaData.copyError'));
      await navigator.clipboard.writeText(assetUrl(selected));
    } catch {
      setUploadNotice({ tone: 'error', text: t('mediaData.copyError') });
      return;
    }
    setCopied(true);
  };
  const remove = async () => {
    setDeleteError('');
    if (!selected || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await apiRequest(`/author/media/${selected.id}/delete`, {
        method: 'POST',
        body: { expectedVersion: selected.version },
      });
      setConfirmDelete(false);
      setSelectedId(null);
      reload();
      setUploadNotice({ tone: 'success', text: t('mediaData.deleted') });
    } catch (failure) {
      setDeleteError(failure.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const organize = async () => {
    if (!bulkItems?.length || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setBulkError('');
    try {
      const result = await apiRequest('/author/media/organize', {
        method: 'POST',
        body: {
          storyId: bulkStory || null,
          items: bulkItems.map(({ id, version }) => ({ id, expectedVersion: version })),
        },
      });
      setBulkItems(null);
      reload();
      setUploadNotice({
        tone: 'success',
        text: t('mediaData.organized', { count: result.changed }),
      });
    } catch (failure) {
      setBulkError(failure.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
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
                  {t('mediaData.description')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !showCounts || !shown.length || shown.length > 100}
                  title={t('mediaData.bulkLimit')}
                  onClick={() => {
                    setBulkItems(shown.map(({ id, version, name }) => ({ id, version, name })));
                    setBulkStory(
                      shown.every((item) => item.storyId === shown[0].storyId) &&
                        stories.some((item) => item.id === shown[0].storyId)
                        ? shown[0].storyId
                        : '',
                    );
                    setBulkError('');
                  }}
                  variant="secondary"
                >
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
                  accept="image/png,image/jpeg,image/webp"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <Button disabled={busy} onClick={() => fileRef.current?.click()}>
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
                    <h2 className="text-base font-semibold">{t('mediaData.storage')}</h2>
                    <Badge tone="purple">{t('mediaData.private')}</Badge>
                  </div>
                  <p className="mt-1 text-caption text-muted">{t('mediaData.storageHint')}</p>
                </div>
                <p className="sm:ml-auto sm:text-right">
                  <strong className="text-h3 tabular-nums">
                    {showCounts ? formatSize(resource.data.stats.bytes) : '—'}
                  </strong>{' '}
                  <span className="text-sm text-muted">{t('mediaData.activeImages')}</span>
                </p>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                <li className="flex items-baseline gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  <span>
                    {t('mediaData.total', { count: showCounts ? resource.data.stats.count : '—' })}
                  </span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-orange" aria-hidden="true" />
                  <span>{t('mediaData.audioUnavailable')}</span>
                </li>
                <li className="flex items-baseline gap-2">
                  <span className="size-2 shrink-0 rounded-full bg-ink/15" aria-hidden="true" />
                  <span>{t('mediaData.limit')}</span>
                </li>
              </ul>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  {t('mediaData.kind')}
                  <Select
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    disabled={busy}
                    className="mt-2 w-full"
                  >
                    <option value="image">{t('mediaData.image')}</option>
                    <option value="cover">{t('mediaData.cover')}</option>
                    <option value="banner">{t('mediaData.banner')}</option>
                  </Select>
                </label>
                <label className="text-sm font-semibold">
                  {t('mediaData.story')}
                  <Select
                    value={uploadStory}
                    onChange={(event) => setUploadStory(event.target.value)}
                    disabled={busy || resource.status === 'loading'}
                    className="mt-2 w-full"
                  >
                    <option value="">{t('mediaData.unassigned')}</option>
                    {stories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
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
                    {stories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
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
                  description={t('mediaData.emptyHint')}
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
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted">
                {t('mediaData.loaded', {
                  count: library.length,
                  total: showCounts ? resource.data.stats.count : '—',
                })}
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || resource.status === 'loading'}
                onClick={reload}
              >
                {t('mediaData.refresh')}
              </Button>
              {resource.data.nextCursor && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setPrevious([...previous, ...resource.data.items]);
                    setCursor(resource.data.nextCursor);
                  }}
                >
                  {t('mediaData.more')}
                </Button>
              )}
            </div>

            <button
              type="button"
              disabled={busy}
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
              <span className="text-xs text-muted">
                {t(busy ? 'mediaData.uploading' : 'mediaData.limit')}
              </span>
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
                onDelete={() => {
                  setDeleteError('');
                  setConfirmDelete(true);
                }}
                busy={busy}
              />
            )}
          </div>
        </div>

        <Modal
          open={Boolean(bulkItems)}
          title={t('mediaData.bulkTitle')}
          onClose={() => {
            if (!busy) setBulkItems(null);
          }}
        >
          <p className="text-sm leading-6 text-muted">
            {t('mediaData.bulkHint', { count: bulkItems?.length ?? 0 })}
          </p>
          <ul className="mt-3 max-h-40 overflow-y-auto rounded-2xl bg-elevated p-3 text-sm">
            {bulkItems?.map((item) => (
              <li key={item.id} className="break-all py-1">
                {item.name}
              </li>
            ))}
          </ul>
          <label className="mt-4 block text-sm font-semibold">
            {t('mediaData.bulkDestination')}
            <Select
              className="mt-2 w-full"
              value={bulkStory}
              disabled={busy}
              onChange={(event) => setBulkStory(event.target.value)}
            >
              <option value="">{t('mediaData.unassigned')}</option>
              {stories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </label>
          {bulkError && (
            <p role="alert" className="mt-3 text-sm text-rose-strong">
              {bulkError}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setBulkItems(null)}>
              {t('mediaData.cancel')}
            </Button>
            <Button disabled={busy || !bulkItems?.length} onClick={organize}>
              {t(busy ? 'mediaData.organizing' : 'mediaData.organize')}
            </Button>
          </div>
        </Modal>

        <Modal
          open={confirmDelete && Boolean(selected)}
          title="Xóa tài nguyên?"
          onClose={() => {
            if (!busy) setConfirmDelete(false);
          }}
        >
          <p className="text-sm leading-6 text-muted">
            <strong className="break-all text-ink">{selected?.name}</strong>
            <span className="mt-2 block">{t('mediaData.deleteHint')}</span>
          </p>
          {deleteError && (
            <p role="alert" className="mt-3 text-sm text-rose-strong">
              {deleteError}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button disabled={busy} variant="secondary" onClick={() => setConfirmDelete(false)}>
              Hủy
            </Button>
            <Button variant="danger" disabled={busy} onClick={remove}>
              <Trash2 size={16} aria-hidden="true" />
              Xóa khỏi thư viện
            </Button>
          </div>
        </Modal>
      </div>
    </AuthorLayout>
  );
}

function AssetPreview({ asset, children }) {
  const { t } = useLocale();
  const [failedUrl, setFailedUrl] = useState(null);
  const url = assetUrl(asset);
  return (
    <div className="relative grid h-full place-items-center bg-elevated">
      {url && failedUrl !== url ? (
        <img
          src={url}
          alt={asset.name}
          loading="lazy"
          onError={() => setFailedUrl(url)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="flex flex-col items-center gap-2 p-4 text-center text-xs text-muted">
          <Image size={28} aria-hidden="true" />
          {t('mediaData.unavailable')}
        </span>
      )}
      {children}
    </div>
  );
}

function AssetCard({ asset, selected, view, onSelect }) {
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

function AssetInspector({ asset, copied, onCopy, onClose, onDelete, busy }) {
  const { t } = useLocale();
  if (!asset)
    return (
      <Card as="aside" className="hidden p-0 xl:block">
        <EmptyState
          icon={Image}
          headingAs="h2"
          title="Chưa chọn tài nguyên"
          description={t('mediaData.inspectHint')}
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
            <Detail label="Định dạng / MIME" value={asset.contentType ?? '—'} />
            <Detail
              label="Thời gian tải lên"
              value={asset.createdAt ? new Date(asset.createdAt).toLocaleString('vi-VN') : '—'}
            />
          </dl>
          <div className="mt-4 rounded-2xl border border-hairline p-4">
            <p className="text-xs font-semibold text-ink/70">{t('mediaData.grouping')}</p>
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
          <p className="mt-3 text-xs text-muted">{t('mediaData.privateUrl')}</p>
          <Button
            disabled={busy || !asset.url}
            variant="secondary"
            onClick={onCopy}
            className="mt-5 w-full"
          >
            {copied ? (
              <Check size={16} aria-hidden="true" />
            ) : (
              <Copy size={16} aria-hidden="true" />
            )}
            {copied ? 'Đã sao chép URL tài nguyên' : 'Sao chép URL tài nguyên'}
          </Button>
          <Button disabled={busy} variant="danger" onClick={onDelete} className="mt-2 w-full">
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
