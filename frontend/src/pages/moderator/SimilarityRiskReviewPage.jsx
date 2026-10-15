import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Download,
  FileSearch,
  Gavel,
  Link2,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from '../../components/icons';
import { ModeratorLayout } from '../../layouts';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  Modal,
  ProgressBar,
  Skeleton,
  Tabs,
} from '../../components/ui';

const FLAG_ID = 'SIM-3012';
const SUBMISSION_ID = 'MS-88402';
const metrics = [
  ['Trùng lặp ngữ nghĩa', '68,4%', 68.4, 'Cosine vector', 'Rủi ro trung bình', 'orange'],
  ['Trùng văn bản nguyên câu', '14,2%', 14.2, 'Chuỗi cụm từ chính xác', 'Vượt ngưỡng', 'red'],
  ['Nhịp cấu trúc chương', '78,0%', 78, 'Nhịp điểm cảnh', 'Mô-típ cao', 'purple'],
  ['Độ tin cậy mô hình', 'Cao', 91, '1,4M tiêu đề đã lập chỉ mục', 'Chỉ mục đã xác minh', 'green'],
];
const metricText = {
  orange: 'text-orange-strong',
  red: 'text-rose-strong',
  purple: 'text-purple-strong',
  green: 'text-brand-strong',
};
const metricBar = { orange: 'orange', red: 'rose', purple: 'purple', green: 'brand' };
const passages = [
  {
    match: '92% trùng · 64 từ',
    target:
      'The wardens of elder days do not slumber lightly, wanderer. They wait within the grain of ancient saplings where no sunlight penetrates, listening with hollow ears to the trespass of mortals who carry blood on their hands. If you draw their breath into your lungs, memory turns to ash before twilight falls upon the ridge.',
    reference:
      'The wardens of elder days do not slumber lightly, wanderer. They sleep within the heartwood of ancient saplings where sun never shines, listening with hollow ears to the feet of travelers who bear unresolved slaughter upon their hands. If you draw their breath into your lungs, memory turns to ash before twilight falls upon the valley.',
  },
  {
    match: '74% trùng · 48 từ',
    target:
      'The iron bell spoke once beneath the drowned sanctuary, and every lantern along the northern causeway answered with a blue flame.',
    reference:
      'The bronze bell sounded beneath the flooded sanctuary, while lanterns on the northern road answered in pale blue fire.',
  },
  {
    match: '61% trùng · 35 từ',
    target:
      'No crown forged by mortal hands could command the root-bound king, whose oath belonged only to winter and stone.',
    reference:
      'No human crown could command the forest king; his covenant was sworn to winter, root and stone.',
  },
];
const actions = {
  dismiss: { label: 'Bác bỏ cảnh báo', icon: X, variant: 'secondary' },
  attach: { label: `Đính kèm vào bản xét duyệt #${SUBMISSION_ID}`, icon: Link2, variant: 'ghost' },
  escalate: {
    label: 'Chuyển Bộ phận Pháp lý Bản quyền',
    icon: Scale,
    variant: 'danger',
    destructive: true,
  },
  clarify: {
    label: 'Yêu cầu tác giả giải trình và cung cấp bằng chứng',
    icon: ClipboardCheck,
    variant: 'primary',
  },
};
const fieldClass =
  'w-full rounded-2xl border border-line p-3 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm';

const highlight = (text, query) => {
  const needle = query.trim();
  if (!needle) return text;
  const parts = text.split(new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, index) =>
    index % 2 ? (
      <span key={index} className="rounded-sm bg-purple/25 px-0.5 font-semibold">
        {part}
      </span>
    ) : (
      part
    ),
  );
};

