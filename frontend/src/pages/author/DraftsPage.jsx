import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cloud,
  Copy,
  Eye,
  FilePlus2,
  Grid2X2,
  History,
  List,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  WandSparkles,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { authorDrafts } from '../../data/mock/author';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  ProgressBar,
  Reveal,
  Select,
  Skeleton,
  Tabs,
} from '../../components/ui';

const EDITOR_ROUTE = '/author/stories/demo/chapters/chapter-1/edit';
const WORDS_PER_MINUTE = 250;
const filterLabels = [
  ['All Drafts', 'Tất cả bản nháp'],
  ['Story Chapters', 'Chương truyện'],
  ['Standalone Concepts', 'Ý tưởng độc lập'],
  ['Ready for Review', 'Sẵn sàng xét duyệt'],
];
const matchesFilter = (draft, filter) =>
  filter === 'All Drafts' ||
  (filter === 'Story Chapters' && draft.type.includes('Chapter')) ||
  (filter === 'Standalone Concepts' && draft.type === 'Standalone Concept') ||
  (filter === 'Ready for Review' && draft.meta === 'Ready for Review');
const snapshots = [
  ['Hôm nay, 14:32', 'Chương 16: Ironwood Tree', 'Đã thêm 480 từ'],
  ['Hôm qua, 21:15', 'Echoes – Astrolabe', 'Đã đồng bộ kiểm tra ngữ pháp'],
  ['24/10, 09:40', 'Ý tưởng khoa học viễn tưởng #2', 'Đã lưu tiền đề ban đầu'],
  ['18/10, 17:02', 'Whispers Alternate', 'Đã tạo nhánh'],
];
const draftTypeLabels = {
  'Story Chapter': 'Chương truyện',
  'Chapter Draft': 'Bản nháp chương',
  'Standalone Concept': 'Ý tưởng độc lập',
  'Special Edition': 'Phiên bản đặc biệt',
};
const draftMetaLabels = {
  'Cloud Synced': 'Đã đồng bộ đám mây',
  'Synced to Cloud': 'Đã đồng bộ đám mây',
  'Tag: Worldbuilding': 'Thẻ: Xây dựng thế giới',
  'Ready for Review': 'Sẵn sàng xét duyệt',
};
const editedLabels = {
  Yesterday: 'Hôm qua',
  '12 mins ago': '12 phút trước',
  '3 days ago': '3 ngày trước',
  'Oct 18': '18/10',
};
const wordCount = (draft) => Number(String(draft.words).replace(/[^\d]/g, '')) || 0;
const formatNumber = (value) => value.toLocaleString('vi-VN');
const readMinutes = (words) =>
  Math.max(1, Math.round((words / WORDS_PER_MINUTE) * 10) / 10).toLocaleString('vi-VN');

