import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileWarning,
  Flag,
  Gavel,
  Lock,
  RotateCcw,
  Scale,
  ShieldCheck,
} from '../../components/icons';
import { ModeratorLayout } from '../../layouts';
import { moderationStats, urgentModerationItems } from '../../data/mock/moderation';
import { useMockResource } from '../../context/MockDataContext';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  ProgressBar,
  Skeleton,
  Tabs,
} from '../../components/ui';

const metricIcons = [BookOpenCheck, Flag, Bot, Scale, Gavel];
const toneTile = {
  green: 'bg-brand/12 text-brand-strong',
  red: 'bg-rose/14 text-rose-strong',
  orange: 'bg-orange/16 text-orange-strong',
  purple: 'bg-purple/12 text-purple-strong',
};
const toneBorder = {
  green: 'border-hairline',
  red: 'border-rose/40',
  orange: 'border-orange/45',
  purple: 'border-purple/40',
};
const toneDot = { green: 'bg-brand', red: 'bg-rose', orange: 'bg-orange', purple: 'bg-purple' };
const priorityTabs = [
  { value: 'All', label: 'Tất cả mức ưu tiên' },
  { value: 'Green', tone: 'green', label: 'Xanh lá' },
  { value: 'Orange', tone: 'orange', label: 'Cam' },
  { value: 'Red', tone: 'red', label: 'Đỏ' },
  { value: 'Purple', tone: 'purple', label: 'Tím' },
];
const workload = [
  ['Kỳ ảo và Thần thoại', 42, 'còn 2 giờ 15 phút', 'brand'],
  ['Lãng mạn và Chính kịch đương đại', 28, 'còn 3 giờ 40 phút', 'rose'],
  ['Khoa học viễn tưởng và Cyberpunk', 18, 'còn 4 giờ 05 phút', 'purple'],
  ['Bí ẩn và Giật gân', 12, 'còn 5 giờ 20 phút', 'orange'],
];
const audit = [
  ['14:22', 'Đã phê duyệt Chương 15 của “A Dragon’s Wish”', 'Đã xác minh đạt', 'green'],
  ['14:05', 'Đã yêu cầu chỉnh sửa “Echoes of Void”', 'Cần hành động', 'orange'],
  ['13:40', 'Đã bác bỏ báo cáo sai về “The Last Kingdom”', 'Đã bác bỏ', 'neutral'],
  ['12:55', 'Đã chuyển hồ sơ SHTT #IP-4402 tới Bộ phận Pháp lý Cấp cao', 'Chuyển cấp 2', 'purple'],
];
const escalationDesks = [
  ['Bộ phận Pháp lý Cấp cao', 'LD', 'green'],
  ['Trưởng nhóm Kiểm duyệt', 'LM', 'orange'],
];
const statLabels = {
  'Pending Queue': 'Hàng đợi đang chờ',
  'User Reports': 'Báo cáo người dùng',
  'AI Signals': 'Tín hiệu AI',
  Escalations: 'Chuyển cấp',
  'Decisions Today': 'Quyết định hôm nay',
};
const statNotes = {
  '+6 this hr': '+6 trong giờ này',
  '4 Urgent': '4 khẩn cấp',
  '3 Copyright': '3 bản quyền',
  'Tier-2 Legal': 'Pháp lý cấp 2',
  '34 Approvals': '34 phê duyệt',
};
const kindLabels = {
  Manuscript: 'Bản thảo',
  Report: 'Báo cáo',
  'Similarity Flag': 'Cảnh báo tương đồng',
};
const actionLabels = {
  'Quick Review': 'Xét duyệt nhanh',
  'Open Dossier': 'Mở hồ sơ',
  Inspect: 'Kiểm tra',
  Compare: 'So sánh',
};
const fieldClass =
  'w-full rounded-2xl border border-line bg-surface p-3 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm';
