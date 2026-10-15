import { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  GitMerge,
  Import,
  Plus,
  RefreshCw,
  Scissors,
  ShieldCheck,
  Upload,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
  Tabs,
} from '../../components/ui';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const initialChapters = [
  ['Chapter 1: The Harbor Gate', 'tr. 4–18', 3400],
  ["Chapter 2: The Alchemist's Lantern", 'tr. 19–35', 4120],
  ['Chapter 3: Beneath the Obsidian Arch', 'tr. 36–51', 3890],
  ['Chapter 4: The Whispering Keel', 'tr. 52–68', 4450],
  ['Chapter 5: Songs of the Low Tide', 'tr. 69–84', 4030],
];
const freshChapters = () =>
  initialChapters.map(([title, pages, words], index) => ({
    id: index + 1,
    title,
    pages,
    words,
    selected: true,
  }));
const steps = [
  'Tải PDF lên',
  'Nhận diện cấu trúc và chương',
  'Kiểm tra cách tách chương',
  'Nhập thành bản nháp',
];
/* The author's existing stories an import can be appended to (server data). */
const targetStories = [
  { value: 'the-silent-forest', title: 'The Silent Forest', note: 'Truyện dài kỳ' },
];
const NEW_STORY_TITLE = 'Chronicles of the Sunken Spire';
const formatNumber = (value) => value.toLocaleString('vi-VN');

