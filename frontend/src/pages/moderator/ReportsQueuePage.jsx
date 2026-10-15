import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Edit3,
  FileSearch,
  FileWarning,
  Gavel,
  MessageSquareWarning,
  RotateCcw,
  Scale,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
} from '../../components/icons';
import { ModeratorLayout } from '../../layouts';
import { communityReports } from '../../data/mock/moderation';
import { useMockResource } from '../../context/MockDataContext';
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
} from '../../components/ui';

const statusTabs = [
  { value: 'Open', label: 'Đang mở', count: 15 },
  { value: 'In Review', label: 'Đang xét duyệt', count: 8 },
  { value: 'Resolved', label: 'Đã giải quyết', count: 142 },
  { value: 'Escalated', label: 'Đã chuyển cấp', count: 3 },
];
const severityLabels = { High: 'Cao', Medium: 'Trung bình', Low: 'Thấp' };
const severityTone = { High: 'red', Medium: 'orange', Low: 'neutral' };
const severityTile = {
  High: 'bg-rose/14 text-rose-strong',
  Medium: 'bg-orange/16 text-orange-strong',
  Low: 'bg-ink/5 text-ink/75',
};
const statusLabels = {
  Open: 'Đang mở',
  'In Review': 'Đang xét duyệt',
  Resolved: 'Đã giải quyết',
  Escalated: 'Đã chuyển cấp',
};
const statusTone = { Open: 'blue', 'In Review': 'orange', Resolved: 'green', Escalated: 'purple' };
const titleLabels = {
  'Copyright & Plagiarism Claim': 'Khiếu nại bản quyền và đạo văn',
  'Comment Harassment / Toxic Behavior': 'Bình luận quấy rối / hành vi độc hại',
  'Unrated Mature Content (Missing 18+ Gate)':
    'Nội dung trưởng thành chưa phân loại (thiếu cổng 18+)',
  'Misleading Story Metadata': 'Thông tin truyện gây hiểu nhầm',
};
const resolutions = {
  dismiss: {
    label: 'Bác bỏ do không có căn cứ',
    title: 'Bác bỏ báo cáo này?',
    confirm: 'Xác nhận bác bỏ',
    destructive: true,
  },
  changes: {
    label: 'Yêu cầu chỉnh sửa',
    title: 'Xác nhận thao tác kiểm duyệt',
    confirm: 'Ghi nhận thao tác',
    status: 'In Review',
  },
  escalate: {
    label: 'Chuyển Đội Pháp lý Sở hữu trí tuệ',
    title: 'Xác nhận chuyển cấp',
    confirm: 'Xác nhận chuyển cấp',
    status: 'Escalated',
  },
};
const fieldClass =
  'w-full rounded-2xl border border-line bg-surface p-3 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm';
const formatAge = (value) => value.replace('m ago', ' phút trước').replace('h ago', ' giờ trước');
const formatTarget = (value) =>
  value.replace('Reader comment on ', 'Bình luận độc giả về ').replace('(Ch. ', '(Chương ');
const formatReportMeta = (value) =>
  value
    .replace('Similarity Index', 'chỉ số tương đồng')
    .replace('Trust & Safety review', 'Xét duyệt Tin cậy và An toàn')
    .replace('Rating audit', 'Kiểm tra phân loại')
    .replace('Metadata check', 'Kiểm tra thông tin')
    .replace(' readers flagged', ' độc giả báo cáo')
    .replace(' users flagged', ' người dùng báo cáo')
    .replace(' reader flagged', ' độc giả báo cáo');
const assignedLabel = (value) => (value === 'Unassigned' ? 'Chưa phân công' : value);