export function DraftsPage() {
  const [filter, setFilter] = useState('All Drafts');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Last Edited');
  const [view, setView] = useState('grid');
  const [drafts, setDrafts] = useState(() =>
    authorDrafts.map((draft, order) => ({ ...draft, order })),
  );
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Bản thảo chưa đặt tên');
  const [newTouched, setNewTouched] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [restored, setRestored] = useState('');
  const draftsResource = useMockResource('author:drafts', drafts);
  const source = draftsResource.data;
  const ready = draftsResource.status === 'ready';

  const shown = useMemo(
    () =>
      source
        .filter(
          (draft) =>
            matchesFilter(draft, filter) &&
            `${draft.title} ${draft.story}`.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'Word Count'
            ? wordCount(b) - wordCount(a)
            : sort === 'Title'
              ? a.title.localeCompare(b.title)
              : a.order - b.order,
        ),
    [source, filter, query, sort],
  );
  const tabItems = filterLabels.map(([value, label]) => ({
    value,
    label: ready
      ? `${label} (${source.filter((draft) => matchesFilter(draft, value)).length})`
      : label,
  }));
  const newTitleError = newTouched && !newTitle.trim();

  const openNew = () => {
    setNewTitle('Bản thảo chưa đặt tên');
    setNewTouched(false);
    setNewOpen(true);
  };
  const addDraft = (event) => {
    event.preventDefault();
    setNewTouched(true);
    if (!newTitle.trim()) return;
    setDrafts((current) => [
      {
        ...authorDrafts[2],
        id: Date.now(),
        order: Math.min(...current.map((draft) => draft.order), 0) - 1,
        title: newTitle.trim(),
        excerpt: 'Bản thảo mới chưa có nội dung.',
        edited: 'Vừa xong',
        meta: 'Cloud Synced',
        words: '0',
        progress: 0,
      },
      ...current,
    ]);
    setFilter('All Drafts');
    setQuery('');
    setNewOpen(false);
  };
  const duplicate = (draft) =>
    setDrafts((current) => {
      const index = current.findIndex((item) => item.id === draft.id);
      const copy = {
        ...draft,
        id: Date.now(),
        order: draft.order + 0.5,
        title: `${draft.title} (bản sao)`,
        edited: 'Vừa xong',
      };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });

  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="nh-eyebrow">Kho bản thảo · Phiên soạn thảo trực tiếp</p>
            <h1 className="mt-3 text-h2 sm:text-h1">Bản nháp và bản thảo đang viết</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Quản lý chương chưa hoàn thiện, ý tưởng chưa gán truyện và lịch sử đồng bộ ngoại
              tuyến.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/author/import" variant="secondary">
              <Upload size={16} aria-hidden="true" />
              Nhập bản thảo
            </ButtonLink>
            <Button onClick={openNew}>
              <FilePlus2 size={16} aria-hidden="true" />
              Bản nháp mới
            </Button>
          </div>
        </header>

        <Card className="mt-6 p-4">
          <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
            <div className="min-w-0 max-w-full">
              <Tabs
                singleRow
                label="Lọc bản nháp"
                value={filter}
                onChange={setFilter}
                items={tabItems}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center 2xl:ml-auto">
              <Input
                icon={Search}
                type="search"
                enterKeyHint="search"
                aria-label="Tìm bản nháp"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm bản nháp, truyện..."
                className="sm:flex-1 2xl:w-64 2xl:flex-none"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Sắp xếp bản nháp"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="min-w-44 flex-1 sm:flex-none"
                >
                  <option value="Last Edited">Chỉnh sửa gần nhất</option>
                  <option value="Word Count">Số từ</option>
                  <option value="Title">Tiêu đề</option>
                </Select>
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
                      aria-label={label}
                      aria-pressed={view === value}
                      onClick={() => setView(value)}
                      className={`grid size-9 place-items-center rounded-full transition-[background-color,color] duration-200 pointer-coarse:size-11 ${view === value ? 'bg-brand text-on-brand' : 'text-ink/70 hover:bg-surface hover:text-ink'}`}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {draftsResource.status === 'loading' ? (
          <section
            aria-busy="true"
            aria-label="Đang tải bản nháp"
            className={`nh-grid-12 mt-6 grid gap-5 ${view === 'grid' ? 'nh-md-cols-2' : 'nh-cols-1'}`}
          >
            {[0, 1, 2, 3].map((item) => (
              <DraftCardSkeleton key={item} featured={item === 0 && view === 'grid'} />
            ))}
          </section>
        ) : draftsResource.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được bản nháp"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
              action={<RetryButton onClick={draftsResource.retry} />}
            />
          </Card>
        ) : draftsResource.status === 'empty' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={BookOpen}
              title="Chưa có bản nháp nào"
              description="Tạo bản nháp đầu tiên hoặc nhập bản thảo từ tệp PDF."
              action={
                <Button size="sm" onClick={openNew}>
                  <FilePlus2 size={14} aria-hidden="true" />
                  Bản nháp mới
                </Button>
              }
            />
          </Card>
        ) : shown.length ? (
          <section
            aria-label="Danh sách bản nháp"
            className={`nh-fade-enter nh-grid-12 mt-6 grid gap-5 ${view === 'grid' ? 'nh-md-cols-2' : 'nh-cols-1'}`}
          >
            {shown.map((draft, index) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                featured={index === 0 && view === 'grid'}
                onPreview={() => setPreviewing(draft)}
                onDuplicate={() => duplicate(draft)}
                onDelete={() => setDeleting(draft)}
              />
            ))}
          </section>
        ) : (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={Search}
              title="Không tìm thấy bản nháp"
              description="Hãy thử bộ lọc khác hoặc tạo bản thảo mới."
              action={
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFilter('All Drafts');
                      setQuery('');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                  <Button size="sm" onClick={openNew}>
                    <FilePlus2 size={14} aria-hidden="true" />
                    Bản nháp mới
                  </Button>
                </>
              }
            />
          </Card>
        )}

        <Reveal>
          <Card className="mt-8">
            <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-5 md:flex-row md:items-center">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-h3">
                  <History size={20} className="shrink-0 text-brand" />
                  Tự động lưu và lịch sử phiên bản đám mây
                </h2>
                <p className="mt-1 max-w-[65ch] text-sm text-muted">
                  Khôi phục nội dung bị mất, so sánh các bản lưu theo thời gian và phục hồi nhánh
                  bản thảo trong 30 ngày gần nhất.
                </p>
              </div>
              <div className="w-full shrink-0 md:w-56">
                <p className="flex justify-between text-xs text-muted">
                  <span>Bộ nhớ đám mây</span>
                  <span className="tabular-nums">14,2 MB / 500 MB</span>
                </p>
                <ProgressBar
                  value={14.2}
                  max={500}
                  size="sm"
                  label="Dung lượng bộ nhớ đám mây đã dùng"
                  className="mt-2"
                />
              </div>
            </div>
            <ul className="nh-grid-12 mt-5 grid gap-3 nh-sm-cols-2 nh-xl-cols-4">
              {snapshots.map(([date, title, note]) => {
                const done = restored === title;
                return (
                  <li
                    key={title}
                    className="flex flex-col rounded-2xl border border-hairline bg-elevated p-4"
                  >
                    <span className="text-xs text-ink/70">{date}</span>
                    <strong className="mt-1.5 text-sm">{title}</strong>
                    <p className="mt-1 text-xs text-ink/70">{note}</p>
                    <Button
                      variant={done ? 'outline' : 'ghost'}
                      size="sm"
                      onClick={() => setRestored(title)}
                      disabled={done}
                      className="mt-4 self-start px-3"
                    >
                      {done ? (
                        <CheckCircle2 size={14} aria-hidden="true" />
                      ) : (
                        <History size={14} aria-hidden="true" />
                      )}
                      {done ? 'Đã khôi phục bản lưu' : 'Khôi phục bản lưu'}
                    </Button>
                  </li>
                );
              })}
            </ul>
            <p role="status" className="sr-only">
              {restored ? `Đã khôi phục bản lưu ${restored}.` : ''}
            </p>
          </Card>
        </Reveal>

        <Modal open={newOpen} title="Tạo bản nháp mới" onClose={() => setNewOpen(false)}>
          <form noValidate onSubmit={addDraft}>
            <p className="text-sm text-muted">
              Bắt đầu một bản thảo chưa gán. Bạn có thể gắn bản thảo vào truyện sau.
            </p>
            <label htmlFor="new-draft-title" className="mt-5 block text-sm font-semibold">
              Tên bản nháp
            </label>
            <Input
              id="new-draft-title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              onBlur={() => setNewTouched(true)}
              maxLength={120}
              aria-invalid={newTitleError}
              aria-describedby={newTitleError ? 'new-draft-error' : undefined}
              className="mt-2"
            />
            {newTitleError && (
              <p id="new-draft-error" className="mt-2 text-xs text-rose-strong">
                Hãy nhập tên cho bản nháp.
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                Hủy
              </Button>
              <Button type="submit">
                <FilePlus2 size={16} aria-hidden="true" />
                Tạo bản nháp
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={Boolean(previewing)}
          title="Xem trước bản nháp"
          onClose={() => setPreviewing(null)}
          className="max-w-2xl"
        >
          {previewing && (
            <article>
              <p className="text-xs font-semibold text-brand-strong">Truyện: {previewing.story}</p>
              <h3 className="mt-2 text-h3">{previewing.title}</h3>
              <p className="mt-4 rounded-2xl bg-reader p-5 text-base leading-8 text-ink">
                {previewing.excerpt}
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setPreviewing(null)}>
                  Đóng
                </Button>
                <ButtonLink to={EDITOR_ROUTE}>
                  <WandSparkles size={16} aria-hidden="true" />
                  Tiếp tục chỉnh sửa
                </ButtonLink>
              </div>
            </article>
          )}
        </Modal>

        <Modal open={Boolean(deleting)} title="Xóa bản nháp?" onClose={() => setDeleting(null)}>
          {deleting && (
            <>
              <p className="text-sm leading-6 text-muted">
                Bản nháp <strong className="text-ink">“{deleting.title}”</strong> sẽ bị xóa khỏi
                danh sách. Thao tác này không thể hoàn tác.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setDeleting(null)}>
                  Giữ lại
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setDrafts((current) => current.filter((item) => item.id !== deleting.id));
                    setDeleting(null);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Xóa bản nháp
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </AuthorLayout>
  );
}