export function SimilarityRiskReviewPage() {
  const { reviewId = FLAG_ID } = useParams();
  const evidence = useMockResource(
    `similarity:${reviewId}`,
    { metrics, passages },
    {
      isEmpty: (value) => !value.passages.length,
    },
  );
  const ready = evidence.status === 'ready';
  const loading = evidence.status === 'loading';
  const [passage, setPassage] = useState(0);
  const [query, setQuery] = useState('');
  const [sync, setSync] = useState(true);
  const [findings, setFindings] = useState(
    'Có các mô-típ dân gian kỳ ảo phổ biến, nhưng câu mở đầu Chương 2 cho thấy sự phái sinh cấu trúc trực tiếp. Cần yêu cầu làm rõ.',
  );
  const [softHold, setSoftHold] = useState(true);
  const [notify, setNotify] = useState(true);
  const [action, setAction] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [recorded, setRecorded] = useState(null);
  const submittedPanelRef = useRef(null);
  const referencePanelRef = useRef(null);
  const syncing = useRef(false);
  const selected = evidence.data.passages[passage] ?? evidence.data.passages[0];
  const needle = query.trim().toLowerCase();
  const matches =
    ready && needle
      ? evidence.data.passages.filter((item) =>
          `${item.target} ${item.reference}`.toLowerCase().includes(needle),
        ).length
      : null;
  const pending = action ? actions[action] : null;

  const onPanelScroll = (index) => {
    if (!sync || syncing.current) {
      syncing.current = false;
      return;
    }
    const panels = [submittedPanelRef.current, referencePanelRef.current];
    const source = panels[index];
    const target = panels[1 - index];
    if (!source || !target) return;
    const range = source.scrollHeight - source.clientHeight;
    const next =
      range > 0 ? (source.scrollTop / range) * (target.scrollHeight - target.clientHeight) : 0;
    if (Math.abs(target.scrollTop - next) < 1) return;
    syncing.current = true;
    target.scrollTop = next;
  };
  const exportReport = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            flag: FLAG_ID,
            submission: SUBMISSION_ID,
            metrics: evidence.data.metrics.map(([label, value, , note, status]) => ({
              label,
              value,
              note,
              status,
            })),
            passages: evidence.data.passages,
            findings,
            softHold,
            requestClarification: notify,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${FLAG_ID.toLowerCase()}-kiem-tra.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const openAction = (key) => {
    setActionNote(findings);
    setAction(key);
  };

  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-5 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-muted">
              Bảng điều khiển kiểm duyệt / Cảnh báo tương đồng và kiểm tra rủi ro SHTT
            </p>
            <h1 className="mt-1 text-h2 lg:text-h1">
              Cảnh báo #{FLAG_ID}: Chronicles of Eldor so với tác phẩm đã đăng ký
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Badge tone="orange" className="self-start sm:self-auto">
              Cần kiểm tra
            </Badge>
            <Input
              icon={Search}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm trong văn bản bị cảnh báo..."
              aria-label="Tìm trong văn bản bị cảnh báo"
              className="w-full sm:w-64"
            />
            <Button onClick={exportReport} variant="secondary" disabled={!ready}>
              <Download size={15} />
              Xuất JSON kiểm tra
            </Button>
          </div>
        </div>

        <div
          role="note"
          className="mt-5 flex gap-3 rounded-2xl border border-orange/40 bg-orange/10 p-4 text-sm leading-6"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-orange-strong" />
          <p>
            <strong className="font-semibold">
              Lưu ý: Chỉ số tương đồng AI và vector chỉ là bằng chứng hỗ trợ
            </strong>
            , không phải kết luận vi phạm bản quyền. Cần đánh giá ngữ cảnh châm biếm, mô-típ dân
            gian phổ biến và chủ ý phong cách.
          </p>
        </div>

        {evidence.status === 'error' || evidence.status === 'empty' ? (
          <Card className="mt-6 p-0">
            {evidence.status === 'error' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được bằng chứng tương đồng"
                description="Dịch vụ phân tích vector chưa phản hồi. Cảnh báo vẫn được giữ trong hàng đợi."
                action={
                  <Button variant="secondary" size="sm" onClick={evidence.retry}>
                    <RotateCcw size={14} />
                    Thử lại
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="Chưa có đoạn trùng khớp để so sánh"
                description="Bộ máy tương đồng chưa ghi nhận đoạn nào vượt ngưỡng cho cảnh báo này."
                action={
                  <ButtonLink to="/moderator/reports" variant="secondary" size="sm">
                    Quay lại hàng đợi báo cáo
                  </ButtonLink>
                }
              />
            )}
          </Card>
        ) : (
          <>
            <Card className="mt-6" aria-busy={loading}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-2 text-h3">
                  <FileSearch size={20} className="shrink-0 text-brand" />
                  Phân tích vector tự động và suy đoán đạo văn
                </h2>
                <p className="text-xs text-muted">
                  Thuật toán: Sentence-BERT Đa ngôn ngữ v3.2 · Cosine 0,316
                </p>
              </div>
              {loading ? (
                <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }, (_, index) => (
                    <MetricSkeleton key={index} />
                  ))}
                </div>
              ) : (
                <div className="nh-fade-enter mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {evidence.data.metrics.map(([label, value, percent, note, status, tone]) => (
                    <div
                      key={label}
                      className="flex flex-col rounded-2xl border border-hairline bg-elevated p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="text-sm text-ink/75">{label}</span>
                        <Badge tone={tone}>{status}</Badge>
                      </div>
                      <strong
                        className={`mt-4 block text-3xl font-bold tabular-nums tracking-tight ${metricText[tone]}`}
                      >
                        {value}
                      </strong>
                      <p className="mt-1 text-xs text-ink/70">{note}</p>
                      <ProgressBar
                        value={percent}
                        tone={metricBar[tone]}
                        size="sm"
                        className="mt-4"
                        label={`${label}: ${value}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 shadow-whisper lg:flex-row lg:items-center">
              <strong className="shrink-0 text-sm">Các đoạn trùng khớp:</strong>
              <div className="min-w-0">
                {loading ? (
                  <span
                    aria-hidden="true"
                    className="flex h-12 items-center gap-1 overflow-hidden rounded-full border border-hairline bg-elevated p-1"
                  >
                    {[0, 1, 2].map((index) => (
                      <Skeleton key={index} className="h-10 w-56 shrink-0" />
                    ))}
                  </span>
                ) : (
                  <Tabs
                    label="Chọn đoạn trùng khớp"
                    singleRow
                    value={passage}
                    onChange={setPassage}
                    items={evidence.data.passages.map((item, index) => ({
                      value: index,
                      label: `Đoạn ${index + 1} / ${evidence.data.passages.length} · ${item.match}`,
                    }))}
                  />
                )}
              </div>
              {matches !== null && (
                <span role="status" className="text-xs text-muted">
                  {matches ? `${matches} đoạn chứa “${query.trim()}”` : 'Không tìm thấy đoạn khớp'}
                </span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={sync}
                onClick={() => setSync((value) => !value)}
                className="hidden shrink-0 items-center gap-2.5 rounded-full py-1 text-sm font-medium lg:ml-auto lg:flex"
              >
                <span
                  aria-hidden="true"
                  className={`relative h-6 w-10 rounded-full transition-colors duration-200 ${sync ? 'bg-brand' : 'bg-ink/15'}`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-surface shadow-whisper transition-transform duration-200 ${sync ? 'translate-x-4' : ''}`}
                  />
                </span>
                Đồng bộ cuộn hai bên
              </button>
            </div>

            <section
              aria-label={loading ? 'Đang tải so sánh song song' : 'So sánh song song'}
              aria-busy={loading}
              className="nh-grid-12 mt-5 grid gap-5 nh-lg-cols-2"
            >
              {loading ? (
                <>
                  <ComparisonPanelSkeleton titleLines={1} />
                  <ComparisonPanelSkeleton titleLines={2} />
                </>
              ) : (
                <>
                  <ComparisonPanel
                    label="Bản thảo đã gửi"
                    title="Bản thảo mục tiêu: Chronicles of Eldor (Chương 2)"
                    meta="Tác giả: Dorian Reed · Gửi tháng 10/2026 · 4.120 từ"
                    tone="orange"
                    text={selected.target}
                    query={query}
                    scrollRef={submittedPanelRef}
                    onScroll={() => onPanelScroll(0)}
                  />
                  <ComparisonPanel
                    label="Tác phẩm gốc đã xuất bản"
                    title="Tác phẩm tham chiếu trước đó: Ancient Echoes of Eldoria (Chương 5)"
                    meta="Tác giả: Elena J. Park · Xuất bản tháng 03/2024 · 145.000 lượt đọc"
                    tone="green"
                    text={selected.reference}
                    query={query}
                    scrollRef={referencePanelRef}
                    onScroll={() => onPanelScroll(1)}
                  />
                </>
              )}
            </section>

            <Card className="mt-5" aria-busy={loading}>
              <h2 className="flex items-center gap-2 text-h3">
                <Sparkles size={20} className="shrink-0 text-purple" />
                Tổng hợp khác biệt ngôn ngữ và phân tích hình thái
              </h2>
              {loading ? (
                <div aria-hidden="true" className="mt-4 grid gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="rounded-2xl border border-hairline bg-elevated p-4">
                      <span className="flex h-5 items-center">
                        <Skeleton className="h-3.5 w-3/4" />
                      </span>
                      <div className="mt-1.5 pb-1.5">
                        {['w-full', 'w-full', 'w-1/2'].map((width, line) => (
                          <span key={line} className="flex h-6 items-center">
                            <Skeleton className={`h-3 ${width}`} />
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nh-fade-enter mt-4 grid gap-3 md:grid-cols-3">
                  <Diagnostic title="Thay thế từ vựng trực tiếp">
                    “sleep within heartwood”{' '}
                    <ArrowRight size={14} className="inline-block align-[-2px] text-ink/60" />
                    <span className="sr-only">thành</span> “wait within the grain” vẫn giữ nhịp điệu
                    và cấu trúc mệnh đề phụ thuộc.
                  </Diagnostic>
                  <Diagnostic title="Mệnh đề phụ thuộc giống nhau">
                    “where no sunlight penetrates” và “memory turns to ash before twilight falls” có
                    mức tương đồng cao.
                  </Diagnostic>
                  <Diagnostic title="Từ vựng xây dựng thế giới dân gian">
                    Tên vùng đất và thực thể khác nhau, trong khi hộ vệ, thời cổ đại và tro gần như
                    hoặc hoàn toàn giống nhau.
                  </Diagnostic>
                </div>
              )}
            </Card>

            <Card className="mt-5">
              <div className="flex flex-col justify-between gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-h3">
                    <Gavel size={20} className="shrink-0 text-brand" />
                    Đánh giá của kiểm duyệt viên và quyết định cuối cùng
                  </h2>
                  <p className="mt-1 max-w-prose text-sm text-muted">
                    Thao tác được thêm vào sổ kiểm duyệt bất biến và thông báo cho bộ phận quan hệ
                    tác giả trong bản mẫu giao diện này.
                  </p>
                </div>
                <Badge tone="green" className="shrink-0 self-start">
                  Người xét duyệt: M. Rayne
                </Badge>
              </div>
              <div className="nh-grid-12 mt-5 grid gap-5 nh-layout-lg-4-8">
                <div className="rounded-2xl border border-hairline bg-elevated p-5">
                  <strong className="text-sm font-semibold text-orange-strong">
                    Tiêu chuẩn Chính sách #IP-04: Tri ân và Vi phạm
                  </strong>
                  <p className="mt-2 text-sm leading-6 text-ink/75">
                    Sử dụng hợp lý và tri ân cho phép mô-típ chủ đề; chuỗi cụm từ nguyên văn vượt 50
                    từ cần tác giả giải trình.
                  </p>
                  <ul className="mt-4 list-disc space-y-1.5 border-t border-hairline pl-4 pt-4 text-sm leading-6 marker:text-muted">
                    <li>
                      <strong>Bác bỏ:</strong> thiết lập hoặc quy ước thể loại tiêu chuẩn.
                    </li>
                    <li>
                      <strong>Làm rõ:</strong> cách diễn đạt phái sinh nhưng tác giả có thể đồng sở
                      hữu.
                    </li>
                    <li>
                      <strong>Chuyển cấp:</strong> xác minh có kiếm tiền nhưng không có giấy phép.
                    </li>
                  </ul>
                </div>
                <div className="min-w-0">
                  <label htmlFor="similarity-findings" className="text-sm font-semibold">
                    Kết luận nội bộ và bản nháp thông báo cho tác giả
                  </label>
                  <textarea
                    id="similarity-findings"
                    value={findings}
                    onChange={(event) => setFindings(event.target.value)}
                    className={`${fieldClass} mt-2 min-h-36 bg-elevated`}
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-6">
                    <Toggle checked={softHold} onChange={setSoftHold} label="Tạm giữ chương" />
                    <Toggle
                      checked={notify}
                      onChange={setNotify}
                      label="Yêu cầu làm rõ thế giới truyện"
                    />
                  </div>
                </div>
              </div>
              {recorded && (
                <p
                  role="status"
                  className="mt-5 flex items-center gap-2 rounded-2xl bg-brand/12 px-4 py-2.5 text-sm font-semibold text-brand-strong"
                >
                  <ShieldCheck size={16} className="shrink-0" />
                  Đã ghi nhận: {actions[recorded].label}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:flex-wrap">
                {['dismiss', 'attach'].map((key) => (
                  <ActionButton key={key} id={key} onClick={openAction} />
                ))}
                <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:flex-wrap">
                  {['escalate', 'clarify'].map((key) => (
                    <ActionButton key={key} id={key} onClick={openAction} />
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        <Modal
          open={Boolean(pending)}
          title={
            pending?.destructive ? 'Chuyển hồ sơ sang pháp lý?' : 'Xác nhận kết luận tương đồng'
          }
          onClose={() => setAction(null)}
        >
          {pending && (
            <>
              <div
                className={`rounded-2xl p-4 ${pending.destructive ? 'border border-rose/30 bg-rose/10' : 'bg-surface'}`}
              >
                <strong className="text-sm">{pending.label}</strong>
                <p className="mt-1.5 text-sm leading-6 text-ink/75">
                  Cảnh báo <strong>#{FLAG_ID}</strong> · Chronicles of Eldor (Dorian Reed). Điểm rủi
                  ro, bằng chứng được chọn và kết luận của kiểm duyệt viên sẽ được đưa vào hồ sơ
                  kiểm tra cục bộ.
                </p>
              </div>
              <label htmlFor="similarity-action-note" className="mt-4 block text-sm font-semibold">
                Kết luận gửi kèm
              </label>
              <textarea
                id="similarity-action-note"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                className={`${fieldClass} mt-2 min-h-24 bg-surface`}
              />
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setAction(null)}>
                  Hủy
                </Button>
                <Button
                  variant={pending.destructive ? 'danger' : 'primary'}
                  disabled={!actionNote.trim()}
                  onClick={() => {
                    setRecorded(action);
                    setAction(null);
                  }}
                >
                  <ShieldCheck size={15} />
                  {pending.destructive ? 'Xác nhận chuyển cấp' : 'Ghi nhận kết luận'}
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </ModeratorLayout>
  );
}

const shortActionLabels = {
  dismiss: 'Bác bỏ cảnh báo',
  attach: `Đính kèm #${SUBMISSION_ID}`,
  escalate: 'Chuyển bộ phận pháp lý',
  clarify: 'Yêu cầu tác giả giải trình',
};

function ActionButton({ id, onClick }) {
  const { icon: Icon, variant } = actions[id];
  return (
    <Button variant={variant} onClick={() => onClick(id)}>
      <Icon size={15} />
      {shortActionLabels[id]}
    </Button>
  );
}

function ComparisonPanel({ label, title, meta, tone, text, query, scrollRef, onScroll }) {
  const flagged = tone === 'orange';
  return (
    <Card as="article" className="flex min-w-0 flex-col overflow-hidden p-0">
      <header className="border-b border-hairline bg-elevated p-5">
        <Badge tone={tone}>{label}</Badge>
        <h3 className="mt-3 text-base font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-xs text-ink/70">{meta}</p>
      </header>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        tabIndex={0}
        aria-label={`Nội dung ${label}`}
        role="region"
        className="p-5 lg:max-h-[32rem] lg:overflow-y-auto"
      >
        <p className="text-sm leading-7 text-muted">
          The mountain pass opened into a valley choked by grey mists. Keir gripped the hilt of his
          father&apos;s rusted shortsword, watching the crown of ironwood trees shudder against the
          incoming gale.
        </p>
        <div
          className={`my-5 rounded-2xl border p-4 ${flagged ? 'border-orange/50 bg-orange/10' : 'border-brand/40 bg-brand/8'}`}
        >
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <strong
              className={`font-semibold uppercase tracking-[.12em] ${flagged ? 'text-orange-strong' : 'text-brand-strong'}`}
            >
              {flagged ? 'Đoạn bị cảnh báo' : 'Nguồn gốc chính thức'}
            </strong>
            <span className="text-ink/70">Dòng 42–48</span>
          </div>
          <p className="mt-3 text-sm leading-7 sm:text-base sm:leading-8">
            <mark
              className={`rounded-sm px-0.5 text-ink [box-decoration-break:clone] ${flagged ? 'bg-orange/30' : 'bg-brand/18'}`}
            >
              {highlight(text, query)}
            </mark>
          </p>
        </div>
        <p className="text-sm leading-7 text-muted">
          The traveler took a steadying breath and continued toward the sanctuary, unaware that the
          oldest oath had already begun to wake.
        </p>
      </div>
    </Card>
  );
}

function Diagnostic({ title, children }) {
  return (
    <div className="rounded-2xl border border-hairline bg-elevated p-4">
      <strong className="text-sm font-semibold">{title}</strong>
      <p className="mt-1.5 text-sm leading-6 text-ink/75">{children}</p>
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 items-center gap-2.5 whitespace-normal text-left text-sm font-medium"
    >
      <span
        aria-hidden="true"
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-brand' : 'bg-ink/15'}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-surface shadow-whisper transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
      {label}
    </button>
  );
}

/* Metric tile: label + badge row, 36px value, note, small progress track. */
function MetricSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-hairline bg-elevated p-4">
      <div className="flex items-start justify-between gap-2 xl:flex-col xl:justify-start">
        <span className="flex h-5 w-full items-center">
          <Skeleton className="h-3.5 w-3/4" />
        </span>
        <Skeleton className="h-6 w-20 shrink-0" />
      </div>
      <Skeleton className="mt-4 h-9 w-24 rounded-2xl" />
      <span className="mt-1 flex h-4 items-center">
        <Skeleton className="h-3 w-28" />
      </span>
      <Skeleton className="mt-4 h-1.5 w-full" />
    </div>
  );
}

/* Same header band and scroll body (lead-in, highlighted excerpt box, lead-out) as ComparisonPanel. */
function ComparisonPanelSkeleton({ titleLines }) {
  return (
    <Card as="div" aria-hidden="true" className="flex min-w-0 flex-col overflow-hidden p-0">
      <div className="border-b border-hairline bg-elevated p-5">
        <Skeleton className="h-6 w-32" />
        <SkeletonLines
          lines={titleLines}
          extra={2 - titleLines}
          pitch="h-[1.375rem]"
          className="mt-3"
        />
        <SkeletonLines lines={1} extra={titleLines - 1} pitch="h-4" className="mt-1" />
      </div>
      <div className="p-5">
        <SkeletonLines lines={3} extra={2} pitch="h-7" />
        <div className="my-5 rounded-2xl border border-hairline p-4">
          <div className="flex h-4 items-center justify-between gap-2">
            <Skeleton className="h-2.5 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
          <SkeletonLines lines={6} extra={3} pitch="h-7 sm:h-8" className="mt-3" />
        </div>
        <SkeletonLines lines={2} extra={2} pitch="h-7" />
      </div>
    </Card>
  );
}

/* `extra` lines render only below `sm`, where the narrow column wraps the text further. */
function SkeletonLines({ lines, extra = 0, pitch, className = '' }) {
  const total = lines + extra;
  return (
    <div className={className}>
      {Array.from({ length: total }, (_, line) => (
        <span
          key={line}
          className={`items-center ${pitch} ${line < lines ? 'flex' : 'flex sm:hidden'}`}
        >
          <Skeleton className={`h-3 ${line === total - 1 ? 'w-2/3' : 'w-full'}`} />
        </span>
      ))}
    </div>
  );
}