const formatItemText = (value) =>
  value
    .replace('Submitted ', 'Đã gửi ')
    .replace('Reported ', 'Đã báo cáo ')
    .replace('Cross-indexed ', 'Đối chiếu chỉ mục ')
    .replace(' ago', ' trước')
    .replace('Severity: High', 'Mức độ: Cao')
    .replace('Severity: Medium', 'Mức độ: Trung bình')
    .replace('Author:', 'Tác giả:')
    .replace('Complaint:', 'Khiếu nại:')
    .replace('Flag:', 'Cảnh báo:')
    .replace('Trigger:', 'Tác nhân:')
    .replace('AI Safety Score:', 'Điểm an toàn AI:')
    .replace('AI Vector Check:', 'Kiểm tra vector AI:')
    .replace(
      'semantic overlap detected with registered IP',
      'phát hiện trùng lặp ngữ nghĩa với SHTT đã đăng ký',
    )
    .replace('Fantasy', 'Kỳ ảo')
    .replace('Ch. ', 'Chương ')
    .replace('24m', '24 phút')
    .replace('45m', '45 phút')
    .replace('1h 10m', '1 giờ 10 phút')
    .replace('1h 35m', '1 giờ 35 phút')
    .replace('Graphic violence keyword density', 'Mật độ từ khóa bạo lực trực diện')
    .replace('Plagiarism claim on Scene 4 dialogue', 'Khiếu nại đạo văn trong lời thoại Cảnh 4')
    .replace('words', 'từ');