export function ImportPdfPage() {
  const stories = useMockResource('author:import-targets', targetStories);
  const fileRef = useRef(null);
  const [stage, setStage] = useState('review');
  const [fileName, setFileName] = useState('Chronicles of the Sunken Spire.pdf');
  const [fileError, setFileError] = useState('');
  const [chapters, setChapters] = useState(freshChapters);
  const [active, setActive] = useState(1);
  const [destination, setDestination] = useState('new');
  const [view, setView] = useState('split');
  const selected = chapters.filter((chapter) => chapter.selected);
  const selectedWords = selected.reduce((sum, chapter) => sum + chapter.words, 0);
  const step = stage === 'upload' ? 1 : stage === 'done' ? 4 : 3;
  /* An existing story is only a valid target once the list has loaded and still contains it. */
  const targetStory =
    stories.status === 'ready' ? stories.data.find((story) => story.value === destination) : null;
  const target = targetStory ? targetStory.value : 'new';

  const acceptFile = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Chỉ hỗ trợ tệp PDF.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setFileError('Tệp vượt quá 50 MB. Hãy tách bản thảo thành nhiều tệp nhỏ hơn.');
      return;
    }
    setFileError('');
    setFileName(file.name);
    setChapters(freshChapters());
    setActive(1);
    setStage('review');
  };
  const chooseFile = (event) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = '';
  };
  const updateChapter = (id, patch) =>
    setChapters((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const splitAfter = (id) =>
    setChapters((current) => {
      const index = current.findIndex((item) => item.id === id);
      const source = current[index];
      const half = Math.round(source.words / 2);
      const next = {
        id: Date.now(),
        title: 'Phần tách mới chưa đặt tên',
        pages: `Tách từ ${source.pages}`,
        words: source.words - half,
        selected: true,
      };
      return [
        ...current.slice(0, index),
        { ...source, words: half },
        next,
        ...current.slice(index + 1),
      ];
    });
  const mergeNext = (id) =>
    setChapters((current) => {
      const index = current.findIndex((item) => item.id === id);
      const source = current[index];
      const following = current[index + 1];
      if (!following) return current;
      const merged = {
        ...source,
        pages: `${source.pages.split('–')[0]}–${following.pages.split('–').pop()}`,
        words: source.words + following.words,
      };
      return [...current.slice(0, index), merged, ...current.slice(index + 2)];
    });
  const addSplit = () =>
    setChapters((current) => [
      ...current,
      {
        id: Date.now(),
        title: `Chương ${current.length + 1}: Phần chưa đặt tên`,
        pages: 'Tách thủ công',
        words: 0,
        selected: true,
      },
    ]);
  const runImport = () => {
    setStage('importing');
    window.setTimeout(() => setStage('done'), 1000);
  };

  return (
    <AuthorLayout>
      <div className="page-author py-6 lg:py-8">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <ButtonLink
                to="/author/drafts"
                variant="secondary"
                size="sm"
                aria-label="Quay lại bản nháp"
                className="mt-0.5 w-9 shrink-0 px-0 pointer-coarse:w-11"
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </ButtonLink>
              <div className="min-w-0">
                <h1 className="text-h2 sm:text-h1">Nhập bản thảo từ PDF</h1>
                <p className="mt-1 max-w-[65ch] text-sm text-muted">
                  Chuyển PDF đã định dạng thành các chương số có cấu trúc, có thể chỉnh sửa và sẵn
                  sàng đăng dài kỳ.
                </p>
              </div>
            </div>
            <Badge className="self-start whitespace-normal">
              <ShieldCheck size={14} aria-hidden="true" className="shrink-0 text-brand" />
              Bản thảo chỉ được lưu cục bộ trong bản xem trước này
            </Badge>
          </div>
          <ol className="nh-grid-12 mt-6 grid gap-4 border-t border-hairline pt-5 nh-sm-cols-2 nh-xl-cols-4">
            {steps.map((label, index) => {
              const number = index + 1;
              const done = number < step || (number === 4 && stage === 'done');
              const current = number === step && !done;
              return (
                <li
                  key={label}
                  aria-current={current ? 'step' : undefined}
                  className="flex items-center gap-3"
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold ${done ? 'border-brand/40 bg-brand/12 text-brand-strong' : current ? 'border-brand bg-brand text-on-brand' : 'border-line text-muted'}`}
                  >
                    {done ? <Check size={16} aria-hidden="true" /> : number}
                  </span>
                  <span className="min-w-0">
                    <small className="block text-xs text-muted">
                      Bước {number}
                      {current ? ' · Đang thực hiện' : done ? ' · Hoàn tất' : ''}
                    </small>
                    <strong className={`text-sm ${current ? 'text-brand-strong' : ''}`}>
                      {label}
                    </strong>
                  </span>
                </li>
              );
            })}
          </ol>
          <ProgressBar
            value={stage === 'done' ? 4 : step - 1}
            max={4}
            size="sm"
            label="Tiến độ nhập bản thảo"
            className="mt-5"
          />
        </Card>

        <input
          ref={fileRef}
          onChange={chooseFile}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          tabIndex={-1}
          aria-hidden="true"
        />

        {stage === 'upload' ? (
          <UploadStage
            onPick={() => fileRef.current?.click()}
            onDropFile={acceptFile}
            error={fileError}
          />
        ) : stage === 'done' ? (
          <Card className="mt-6 p-0" role="status">
            <EmptyState
              icon={CheckCircle2}
              title={`Đã nhập ${selected.length} chương vào bản nháp`}
              description={`${formatNumber(selectedWords)} từ từ “${fileName}” đã sẵn sàng để chỉnh sửa trong ${targetStory ? targetStory.title : `truyện mới ${NEW_STORY_TITLE}`}.`}
              action={
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStage('upload');
                      setFileError('');
                    }}
                  >
                    <Upload size={16} aria-hidden="true" />
                    Nhập tệp khác
                  </Button>
                  <ButtonLink to="/author/drafts" trailingIcon={ChevronRight}>
                    Mở bản nháp
                  </ButtonLink>
                </>
              }
            />
          </Card>
        ) : (
          <>
            <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-7-5">
              <Card as="section" aria-labelledby="detected-heading" className="min-w-0 p-4 sm:p-6">
                <div className="flex flex-col gap-3 rounded-2xl bg-elevated p-4 sm:flex-row sm:items-center">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                    <FileText size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{fileName}</strong>
                    <p className="text-xs text-ink/70">
                      184 trang · 62.400 từ · Chất lượng OCR: 99,4%
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    className="self-start sm:self-auto"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    Chọn tệp khác
                  </Button>
                </div>
                <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h2 id="detected-heading" className="text-h3">
                      Chương và cấu trúc đã nhận diện
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Đã nhận diện {chapters.length} chương bằng tiêu đề và bộ phân tích số La Mã.
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={selected.length === chapters.length}
                      onClick={() =>
                        setChapters((current) =>
                          current.map((item) => ({ ...item, selected: true })),
                        )
                      }
                      className="text-brand-strong"
                    >
                      Chọn tất cả ({chapters.length})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!selected.length}
                      onClick={() =>
                        setChapters((current) =>
                          current.map((item) => ({ ...item, selected: false })),
                        )
                      }
                    >
                      Bỏ chọn
                    </Button>
                  </div>
                </div>
                <ul className="mt-5 max-h-[690px] space-y-3 overflow-y-auto pr-1">
                  {chapters.map((chapter, index) => (
                    <ChapterDetection
                      key={chapter.id}
                      chapter={chapter}
                      index={index}
                      active={active === chapter.id}
                      isLast={index === chapters.length - 1}
                      onActive={() => setActive(chapter.id)}
                      onToggle={() => updateChapter(chapter.id, { selected: !chapter.selected })}
                      onTitle={(title) => updateChapter(chapter.id, { title })}
                      onSplit={() => splitAfter(chapter.id)}
                      onMerge={() => mergeNext(chapter.id)}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addSplit}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-brand/60 p-4 text-sm font-semibold text-brand-strong transition-colors duration-200 hover:bg-brand/8"
                >
                  <Plus size={16} aria-hidden="true" />
                  Thêm dấu tách chương thủ công
                </button>
              </Card>
              <ExtractionInspector
                view={view}
                setView={setView}
                title={chapters.find((item) => item.id === active)?.title || 'Chưa chọn chương'}
              />
            </div>

            <Card className="mt-6 p-4 sm:p-6">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <h2 id="destination-heading" className="text-h3">
                    Nơi lưu nội dung
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Chọn cách đưa các chương đã phân tích vào danh mục NovelHub của bạn.
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-labelledby="destination-heading"
                  className="nh-grid-12 grid gap-3 nh-sm-cols-2 lg:w-3/5"
                >
                  <DestinationOption
                    value="new"
                    label="Tạo truyện mới"
                    note={`${NEW_STORY_TITLE} (Sách mới)`}
                    checked={target === 'new'}
                    onSelect={setDestination}
                  />
                  {stories.status === 'loading' ? (
                    <div
                      aria-busy="true"
                      aria-label="Đang tải truyện hiện có"
                      className="flex items-start gap-3 rounded-3xl border border-line p-4"
                    >
                      <Skeleton className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
                        <Skeleton className="mb-0.5 mt-1.5 h-3 w-48 max-w-full" />
                      </span>
                    </div>
                  ) : stories.status === 'error' ? (
                    <div className="rounded-3xl border border-line">
                      <EmptyState
                        tone="rose"
                        icon={AlertTriangle}
                        headingAs="h3"
                        title="Không tải được truyện hiện có"
                        description="Hãy thử tải lại sau ít phút."
                        action={<RetryButton onClick={stories.retry} />}
                        className="px-4 py-5"
                      />
                    </div>
                  ) : stories.status === 'empty' ? (
                    <div className="rounded-3xl border border-line">
                      <EmptyState
                        icon={FileText}
                        headingAs="h3"
                        title="Chưa có truyện để thêm vào"
                        description="Các chương sẽ được nhập vào truyện mới."
                        action={
                          <Button variant="secondary" size="sm" onClick={stories.retry}>
                            <RefreshCw size={14} aria-hidden="true" />
                            Tải lại danh sách
                          </Button>
                        }
                        className="px-4 py-5"
                      />
                    </div>
                  ) : (
                    stories.data.map((story) => (
                      <DestinationOption
                        key={story.value}
                        value={story.value}
                        label="Thêm vào truyện hiện có"
                        note={`${story.title} (${story.note})`}
                        checked={target === story.value}
                        onSelect={setDestination}
                        className="nh-fade-enter"
                      />
                    ))
                  )}
                </div>
              </div>
            </Card>

            <div className="mt-5 grid gap-3 rounded-3xl border border-line bg-surface p-4 shadow-whisper sm:flex sm:flex-wrap sm:items-center">
              <Button variant="secondary" onClick={() => setStage('upload')}>
                <ArrowLeft size={16} aria-hidden="true" />
                Quay lại tải lên
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setChapters(freshChapters());
                  setActive(1);
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Phân tích lại tài liệu
              </Button>
              <span className="text-sm text-muted max-sm:order-first sm:ml-auto" aria-live="polite">
                Đã chọn {selected.length} chương ({formatNumber(selectedWords)} từ)
              </span>
              <Button
                disabled={!selected.length || stage === 'importing'}
                onClick={runImport}
                className="max-sm:order-first"
              >
                <Import size={16} aria-hidden="true" />
                {stage === 'importing' ? 'Đang nhập...' : `Nhập ${selected.length} chương`}
              </Button>
            </div>
          </>
        )}
      </div>
    </AuthorLayout>
  );
}

function DestinationOption({ value, label, note, checked, onSelect, className = '' }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-3xl border p-4 transition-[background-color,border-color] duration-200 ${checked ? 'border-brand bg-brand/8' : 'border-line hover:border-brand/60'} ${className}`}
    >
      <input
        type="radio"
        name="import-destination"
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
      <span className="min-w-0">
        <strong className="block text-sm">{label}</strong>
        <span className="mt-1 block text-xs text-muted">{note}</span>
      </span>
    </label>
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

function UploadStage({ onPick, onDropFile, error }) {
  const [dragging, setDragging] = useState(false);
  return (
    <section
      aria-label="Tải tệp PDF lên"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onDropFile(event.dataTransfer.files?.[0]);
      }}
      className={`mt-6 grid min-h-[430px] place-items-center rounded-3xl border-2 border-dashed p-6 text-center transition-colors duration-200 ${dragging ? 'border-brand bg-brand/8' : 'border-line bg-surface'}`}
    >
      <div>
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-brand/12 text-brand-strong">
          <Upload size={32} />
        </span>
        <h2 className="mt-5 text-h2">Thả tệp PDF bản thảo vào đây</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Tải lên tệp PDF tối đa 50 MB. NovelHub sẽ nhận diện tiêu đề, điểm ngắt cảnh, định dạng
          đoạn văn và ranh giới chương.
        </p>
        <Button onClick={onPick} className="mt-5">
          <Upload size={16} aria-hidden="true" />
          Chọn tệp PDF
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-strong">
            {error}
          </p>
        )}
        <p className="mt-4 text-xs text-muted">
          Chỉ xem trước cục bộ trên giao diện · không truyền tệp ra ngoài
        </p>
      </div>
    </section>
  );
}

function ChapterDetection({
  chapter,
  index,
  active,
  isLast,
  onActive,
  onToggle,
  onTitle,
  onSplit,
  onMerge,
}) {
  const inputId = `import-chapter-${chapter.id}`;
  return (
    <li
      onClick={onActive}
      onFocusCapture={onActive}
      className={`rounded-3xl border p-4 transition-[background-color,border-color] duration-200 ${active ? 'border-brand bg-brand/5' : 'border-line'} ${chapter.selected ? '' : 'opacity-70'}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={chapter.selected}
          aria-label={`Chọn ${chapter.title} để nhập`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className="-m-2.5 grid size-11 shrink-0 place-items-center rounded-full"
        >
          <span
            aria-hidden="true"
            className={`grid size-6 place-items-center rounded-full border transition-colors duration-200 ${chapter.selected ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}
          >
            {chapter.selected && <Check size={13} />}
          </span>
        </button>
        <label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-[.12em] text-brand-strong"
        >
          Chương {String(index + 1).padStart(2, '0')} · Tiêu đề 1
        </label>
        <Badge className="ml-auto">
          {chapter.pages}
          {chapter.words ? ` · ${formatNumber(chapter.words)} từ` : ''}
        </Badge>
      </div>
      <input
        id={inputId}
        value={chapter.title}
        onChange={(event) => onTitle(event.target.value)}
        className="mt-3 min-h-11 w-full rounded-full border border-line bg-surface px-4 text-base text-ink outline-none transition-colors focus:border-brand sm:text-sm"
      />
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={onSplit} className="px-3">
          <Scissors size={14} aria-hidden="true" />
          Tách tại trang
        </Button>
        <Button variant="ghost" size="sm" onClick={onMerge} disabled={isLast} className="px-3">
          <GitMerge size={14} aria-hidden="true" />
          Gộp với phần dưới
        </Button>
      </div>
    </li>
  );
}

function ExtractionInspector({ view, setView, title }) {
  const split = view === 'split';
  return (
    <Card as="section" aria-labelledby="inspector-heading" className="min-w-0 xl:sticky xl:top-24">
      <div className="flex flex-col gap-3 border-b border-hairline pb-4">
        <div>
          <h2 id="inspector-heading" className="text-h3">
            Kiểm tra nội dung trích xuất
          </h2>
          <p className="mt-1 text-sm text-muted">PDF gốc và Markdown sạch đã trích xuất</p>
        </div>
        <div className="max-w-full">
          <Tabs
            singleRow
            label="Chế độ xem"
            value={view}
            onChange={setView}
            items={[
              { value: 'split', label: 'Chế độ chia đôi' },
              { value: 'markdown', label: 'Chỉ Markdown' },
            ]}
          />
        </div>
      </div>
      <div
        className={`mt-4 grid gap-3 ${split ? 'md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2' : ''}`}
      >
        {split && (
          <figure
            aria-label="Trang PDF gốc"
            className="min-h-[420px] rounded-2xl border border-hairline bg-reader p-5 text-ink shadow-whisper"
          >
            <p className="text-center text-xs uppercase tracking-[.18em] text-ink/60">
              Chronicles of the Sunken Spire
            </p>
            <h3 className="mt-10 border-y border-dashed border-brand py-4 text-center text-lg font-bold">
              CHAPTER I
              <br />
              THE HARBOR GATE
            </h3>
            <p className="mt-5 text-sm leading-7">
              The mist rolled across the brackish quay before sunrise, clinging to the
              salt-encrusted timbers of the northern breakwater. By the time Kael arrived with his
              copper lantern, the tide had already begun its retreat.
            </p>
          </figure>
        )}
        <div className="min-h-[420px] rounded-2xl border border-hairline bg-elevated p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-strong">
            <span>Markdown đã trích xuất</span>
            <span>Tự động định dạng</span>
          </div>
          <Badge tone="green" className="mt-5">
            Đã nhận diện thẻ H1
          </Badge>
          <h3 className="mt-3 text-h3 text-brand-strong">{title}</h3>
          <Badge className="mt-5">Đoạn 01</Badge>
          <p className="mt-3 text-sm leading-7">
            The mist rolled across the brackish quay before sunrise, clinging to the salt-encrusted
            timbers of the northern breakwater. By the time Kael arrived with his copper lantern,
            the tide had already begun its retreat, exposing the green slick of drowned masonry.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 rounded-2xl bg-brand/10 p-4 text-sm">
        <li className="flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-brand" />
          Loại bỏ đầu trang lặp lại và số trang
        </li>
        <li className="flex items-center gap-2">
          <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-brand" />
          Giữ nguyên dấu ngắt cảnh của tác giả (* * *)
        </li>
      </ul>
    </Card>
  );
}