function DraftCard({ draft, featured, onPreview, onDuplicate, onDelete }) {
  const words = wordCount(draft);
  const synced = draft.meta.includes('Cloud');
  const ready = draft.meta === 'Ready for Review';
  return (
    <Card as="article" className={`flex flex-col ${featured ? 'md:min-h-96' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={draft.tone}>{draftTypeLabels[draft.type] ?? draft.type}</Badge>
        {synced && (
          <Badge>
            <Cloud size={12} aria-hidden="true" />
            Đã đồng bộ đám mây
          </Badge>
        )}
        {ready && (
          <Badge tone="green">
            <CheckCircle2 size={12} aria-hidden="true" />
            Sẵn sàng xét duyệt
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted">
          Sửa lần cuối: {editedLabels[draft.edited] ?? draft.edited}
        </span>
      </div>
      <p className="mt-5 flex items-center gap-2 text-xs font-semibold text-brand-strong">
        <BookOpen size={14} aria-hidden="true" />
        Truyện: {draft.story}
      </p>
      <h2 className={`mt-2 ${featured ? 'text-h2' : 'text-h3'}`}>{draft.title}</h2>
      <p className="mt-3 line-clamp-3 max-w-[65ch] text-sm leading-6 text-muted">{draft.excerpt}</p>
      {!synced && !ready && (
        <p className="mt-2 text-xs text-muted">{draftMetaLabels[draft.meta] ?? draft.meta}</p>
      )}
      <dl className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-hairline bg-elevated p-4">
        <div>
          <dt className="text-xs text-ink/70">Số từ</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatNumber(words)} từ</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/70">Thời lượng đọc</dt>
          <dd className="text-sm font-semibold tabular-nums">~{readMinutes(words)} phút</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/70">Mục tiêu</dt>
          <dd className="text-sm font-semibold text-brand-strong tabular-nums">
            {draft.progress}%
          </dd>
        </div>
        <ProgressBar
          value={draft.progress}
          size="sm"
          label={`Tiến độ mục tiêu của ${draft.title}`}
          className="col-span-3"
        />
      </dl>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-hairline pt-5">
          <IconButton label={`Nhân bản ${draft.title}`} size="sm" onClick={onDuplicate}>
            <Copy size={16} />
          </IconButton>
          <IconButton label={`Xóa ${draft.title}`} size="sm" tone="rose" onClick={onDelete}>
            <Trash2 size={16} />
          </IconButton>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onPreview}>
              <Eye size={14} aria-hidden="true" />
              Xem trước
            </Button>
            <ButtonLink to={EDITOR_ROUTE} size="sm">
              <WandSparkles size={14} aria-hidden="true" />
              Tiếp tục chỉnh sửa
            </ButtonLink>
          </div>
        </div>
      </div>
    </Card>
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

function DraftCardSkeleton({ featured }) {
  return (
    <Card as="div" aria-hidden="true" className={`flex flex-col ${featured ? 'md:min-h-96' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="ml-auto h-3 w-32" />
      </div>
      <Skeleton className="mt-5 h-3 w-40" />
      <Skeleton className={`mt-2 w-3/5 ${featured ? 'my-1.5 h-6' : 'my-1 h-5'}`} />
      <div className="mt-3 max-w-[65ch]">
        <Skeleton className="mt-1.5 h-3 w-full" />
        <Skeleton className="mt-3 h-3 w-11/12" />
        <Skeleton className="mb-1.5 mt-3 h-3 w-2/3" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-hairline bg-elevated p-4">
        {[0, 1, 2].map((item) => (
          <div key={item}>
            <Skeleton className="mt-0.5 h-3 w-16" />
            <Skeleton className="mb-1 mt-2.5 h-3.5 w-20" />
          </div>
        ))}
        <Skeleton className="col-span-3 h-1.5 w-full" />
      </div>
      <div className="mt-auto pt-5">
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-hairline pt-5">
          <Skeleton className="size-9 rounded-2xl" />
          <Skeleton className="size-9 rounded-2xl" />
          <div className="ml-auto flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-44" />
          </div>
        </div>
      </div>
    </Card>
  );
}