export function ReportsQueuePage() {
  const inspectorRef = useRef(null);
  const [status, setStatus] = useState('Open');
  const [severity, setSeverity] = useState('All');
  const [reason, setReason] = useState('All Infraction Types');
  const [query, setQuery] = useState('');
  /* undefined = nothing chosen yet (inspect the first report); null = explicitly cleared. */
  const [selectedId, setSelectedId] = useState(undefined);
  const [resolution, setResolution] = useState(null);
  const [note, setNote] = useState('');
  const [dismissed, setDismissed] = useState([]);
  const [statusOverrides, setStatusOverrides] = useState({});
  const queue = useMockResource('moderator:reports', communityReports);
  const reports = useMemo(
    () =>
      queue.data
        .filter((report) => !dismissed.includes(report.id))
        .map((report) => ({ ...report, status: statusOverrides[report.id] ?? report.status })),
    [queue.data, dismissed, statusOverrides],
  );
  const rows = useMemo(
    () =>
      reports.filter(
        (report) =>
          (status === 'Open'
            ? ['Open', 'In Review'].includes(report.status)
            : report.status === status) &&
          (severity === 'All' || report.severity === severity) &&
          (reason === 'All Infraction Types' || report.title.includes(reason.split(' / ')[0])) &&
          `${report.id} ${report.title} ${report.target} ${report.lead}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [reports, status, severity, reason, query],
  );
  const selected =
    selectedId === undefined
      ? (reports[0] ?? null)
      : (reports.find((report) => report.id === selectedId) ?? null);
  const pending = resolution ? resolutions[resolution] : null;
  const select = (id) => {
    setSelectedId(id);
    if (window.matchMedia('(max-width: 1279px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      inspectorRef.current?.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };
  const openResolution = (key) => {
    setNote('');
    setResolution(key);
  };
  const confirm = () => {
    if (resolution === 'dismiss') {
      setDismissed((current) => [...current, selected.id]);
      setSelectedId(rows.find((report) => report.id !== selected.id)?.id ?? null);
    } else {
      setStatusOverrides((current) => ({ ...current, [selected.id]: pending.status }));
    }
    setResolution(null);
  };
  const resetFilters = () => {
    setStatus('Open');
    setSeverity('All');
    setReason('All Infraction Types');
    setQuery('');
  };
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-muted">
              Bảng điều khiển kiểm duyệt /{' '}
              <strong className="font-semibold text-ink">Báo cáo cộng đồng và An toàn</strong>
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Hàng đợi báo cáo</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">15 báo cáo đang mở</Badge>
            <Badge tone="red">4 mức nghiêm trọng cao</Badge>
            <Badge tone="orange">8 đang xét duyệt</Badge>
            <Badge tone="purple">3 đã chuyển cấp</Badge>
          </div>
        </div>

        <Card className="mt-6 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="min-w-0">
              <Tabs
                label="Lọc theo trạng thái báo cáo"
                singleRow
                value={status}
                onChange={setStatus}
                items={statusTabs.map((item) => ({
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
            <Input
              icon={Search}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã báo cáo, người dùng..."
              aria-label="Tìm mã báo cáo, người dùng, đoạn trích"
              className="w-full xl:ml-auto xl:w-72"
            />
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="sr-only" htmlFor="report-severity">
              Mức độ nghiêm trọng
            </label>
            <Select
              id="report-severity"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="All">Tất cả mức độ</option>
              <option value="High">Cao</option>
              <option value="Medium">Trung bình</option>
              <option value="Low">Thấp</option>
            </Select>
            <label className="sr-only" htmlFor="report-reason">
              Loại vi phạm
            </label>
            <Select
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="All Infraction Types">Tất cả loại vi phạm</option>
              <option value="Copyright / Plagiarism">Bản quyền / Đạo văn</option>
              <option value="Harassment / Toxicity">Quấy rối / Độc hại</option>
              <option value="Unrated Mature Content">Nội dung trưởng thành chưa phân loại</option>
            </Select>
          </div>
        </Card>

        {queue.status === 'error' || queue.status === 'empty' ? (
          <Card className="mt-6 p-0">
            {queue.status === 'error' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được hàng đợi báo cáo"
                description="Dịch vụ Tin cậy và An toàn chưa phản hồi. Báo cáo mới vẫn được ghi nhận."
                action={
                  <Button variant="secondary" size="sm" onClick={queue.retry}>
                    <RotateCcw size={14} />
                    Thử lại
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="Không có báo cáo cộng đồng nào"
                description="Cộng đồng chưa gửi báo cáo cần xử lý. Tiếp tục xét duyệt bản thảo trong hàng đợi biên tập."
                action={
                  <ButtonLink to="/moderator/submissions" variant="secondary" size="sm">
                    Mở hàng đợi bản thảo
                  </ButtonLink>
                }
              />
            )}
          </Card>
        ) : (
          <div className="nh-grid-12 mt-6 grid items-start gap-5 nh-layout-xl-7-5">
            <section
              aria-label={
                queue.status === 'loading' ? 'Đang tải danh sách báo cáo' : 'Danh sách báo cáo'
              }
              aria-busy={queue.status === 'loading'}
              className="min-w-0"
            >
              <div className="mb-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted">
                <span>
                  Đang hiển thị{' '}
                  {queue.status === 'loading' ? '…' : rows.length ? `1–${rows.length}` : '0'} / 15
                  báo cáo sự cố chờ xử lý
                </span>
                <span>
                  Sắp xếp theo:{' '}
                  <strong className="font-semibold text-ink">
                    Mức khẩn cấp và thời gian gần nhất
                  </strong>
                </span>
              </div>
              {queue.status === 'loading' ? (
                <ul aria-hidden="true" className="space-y-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <ReportCardSkeleton key={index} />
                  ))}
                </ul>
              ) : rows.length ? (
                <ul className="nh-fade-enter space-y-3">
                  {rows.map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      active={selected?.id === report.id}
                      onSelect={() => select(report.id)}
                    />
                  ))}
                </ul>
              ) : (
                <Card className="p-0">
                  <EmptyState
                    icon={CheckCircle2}
                    title="Không có báo cáo trong hàng đợi này"
                    description="Thử trạng thái hoặc bộ lọc khác để xem các báo cáo còn lại."
                    action={
                      <Button variant="secondary" size="sm" onClick={resetFilters}>
                        Đặt lại bộ lọc
                      </Button>
                    }
                  />
                </Card>
              )}
            </section>
            <div
              ref={inspectorRef}
              className="min-w-0 scroll-mt-[calc(var(--app-header-h)+1rem)] xl:sticky xl:top-24"
            >
              {queue.status === 'loading' ? (
                <InspectorSkeleton />
              ) : (
                <IncidentInspector report={selected} onResolution={openResolution} />
              )}
            </div>
          </div>
        )}

        <Modal
          open={Boolean(pending && selected)}
          title={pending?.title ?? ''}
          onClose={() => setResolution(null)}
        >
          {pending && selected && (
            <>
              <div
                className={`flex gap-3 rounded-2xl p-4 ${pending.destructive ? 'border border-rose/30 bg-rose/10' : 'bg-surface'}`}
              >
                <Gavel
                  className={`shrink-0 ${pending.destructive ? 'text-rose-strong' : 'text-orange-strong'}`}
                />
                <div className="min-w-0">
                  <strong className="text-sm">{pending.label}</strong>
                  <p className="mt-1 text-sm leading-6 text-ink/75">
                    Hồ sơ <strong>#{selected.id}</strong> ·{' '}
                    {titleLabels[selected.title] ?? selected.title} ·{' '}
                    {pending.destructive
                      ? 'Báo cáo sẽ bị đóng và rời khỏi hàng đợi.'
                      : 'Thao tác này chỉ cập nhật bản xem trước cục bộ.'}
                  </p>
                </div>
              </div>
              <label htmlFor="report-resolution" className="mt-4 block text-sm font-semibold">
                Lý do giải quyết{pending.destructive ? ' (bắt buộc)' : ''}
              </label>
              <textarea
                id="report-resolution"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className={`${fieldClass} mt-2 min-h-24`}
                placeholder="Lý do giải quyết..."
              />
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={() => setResolution(null)}>
                  Hủy
                </Button>
                <Button
                  variant={pending.destructive ? 'danger' : 'primary'}
                  disabled={pending.destructive && !note.trim()}
                  onClick={confirm}
                >
                  {pending.confirm}
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </ModeratorLayout>
  );
}

function ReportCard({ report, active, onSelect }) {
  const Icon = report.title.includes('Harassment') ? MessageSquareWarning : FileWarning;
  return (
    <li>
      <article
        className={`relative rounded-3xl border bg-surface p-4 shadow-whisper transition-[border-color,box-shadow,transform] duration-200 hover:shadow-soft sm:p-5 ${active ? 'border-brand ring-2 ring-brand/20' : report.severity === 'High' ? 'border-rose/40' : 'border-line'}`}
      >
        <div className="flex gap-4">
          <span
            aria-hidden="true"
            className={`hidden size-12 shrink-0 place-items-center rounded-2xl sm:grid ${severityTile[report.severity]}`}
          >
            <Icon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm tabular-nums text-brand-strong">#{report.id}</strong>
              <Badge tone={severityTone[report.severity]}>
                Mức {severityLabels[report.severity] ?? report.severity}
              </Badge>
              <Badge tone={statusTone[report.status]}>
                {statusLabels[report.status] ?? report.status}
              </Badge>
              <span className="text-xs text-muted">· {formatAge(report.age)}</span>
            </div>
            <h2 className="mt-2 text-base font-semibold leading-snug sm:text-lg">
              <button
                type="button"
                aria-pressed={active}
                onClick={onSelect}
                className="whitespace-normal text-left after:absolute after:inset-0 after:rounded-3xl after:content-['']"
              >
                {titleLabels[report.title] ?? report.title}
              </button>
            </h2>
            <p className="mt-1.5 text-sm">
              <BookOpen size={14} className="mr-1.5 inline align-[-2px] text-muted" />
              Đối tượng: <strong className="font-semibold">{formatTarget(report.target)}</strong>
            </p>
            <blockquote className="mt-3 rounded-2xl border border-hairline bg-elevated p-3 text-sm italic leading-6 text-ink/75">
              “{report.excerpt}”
            </blockquote>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-3 text-xs text-muted">
              <span>{formatReportMeta(report.score)}</span>
              <span>{formatReportMeta(report.reporters)}</span>
              <span>
                Người báo cáo chính:{' '}
                <strong className="font-semibold text-brand-strong">{report.lead}</strong>
              </span>
              <span className="flex items-center gap-1.5 sm:ml-auto">
                <Badge>Phân công: {assignedLabel(report.assigned)}</Badge>
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

function IncidentInspector({ report, onResolution }) {
  if (!report)
    return (
      <Card className="p-0">
        <EmptyState
          icon={ShieldCheck}
          title="Chưa chọn báo cáo"
          description="Chọn một báo cáo để kiểm tra."
        />
      </Card>
    );
  return (
    <aside aria-label="Kiểm tra sự cố" className="nh-fade-enter">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck size={18} className="text-brand" />
            Kiểm tra sự cố
          </h2>
          <span className="text-xs text-muted">Bộ phận xác minh P30</span>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm tabular-nums text-brand-strong">Hồ sơ #{report.id}</strong>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={statusTone[report.status]}>
              {statusLabels[report.status] ?? report.status}
            </Badge>
            <Badge tone={severityTone[report.severity]}>
              Mức {severityLabels[report.severity] ?? report.severity}
            </Badge>
          </div>
        </div>
        <h3 className="mt-3 text-h3">
          {report.title === 'Copyright & Plagiarism Claim'
            ? 'Khiếu nại đạo văn: Đã xác minh đoạn trùng khớp'
            : (titleLabels[report.title] ?? report.title)}
        </h3>
        <p className="mt-1.5 text-sm text-muted">
          Mở {formatAge(report.age)} · Phân công cho{' '}
          <strong className="font-semibold text-ink">{assignedLabel(report.assigned)}</strong>
        </p>
        <div className="mt-5 rounded-2xl border border-hairline bg-elevated p-4">
          <strong className="flex items-center gap-2 text-sm">
            <UserRoundCheck size={16} className="text-brand" />
            Tường trình của người báo cáo
          </strong>
          <p className="mt-2 text-sm leading-6">
            “Nội dung bị báo cáo có dấu hiệu vi phạm hướng dẫn an toàn và xuất bản NovelHub. Vui
            lòng xác minh đoạn trích được dẫn và ngữ cảnh xung quanh.”
          </p>
        </div>
        <div className="mt-4 rounded-2xl border border-rose/40 bg-rose/8 p-4">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs">
            <strong className="font-semibold">
              Đoạn bị cảnh báo trong “{formatTarget(report.target)}”
            </strong>
            <span className="font-semibold text-rose-strong">Trùng khớp chính xác (94%)</span>
          </div>
          <blockquote className="mt-3 border-l-2 border-rose pl-4 text-sm italic leading-7">
            “{report.excerpt} They harvest each vow broken upon the shore, waiting for salt to
            bleach the memory of kings.”
          </blockquote>
          <p className="mt-2 text-xs text-ink/70">Vị trí: Đoạn 24–26</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-hairline bg-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink/70">
              Tác giả bị báo cáo
            </p>
            <strong className="mt-2 block">@erik_pen</strong>
            <p className="mt-1.5 text-xs leading-5 text-ink/70">
              2 tác phẩm đã xuất bản
              <br />0 vi phạm bản quyền trước đây
              <br />
              <span className="font-semibold text-brand-strong">Hồ sơ sạch</span>
            </p>
          </div>
          <div className="rounded-2xl border border-hairline bg-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink/70">
              Độ tin cậy người báo cáo
            </p>
            <strong className="mt-2 block text-2xl tabular-nums text-brand-strong">94%</strong>
            <p className="mt-1 text-xs leading-5 text-ink/70">
              Cộng tác viên đáng tin cậy
              <br />
              18 cảnh báo đã xác nhận
            </p>
          </div>
        </div>
        <ButtonLink
          to="/moderator/similarity-review/demo"
          variant="secondary"
          trailingIcon={ChevronRight}
          className="mt-5 w-full"
        >
          <FileSearch size={16} />
          Mở so sánh tương đồng
        </ButtonLink>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-hairline pt-4">
          <Button
            onClick={() => onResolution('escalate')}
            className="w-full whitespace-normal text-center"
          >
            <Scale size={16} />
            Chuyển Đội Pháp lý Sở hữu trí tuệ
          </Button>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
            <Button onClick={() => onResolution('changes')} variant="outline">
              <Edit3 size={15} />
              Yêu cầu sửa
            </Button>
            <Button onClick={() => onResolution('dismiss')} variant="danger">
              <X size={15} />
              Bác bỏ
            </Button>
          </div>
        </div>
      </Card>
    </aside>
  );
}

/* Mirrors ReportCard: 48px tile, badge row, title, target line, quoted excerpt and meta footer. */
function ReportCardSkeleton() {
  return (
    <li className="rounded-3xl border border-line bg-surface p-4 shadow-whisper sm:p-5">
      <div className="flex gap-4">
        <span className="hidden shrink-0 sm:block">
          <Skeleton className="size-12 rounded-2xl" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <span className="mt-2 flex h-[1.375rem] items-center sm:h-[1.5625rem]">
            <Skeleton className="h-4 w-3/4" />
          </span>
          <span className="mt-1.5 flex h-5 items-center">
            <Skeleton className="h-3 w-2/3" />
          </span>
          <div className="mt-3 space-y-3 rounded-2xl border border-hairline bg-elevated p-3 py-[1.125rem]">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="mt-3 flex items-center gap-4 border-t border-hairline pt-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-6 w-36" />
          </div>
        </div>
      </div>
    </li>
  );
}

/* Mirrors the incident inspector card: same header, boxes, two-column stats and action stack. */
function InspectorSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="p-5">
      <div className="flex items-center justify-between gap-2 border-b border-hairline pb-4">
        <span className="flex h-6 items-center gap-2">
          <Skeleton className="size-[18px] rounded-md" />
          <Skeleton className="h-4 w-32" />
        </span>
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-28" />
        <div className="flex gap-1.5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
      <span className="mt-3 flex h-14 flex-col justify-center gap-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-1/2" />
      </span>
      <span className="mt-1.5 flex h-5 items-center">
        <Skeleton className="h-3 w-3/5" />
      </span>
      <div className="mt-5 rounded-2xl border border-hairline bg-elevated p-4">
        <span className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-44" />
        </span>
        <div className="mt-2 flex h-[4.5rem] flex-col justify-center gap-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-hairline bg-elevated p-4">
        <div className="flex h-4 items-center justify-between gap-3 xl:h-9 xl:flex-col xl:items-start">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="mt-3 flex h-28 flex-col justify-center gap-4 border-l-2 border-hairline pl-4">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <span className="mt-2 flex h-4 items-center">
          <Skeleton className="h-3 w-24" />
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="rounded-2xl border border-hairline bg-elevated p-4">
            <span className="flex h-8 flex-col justify-center gap-2">
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-1/2" />
            </span>
            <span className="mt-2 flex h-8 items-center">
              <Skeleton className="h-6 w-16 rounded-xl" />
            </span>
            <span className="mt-1.5 flex h-[3.75rem] flex-col justify-center gap-2.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </span>
          </div>
        ))}
      </div>
      <Skeleton className="mt-5 h-11 w-full xl:h-[3.375rem]" />
      <div className="mt-4 grid gap-2 border-t border-hairline pt-4">
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </Card>
  );
}