export function ModeratorOverviewPage() {
  const [priority, setPriority] = useState('All');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('');
  const [handled, setHandled] = useState([]);
  const [signaled, setSignaled] = useState([]);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const stats = useMockResource('moderator:stats', moderationStats);
  const urgent = useMockResource('moderator:urgent', urgentModerationItems);
  const activity = useMockResource(
    'moderator:activity',
    { workload, audit },
    {
      isEmpty: (value) => !value.workload.length && !value.audit.length,
    },
  );
  const items = urgent.data.filter(
    (item) => priority === 'All' || item.tone === priority.toLowerCase(),
  );
  const closeDecision = () => {
    setSelected(null);
    setDecision('');
  };
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-caption text-muted">
              Ca làm: 03 giờ 45 phút · Đã xét hôm nay: <strong className="text-ink">42 mục</strong>{' '}
              · SLA đạt: <strong className="text-brand-strong">98,4%</strong>
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Tổng quan hoạt động kiểm duyệt</h1>
          </div>
          <Tabs
            label="Lọc theo mức ưu tiên"
            singleRow
            value={priority}
            onChange={setPriority}
            items={priorityTabs.map((item) => ({
              value: item.value,
              label: item.tone ? (
                <>
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${toneDot[item.tone]} ${priority === item.value ? 'ring-2 ring-on-brand/60' : ''}`}
                  />
                  {item.label}
                </>
              ) : (
                item.label
              ),
            }))}
          />
        </div>

        {stats.status === 'error' || stats.status === 'empty' ? (
          <Card as="section" aria-label="Chỉ số kiểm duyệt" className="mt-6 p-0">
            {stats.status === 'error' ? (
              <LoadError
                title="Không tải được chỉ số kiểm duyệt"
                description="Dịch vụ thống kê chưa phản hồi. Hàng đợi vẫn hoạt động bình thường."
                onRetry={stats.retry}
                className="py-10"
              />
            ) : (
              <EmptyState
                icon={BookOpenCheck}
                headingAs="h3"
                title="Chưa có số liệu ca làm"
                description="Chỉ số sẽ xuất hiện sau khi ca kiểm duyệt có quyết định đầu tiên."
                className="py-10"
                action={
                  <ButtonLink to="/moderator/submissions" variant="secondary" size="sm">
                    Mở hàng đợi bản thảo
                  </ButtonLink>
                }
              />
            )}
          </Card>
        ) : (
          <section
            aria-label={
              stats.status === 'loading' ? 'Đang tải chỉ số kiểm duyệt' : 'Chỉ số kiểm duyệt'
            }
            aria-busy={stats.status === 'loading'}
            className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-5"
          >
            {stats.status === 'loading'
              ? Array.from({ length: 5 }, (_, index) => (
                  <Card
                    key={index}
                    as="div"
                    aria-hidden="true"
                    className={`flex flex-col p-4 sm:p-5 ${index === 4 ? 'col-span-2 xl:col-span-1' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-8 flex-col gap-2 pt-0.5">
                        <Skeleton className="h-3 w-24" />
                      </span>
                      <Skeleton className="size-8 rounded-xl" />
                    </div>
                    <div className="mt-auto pt-3">
                      <Skeleton className="h-9 w-20 rounded-2xl" />
                    </div>
                    <Skeleton className="mt-3 h-6 w-24" />
                  </Card>
                ))
              : stats.data.map(([label, value, note, tone], index) => {
                  const Icon = metricIcons[index];
                  return (
                    <Card
                      key={label}
                      className={`nh-fade-enter flex flex-col p-4 sm:p-5 ${index === stats.data.length - 1 ? 'col-span-2 xl:col-span-1' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-xs font-semibold uppercase leading-4 tracking-[.06em] text-muted">
                          {statLabels[label] ?? label}
                        </span>
                        <span
                          aria-hidden="true"
                          className={`grid size-8 shrink-0 place-items-center rounded-xl ${toneTile[tone]}`}
                        >
                          <Icon size={16} />
                        </span>
                      </div>
                      <strong className="mt-auto block pt-3 text-3xl font-bold tabular-nums tracking-tight">
                        {value}
                      </strong>
                      <Badge tone={tone} className="mt-3 self-start">
                        {statNotes[note] ?? note}
                      </Badge>
                    </Card>
                  );
                })}
          </section>
        )}

        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card aria-busy={urgent.status === 'loading'}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <h2 className="flex items-center gap-2.5 text-h3 md:text-h2">
                  <span aria-hidden="true" className="size-2.5 rounded-full bg-rose" />
                  Mục hành động ưu tiên khẩn cấp
                </h2>
                {urgent.status === 'loading' ? (
                  <span className="flex h-5 items-center">
                    <span className="sr-only">Đang tải mục khẩn cấp…</span>
                    <Skeleton className="h-3 w-28" />
                  </span>
                ) : (
                  urgent.status === 'ready' && (
                    <span className="text-caption text-muted">{items.length} mục cần xử lý</span>
                  )
                )}
              </div>
              {urgent.status === 'loading' ? (
                <ul aria-hidden="true" className="mt-5 space-y-3">
                  {Array.from({ length: 4 }, (_, index) => (
                    <UrgentItemSkeleton key={index} />
                  ))}
                </ul>
              ) : urgent.status === 'error' ? (
                <LoadError
                  title="Không tải được mục khẩn cấp"
                  description="Hàng đợi ưu tiên chưa phản hồi. Hãy thử lại sau ít giây."
                  onRetry={urgent.retry}
                />
              ) : urgent.status === 'empty' ? (
                <EmptyState
                  icon={CheckCircle2}
                  headingAs="h3"
                  title="Không còn mục khẩn cấp"
                  description="Mọi mục ưu tiên đã được xử lý. Tiếp tục với hàng đợi bản thảo thông thường."
                  action={
                    <ButtonLink to="/moderator/submissions" variant="secondary" size="sm">
                      Mở hàng đợi bản thảo
                    </ButtonLink>
                  }
                />
              ) : items.length ? (
                <ul className="nh-fade-enter mt-5 space-y-3">
                  {items.map((item) => (
                    <UrgentItem
                      key={item.id}
                      item={item}
                      handled={handled.includes(item.id)}
                      onOpen={() => setSelected(item)}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  headingAs="h3"
                  title="Không có mục khẩn cấp"
                  description="Không có mục nào khớp mức ưu tiên đã chọn."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setPriority('All')}>
                      Xem tất cả mức ưu tiên
                    </Button>
                  }
                />
              )}
            </Card>

            {activity.status === 'error' || activity.status === 'empty' ? (
              <Card className="p-0">
                {activity.status === 'error' ? (
                  <LoadError
                    title="Không tải được khối lượng công việc và nhật ký"
                    description="Dữ liệu phân bổ hàng đợi và quyết định gần đây chưa phản hồi."
                    onRetry={activity.retry}
                  />
                ) : (
                  <EmptyState
                    icon={Gavel}
                    headingAs="h3"
                    title="Chưa có hoạt động trong ca"
                    description="Khối lượng theo thể loại và quyết định gần đây sẽ hiển thị khi ca làm bắt đầu tiếp nhận."
                    action={
                      <ButtonLink to="/moderator/audit-trail" variant="secondary" size="sm">
                        Xem nhật ký kiểm tra
                      </ButtonLink>
                    }
                  />
                )}
              </Card>
            ) : (
              <>
                <Card aria-busy={activity.status === 'loading'}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-h3">
                        Khối lượng công việc và lượng tiếp nhận theo thể loại
                      </h2>
                      <p className="mt-1 text-caption text-muted">
                        Phân bổ hàng đợi theo thể loại xuất bản theo thời gian thực
                      </p>
                    </div>
                    <Badge className="shrink-0 self-start">Cập nhật mỗi 60 giây</Badge>
                  </div>
                  {activity.status === 'loading' ? (
                    <ul aria-hidden="true" className="mt-6 space-y-5">
                      {Array.from({ length: 4 }, (_, index) => (
                        <li key={index}>
                          <div className="flex h-5 items-center gap-3">
                            <Skeleton className="h-3.5 w-52 max-w-[55%]" />
                            <Skeleton className="ml-auto h-3 w-28" />
                            <Skeleton className="h-3.5 w-10" />
                          </div>
                          <Skeleton className="mt-2 h-2 w-full" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="nh-fade-enter mt-6 space-y-5">
                      {activity.data.workload.map(([label, value, sla, tone]) => (
                        <li key={label}>
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
                            <span className="min-w-0 font-medium">{label}</span>
                            <span className="ml-auto text-xs text-muted">SLA: {sla}</span>
                            <strong className="w-10 text-right tabular-nums">{value}%</strong>
                          </div>
                          <ProgressBar
                            value={value}
                            tone={tone}
                            className="mt-2"
                            label={`Tỷ trọng hàng đợi ${label}`}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card aria-busy={activity.status === 'loading'}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-h3">Quyết định kiểm duyệt và nhật ký gần đây</h2>
                    <ButtonLink
                      to="/moderator/audit-trail"
                      variant="ghost"
                      size="sm"
                      trailingIcon={ArrowRight}
                      className="self-start sm:self-auto"
                    >
                      Xem toàn bộ nhật ký kiểm tra
                    </ButtonLink>
                  </div>
                  {activity.status === 'loading' ? (
                    <ol aria-hidden="true" className="mt-5 space-y-5 border-l border-hairline pl-6">
                      {Array.from({ length: 4 }, (_, index) => (
                        <li key={index} className="relative">
                          <span className="absolute -left-[29px] top-1.5">
                            <Skeleton className="size-2.5" />
                          </span>
                          <div className="flex h-6 items-center gap-2">
                            <Skeleton className="h-3.5 w-10" />
                            <Skeleton className="h-3.5 w-80 max-w-[50%]" />
                            <Skeleton className="h-6 w-24" />
                          </div>
                          <span className="mt-1 flex h-4 items-center">
                            <Skeleton className="h-3 w-72 max-w-full" />
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <ol className="nh-fade-enter mt-5 space-y-5 border-l border-hairline pl-6">
                      {activity.data.audit.map(([time, title, status, tone]) => (
                        <li key={time} className="relative">
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[29px] top-1.5 size-2.5 rounded-full ring-4 ring-surface ${tone === 'neutral' ? 'bg-ink/35' : toneDot[tone]}`}
                          />
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                            <time className="font-semibold tabular-nums">{time}</time>
                            <span className="min-w-0">{title}</span>
                            <Badge tone={tone}>{status}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            Ghi nhận bởi Sarah Jenkins · Tham chiếu kiểm tra bất biến
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>
              </>
            )}
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            <Card>
              <h2 className="flex items-center gap-2 text-h3">
                <ShieldCheck size={20} className="text-brand" />
                Chỉ thị chính sách
              </h2>
              <div className="mt-4 rounded-2xl border border-hairline bg-elevated p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">Creator Rights v4.2</strong>
                  <Badge tone="green">Đang áp dụng</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-ink/70">
                  Hướng dẫn trích dẫn sử dụng hợp lý được mở rộng đến 350 từ cho nội dung bình luận
                  phản biện và châm biếm.
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-orange/40 bg-orange/10 p-4">
                <strong className="flex items-center gap-2 text-sm text-orange-strong">
                  <AlertTriangle size={15} />
                  Hướng dẫn tín hiệu AI
                </strong>
                <p className="mt-2 text-xs leading-5 text-ink/75">
                  Điểm đo lường tự động chỉ là mốc tham khảo, không phải kết luận cuối cùng.
                </p>
              </div>
            </Card>

            <Card>
              <h2 className="text-h3">Tốc độ hàng đợi và SLA</h2>
              <div className="mt-5 space-y-5">
                <Sla label="Phân loại sơ bộ" value={100} />
                <Sla label="SLA phê duyệt xuất bản" value={94} />
                <Sla label="Giải quyết báo cáo người dùng" value={96} />
              </div>
            </Card>

            <Card>
              <h2 className="text-h3">Bộ phận chuyển cấp</h2>
              <ul className="mt-4 space-y-2.5">
                {escalationDesks.map(([name, initials, tone]) => {
                  const done = signaled.includes(name);
                  return (
                    <li
                      key={name}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-elevated p-3"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold ${toneTile[tone]}`}
                      >
                        {initials}
                      </span>
                      <div className="min-w-[9rem] flex-1">
                        <strong className="block text-sm leading-5">{name}</strong>
                        <p className="text-xs text-ink/70">Trực tuyến · Chuyên gia trực ca</p>
                      </div>
                      <Button
                        variant={done ? 'ghost' : 'secondary'}
                        size="sm"
                        aria-pressed={done}
                        onClick={() =>
                          setSignaled((current) =>
                            done ? current.filter((item) => item !== name) : [...current, name],
                          )
                        }
                        className="ml-auto shrink-0 px-3 text-xs"
                      >
                        {done ? <CheckCircle2 size={14} /> : <BellRing size={14} />}
                        {done ? 'Đã báo hiệu' : 'Báo hiệu'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {frozen ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose/40 bg-rose/10 p-3">
                  <strong className="flex items-center gap-2 text-sm text-rose-strong">
                    <Lock size={15} />
                    Hàng đợi đang đóng băng
                  </strong>
                  <Button variant="secondary" size="sm" onClick={() => setFrozen(false)}>
                    Gỡ đóng băng
                  </Button>
                </div>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setFreezeOpen(true)}
                  className="mt-4 w-full"
                >
                  <Lock size={15} />
                  Kích hoạt đóng băng hàng đợi khẩn cấp
                </Button>
              )}
            </Card>
          </aside>
        </div>

        <Modal
          open={Boolean(selected)}
          title={selected ? `${kindLabels[selected.kind] ?? selected.kind} #${selected.id}` : ''}
          onClose={closeDecision}
        >
          <h3 className="text-base font-semibold">{selected?.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            {selected && formatItemText(selected.detail)}
          </p>
          <label htmlFor="overview-decision" className="mt-5 block text-sm font-semibold">
            Ghi chú quyết định nội bộ
          </label>
          <textarea
            id="overview-decision"
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
            className={`${fieldClass} mt-2 min-h-24`}
            placeholder="Thêm ghi chú quyết định nội bộ..."
          />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={closeDecision}>
              Hoãn xử lý
            </Button>
            <Button
              onClick={() => {
                setHandled((current) => [...current, selected.id]);
                closeDecision();
              }}
            >
              <CheckCircle2 size={16} />
              Ghi nhận quyết định
            </Button>
          </div>
        </Modal>

        <Modal
          open={freezeOpen}
          title="Đóng băng hàng đợi khẩn cấp?"
          onClose={() => setFreezeOpen(false)}
        >
          <div className="flex gap-3 rounded-2xl border border-rose/30 bg-rose/10 p-4">
            <AlertTriangle className="shrink-0 text-rose-strong" />
            <p className="text-sm leading-6">
              Toàn bộ <strong>24 mục trong hàng đợi kiểm duyệt</strong> sẽ tạm dừng phân công và
              xuất bản cho đến khi được gỡ đóng băng.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setFreezeOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setFrozen(true);
                setFreezeOpen(false);
              }}
            >
              <Lock size={15} />
              Xác nhận đóng băng
            </Button>
          </div>
        </Modal>
      </div>
    </ModeratorLayout>
  );
}

function UrgentItem({ item, handled, onOpen }) {
  const Icon =
    item.kind === 'Report'
      ? FileWarning
      : item.kind === 'Similarity Flag'
        ? ShieldCheck
        : BookOpenCheck;
  return (
    <li
      className={`flex flex-col gap-4 rounded-2xl border bg-surface p-4 sm:flex-row sm:items-center ${toneBorder[item.tone]}`}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <span
          aria-hidden="true"
          className={`grid size-12 shrink-0 place-items-center rounded-2xl ${toneTile[item.tone]}`}
        >
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.tone}>
              {kindLabels[item.kind] ?? item.kind} #{item.id}
            </Badge>
            {handled && (
              <Badge tone="green">
                <CheckCircle2 size={12} />
                Đã ghi nhận
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{formatItemText(item.meta)}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{formatItemText(item.detail)}</p>
        </div>
      </div>
      <Button
        variant={item.tone === 'red' ? 'primary' : 'secondary'}
        size="sm"
        trailingIcon={ChevronRight}
        onClick={onOpen}
        className="shrink-0 self-end sm:self-auto"
      >
        {actionLabels[item.action] ?? item.action}
      </Button>
    </li>
  );
}

function Sla({ label, value }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <strong className="shrink-0 text-brand-strong tabular-nums">Đạt {value}%</strong>
      </div>
      <ProgressBar value={value} size="sm" className="mt-2" label={`${label}: đạt ${value}%`} />
    </div>
  );
}

/* Same card, 48px icon tile, text stack and trailing button as UrgentItem. */
function UrgentItemSkeleton() {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-4">
        <Skeleton className="size-12 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Skeleton className="h-6 w-36" />
          <span className="mt-2 flex h-6 items-center">
            <Skeleton className="h-4 w-2/3" />
          </span>
          <span className="mt-0.5 flex h-4 items-center">
            <Skeleton className="h-3 w-1/2" />
          </span>
          <span className="mt-1 flex h-5 items-center">
            <Skeleton className="h-3 w-5/6" />
          </span>
        </div>
      </div>
      <Skeleton className="h-9 w-32 shrink-0 self-end sm:self-auto" />
    </li>
  );
}

function LoadError({ title, description, onRetry, className }) {
  return (
    <EmptyState
      tone="rose"
      icon={AlertTriangle}
      headingAs="h3"
      title={title}
      description={description}
      className={className}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw size={14} />
          Thử lại
        </Button>
      }
    />
  );
}
