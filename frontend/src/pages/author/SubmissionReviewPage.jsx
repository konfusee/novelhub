import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookCheck,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  LockKeyhole,
  RefreshCw,
  Send,
  ShieldCheck,
  Tags,
} from '../../components/icons';
import { AuthorLayout } from '../../layouts';
import { ROUTES } from '../../app/routes';
import { useMockResource } from '../../context/MockDataContext';
import { StoryCover } from '../../components/story/StoryCover';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  ProgressBar,
  Skeleton,
} from '../../components/ui';

const EDITOR_PATH = '/author/stories/demo/chapters/chapter-1/edit';

const checklist = [
  [
    'Thông tin bắt buộc',
    'Đã hoàn thiện tiêu đề, tóm tắt và ảnh bìa.',
    'Bìa: 1600×2400 độ phân giải cao · Tóm tắt: 180 từ',
    FileCheck2,
  ],
  [
    'Số chương và số từ tối thiểu',
    'Đã chuẩn bị 5 chương, tổng cộng 14.200 từ.',
    'Chương 13–17 · Trung bình 2.840 từ/chương',
    BookCheck,
  ],
  [
    'Phân loại nội dung và cảnh báo nhạy cảm',
    'Được gắn PG-13 do có hiểm nguy kỳ ảo nhẹ.',
    'PG-13: Hiểm nguy / Hành động · Không phát hiện bạo lực trực diện',
    Tags,
  ],
  [
    'Thỏa thuận tác phẩm gốc và quyền tác giả',
    'Đã xác nhận sở hữu bản quyền tác phẩm gốc.',
    'Chữ ký điện tử trong hồ sơ đã được xác minh',
    ShieldCheck,
  ],
  [
    'Kiểm tra định dạng và kiểu chữ',
    'Định dạng Poppins hợp lệ, không có liên kết media hỏng.',
    'Thụt đầu dòng: Hợp lệ · 0 thẻ mồ côi',
    Eye,
  ],
];
const pipeline = [
  {
    title: 'Kiểm tra trước khi gửi',
    note: 'Hệ thống kiểm tra cú pháp, tính toàn vẹn chương và thông tin.',
  },
  {
    title: 'Hàng đợi kiểm duyệt',
    note: 'Được phân công cho Đội Biên tập Cấp cao để kiểm tra tuân thủ nội dung.',
  },
  {
    title: 'Phê duyệt và phát hành',
    note: 'Xuất bản ngay vào danh mục độc giả và gửi thông báo tới người đăng ký.',
  },
];

export function SubmissionReviewPage() {
  const [verified, setVerified] = useState(checklist.map(() => true));
  const [notes, setNotes] = useState(
    'Tập II tiếp nối thế giới truyện từ Tập I. Chương 16 có một số cảnh chiến đấu thần thoại ngắn, phù hợp hướng dẫn PG-13.',
  );
  const [detail, setDetail] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submission = useMockResource('author:submission:demo', checklist);
  const items = submission.data;
  const loaded = submission.status === 'ready';
  const passed = items.filter((_, index) => verified[index]).length;
  const ready = loaded && passed === items.length;
  const percent = items.length ? Math.round((passed / items.length) * 100) : 0;
  const detailItem = detail !== null ? items[detail] : undefined;
  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <nav aria-label="Đường dẫn" className="text-xs text-ink/70">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link
                to={ROUTES.author}
                className="inline-flex min-h-8 items-center hover:text-brand-strong"
              >
                Studio tác giả
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>Tiểu thuyết</li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                to={ROUTES.authorStory('demo')}
                className="inline-flex min-h-8 items-center hover:text-brand-strong"
              >
                The Silent Forest
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-brand-strong">
              Kiểm duyệt và gửi duyệt
            </li>
          </ol>
        </nav>

        <Card bezel className="mt-5" innerClassName="p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 gap-4 sm:gap-5">
              <StoryCover
                story={{ title: 'The Silent Forest', author: 'Mira Lane' }}
                eager
                className="aspect-[2/3] w-20 shrink-0 rounded-xl shadow-soft sm:w-24"
              />
              <div className="min-w-0 self-center">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone="green">Tập bản thảo</Badge>
                  <span className="whitespace-nowrap text-xs font-medium text-ink/70 tabular-nums">
                    ID: #MS-88402
                  </span>
                </p>
                <h1 className="mt-3 text-h3 sm:text-h1">Gửi bản thảo để kiểm duyệt và xuất bản</h1>
                <p className="mt-2 text-sm text-muted">
                  Truyện:{' '}
                  <strong className="text-ink">The Silent Forest: Tập II, Roots of Eldoria</strong>
                </p>
              </div>
            </div>
            <dl className="grid shrink-0 grid-cols-2 divide-x divide-hairline rounded-2xl bg-elevated py-3 text-center">
              <div className="px-5">
                <dt className="text-xs text-ink/70">Tổng số chương</dt>
                <dd className="mt-0.5 text-base font-semibold">5 chương mới</dd>
              </div>
              <div className="px-5">
                <dt className="text-xs text-ink/70">Số từ</dt>
                <dd className="mt-0.5 text-base font-semibold text-brand-strong">14.200 từ</dd>
              </div>
            </dl>
          </div>
        </Card>

        {submission.status === 'loading' ? (
          <StatusSkeleton />
        ) : loaded ? (
          <div
            role="status"
            className="nh-fade-enter mt-5 flex flex-col gap-4 rounded-3xl border border-hairline bg-elevated p-5 sm:flex-row sm:items-center"
          >
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-full ${ready ? 'bg-brand text-on-brand' : 'bg-orange text-on-orange'}`}
            >
              {ready ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            </span>
            <div className="min-w-0">
              <strong className="text-base">
                {submitted ? 'Đã gửi vào hàng đợi kiểm duyệt' : 'Đang kiểm tra bản nháp'}
              </strong>
              <p className="mt-0.5 text-sm text-ink/70">
                {submitted
                  ? 'Bản thảo đang chờ biên tập, thời gian dự kiến 12–24 giờ.'
                  : ready
                    ? `Sẵn sàng gửi (${percent}% danh sách kiểm tra đạt yêu cầu)`
                    : `Còn ${items.length - passed} mục cần xử lý trước khi gửi (${percent}% đạt yêu cầu)`}
              </p>
            </div>
            <div className="sm:ml-auto sm:w-56">
              <ProgressBar
                value={percent}
                tone={ready ? 'brand' : 'orange'}
                label="Tiến độ danh sách kiểm tra"
              />
              <p
                className={`mt-1.5 text-right text-xs font-semibold tabular-nums ${ready ? 'text-brand-strong' : 'text-orange-strong'}`}
              >
                {percent}%
              </p>
            </div>
          </div>
        ) : null}

        <div className="nh-grid-12 mt-6 grid items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-5">
                <div className="min-w-0">
                  <h2 className="text-h3">Danh sách kiểm tra trước khi gửi</h2>
                  <p className="mt-1 text-sm text-muted">
                    Các tiêu chí xác thực bắt buộc theo Tiêu chuẩn Chất lượng NovelHub
                  </p>
                </div>
                {loaded ? (
                  <Badge tone={ready ? 'green' : 'orange'}>
                    {passed} / {items.length} đã xác minh
                  </Badge>
                ) : submission.status === 'loading' ? (
                  <Skeleton className="h-6 w-32" />
                ) : null}
              </div>
              {submission.status === 'loading' ? (
                <ol
                  className="mt-5 space-y-3"
                  aria-busy="true"
                  aria-label="Đang tải danh sách kiểm tra"
                >
                  {checklistSkeletons.map((lines, index) => (
                    <ChecklistSkeleton key={index} {...lines} />
                  ))}
                </ol>
              ) : submission.status === 'error' ? (
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  headingAs="h3"
                  title="Không tải được gói gửi duyệt"
                  description="Kết nối tới máy chủ bị gián đoạn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={submission.retry} />}
                />
              ) : submission.status === 'empty' ? (
                <EmptyState
                  icon={FileCheck2}
                  headingAs="h3"
                  title="Chưa có nội dung để gửi duyệt"
                  description="Gói gửi duyệt cần ít nhất một chương hoàn chỉnh. Hãy viết hoặc nhập chương trước khi kiểm tra."
                  action={
                    <ButtonLink to={EDITOR_PATH} size="sm">
                      <ArrowLeft size={14} aria-hidden="true" />
                      Mở trình soạn thảo
                    </ButtonLink>
                  }
                />
              ) : (
                <ol className="nh-fade-enter mt-5 space-y-3">
                  {items.map(([title, description, meta, Icon], index) => {
                    const ok = verified[index];
                    return (
                      <li
                        key={title}
                        className={`flex gap-3 rounded-2xl border p-4 transition-[border-color,background-color] duration-200 sm:gap-4 ${ok ? 'border-hairline' : 'border-rose/40 bg-rose/5'}`}
                      >
                        <button
                          type="button"
                          aria-pressed={ok}
                          aria-label={`${title}: ${ok ? 'đã đạt, bấm để đánh dấu chưa đạt' : 'chưa đạt, bấm để đánh dấu đã đạt'}`}
                          onClick={() =>
                            setVerified((current) =>
                              current.map((value, itemIndex) =>
                                itemIndex === index ? !value : value,
                              ),
                            )
                          }
                          className={`grid size-8 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-[0.96] ${ok ? 'bg-brand/12 text-brand-strong' : 'bg-rose/14 text-rose-strong'}`}
                        >
                          {ok ? <Check size={16} /> : <AlertTriangle size={15} />}
                        </button>
                        <div className="grid min-w-0 flex-1 items-start gap-x-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <h3 className="flex items-start gap-2 text-sm font-semibold leading-6">
                            <Icon
                              size={16}
                              className="mt-1 shrink-0 text-brand"
                              aria-hidden="true"
                            />
                            <span>
                              {index + 1}. {title}
                            </span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setDetail(index)}
                            className="order-last -mb-2.5 -mt-0.5 justify-self-start py-2.5 text-xs font-semibold leading-6 text-brand-strong underline-offset-4 hover:underline sm:order-none sm:-mt-2.5"
                          >
                            Xem chi tiết
                          </button>
                          <p className="mt-1 text-sm text-muted sm:col-start-1">{description}</p>
                          <p className="mt-2 w-fit max-w-full rounded-2xl bg-elevated px-3 py-1 text-xs font-medium leading-5 text-ink/70 sm:col-start-1">
                            {meta}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>

            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 max-w-[60ch]">
                  <h2 className="text-h3">
                    <label htmlFor="moderator-notes">Ghi chú của tác giả cho kiểm duyệt viên</label>
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Thêm thông tin về tính nhất quán thế giới truyện, nội dung nhạy cảm hoặc bối
                    cảnh để biên tập viên đánh giá nhanh hơn.
                  </p>
                </div>
                <Badge>Thông tin không bắt buộc</Badge>
              </div>
              <textarea
                id="moderator-notes"
                value={notes}
                maxLength={500}
                onChange={(event) => setNotes(event.target.value)}
                aria-describedby="moderator-notes-hint"
                className="mt-5 min-h-36 w-full resize-y rounded-2xl border border-line bg-elevated p-4 text-base leading-6 outline-none transition-[border-color] duration-200 focus:border-brand sm:text-sm"
              />
              <div className="mt-2 flex flex-col-reverse gap-2 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
                <p id="moderator-notes-hint" className="flex items-center gap-2">
                  <LockKeyhole size={13} className="shrink-0 text-brand" aria-hidden="true" />
                  Ghi chú này chỉ hiển thị cho bạn và bộ phận biên tập kiểm duyệt.
                </p>
                <p className="tabular-nums sm:text-right">{notes.length} / 500 ký tự</p>
              </div>
            </Card>

            <Card className="flex flex-col gap-4 2xl:flex-row 2xl:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                  <Clock3 size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <strong className="text-sm">{ready ? 'Có thể gửi ngay' : 'Chưa thể gửi'}</strong>
                  <p className="text-xs text-muted">
                    {ready
                      ? 'Bản thảo sẽ được phân công trong vòng 10 phút sau khi gửi.'
                      : 'Hoàn tất mọi mục trong danh sách kiểm tra để mở khóa nút gửi.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end 2xl:ml-auto">
                <ButtonLink to={EDITOR_PATH} variant="secondary">
                  <ArrowLeft size={16} aria-hidden="true" />
                  Lưu và quay lại trình soạn thảo
                </ButtonLink>
                <Button disabled={!ready || submitted} onClick={() => setConfirmOpen(true)}>
                  {submitted ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Send size={16} aria-hidden="true" />
                  )}
                  {submitted ? 'Đã gửi' : 'Gửi xét duyệt'}
                </Button>
              </div>
            </Card>
          </div>

          <aside className="min-w-0 space-y-5 xl:sticky xl:top-24">
            <Card>
              <h2 className="flex items-start justify-between gap-3 text-base font-semibold">
                Quy trình xuất bản và thời gian xét duyệt
                <BarChart3 className="mt-0.5 shrink-0 text-brand" size={18} aria-hidden="true" />
              </h2>
              <ol className="mt-5">
                {pipeline.map((step, index) => (
                  <PipelineStep
                    key={step.title}
                    number={index + 1}
                    title={step.title}
                    note={step.note}
                    done={index === 0 && ready}
                    current={index === 1 || (index === 0 && !ready)}
                    last={index === pipeline.length - 1}
                    status={
                      index === 0 && submission.status === 'loading' ? (
                        <Skeleton className="inline-block h-3 w-44 align-middle" />
                      ) : index === 0 && ready ? (
                        'Trạng thái: Đạt và đã xác minh'
                      ) : index === 1 && submitted ? (
                        'Trạng thái: Đang chờ phân công'
                      ) : null
                    }
                  />
                ))}
              </ol>
            </Card>
            <Card>
              <h2 className="text-base font-semibold">Lịch sử xét duyệt gần đây</h2>
              <p className="mt-0.5 text-sm text-muted">Nhật ký trước đây của bộ tiểu thuyết này</p>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">Tập I (Chương 1–12)</strong>
                  <Badge tone="green">Đã phê duyệt</Badge>
                </div>
                <p className="mt-2 text-xs text-ink/70">
                  Được Bộ phận Kiểm duyệt #4 xét duyệt ngày 14/10/2026
                </p>
                <blockquote className="mt-3 rounded-xl bg-surface p-3 text-sm italic leading-6">
                  “Văn phong sạch, thế giới cuốn hút. Thẻ phân loại chính xác. Sẵn sàng phân phối
                  cao cấp.”
                </blockquote>
              </div>
            </Card>
            <Card as="figure" className="bg-brand-soft text-center">
              <blockquote className="text-sm italic leading-6">
                “Truyện hay còn trở nên tốt hơn nhờ biên tập kỹ lưỡng. Đội ngũ xét duyệt luôn cố
                gắng giữ tiếng nói sáng tạo của bạn đồng thời bảo vệ độc giả.”
              </blockquote>
              <figcaption className="mt-3 text-xs font-semibold text-brand-strong">
                Tiêu chuẩn Biên tập NovelHub
              </figcaption>
            </Card>
          </aside>
        </div>

        <Modal
          open={Boolean(detailItem)}
          title={detailItem?.[0] ?? ''}
          onClose={() => setDetail(null)}
        >
          <p className="text-sm leading-6 text-muted">{detailItem?.[1]}</p>
          <div className="mt-4 rounded-2xl bg-elevated p-4 text-sm">{detailItem?.[2]}</div>
          <Button variant="secondary" onClick={() => setDetail(null)} className="mt-5 w-full">
            Đóng chi tiết
          </Button>
        </Modal>
        <Modal open={confirmOpen} title="Xác nhận gửi duyệt" onClose={() => setConfirmOpen(false)}>
          <p className="text-sm leading-6 text-muted">
            Bản mô phỏng giao diện này sẽ đưa bản thảo vào hàng đợi kiểm duyệt. Không có yêu cầu ra
            bên ngoài hoặc hoạt động xuất bản thật nào diễn ra.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => {
                setSubmitted(true);
                setConfirmOpen(false);
              }}
            >
              <Send size={16} aria-hidden="true" />
              Xác nhận gửi bản mẫu
            </Button>
          </div>
        </Modal>
      </div>
    </AuthorLayout>
  );
}

function PipelineStep({ number, title, note, done, current, last, status }) {
  return (
    <li
      className={`relative flex gap-3 ${last ? '' : 'pb-6'} ${!done && !current ? 'opacity-60' : ''}`}
    >
      {!last && (
        <span
          aria-hidden="true"
          className={`absolute left-3.5 top-8 bottom-0 w-px ${done ? 'bg-brand' : 'bg-line'}`}
        />
      )}
      <span
        className={`relative grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${done ? 'border-brand bg-brand text-on-brand' : 'border-brand bg-surface text-brand-strong'}`}
      >
        {done ? <Check size={14} aria-label="Hoàn tất" /> : number}
      </span>
      <div className="min-w-0 pt-0.5">
        <strong className="text-sm">{title}</strong>
        <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
        {status && <p className="mt-2 text-xs font-medium text-brand-strong">{status}</p>}
      </div>
    </li>
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

function StatusSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải trạng thái kiểm tra"
      className="mt-5 flex flex-col gap-4 rounded-3xl border border-hairline bg-elevated p-5 sm:flex-row sm:items-center"
    >
      <Skeleton className="size-11 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <Skeleton className="my-[4.8px] h-4 w-48" />
        <span className="mt-0.5 flex flex-col">
          <Skeleton className="my-[3px] h-3.5 w-72 max-w-full" />
          <Skeleton className="my-[3px] h-3.5 w-24 lg:hidden" />
        </span>
      </div>
      <div className="flex flex-col sm:ml-auto sm:w-56">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="mb-0.5 ml-auto mt-2 h-3 w-8" />
      </div>
    </div>
  );
}

/* Wrapped line boxes of the five mock checklist rows below sm (one line each from sm up). */
const checklistSkeletons = [
  { wideTitle: false, badge: 'h-10' },
  { wideTitle: true, badge: 'h-10' },
  { wideTitle: true, badge: 'h-14' },
  { wideTitle: true, badge: 'h-10' },
  { wideTitle: true, badge: 'h-10' },
];

function ChecklistSkeleton({ wideTitle, badge }) {
  return (
    <li aria-hidden="true" className="flex gap-3 rounded-2xl border border-hairline p-4 sm:gap-4">
      <Skeleton className="size-8 shrink-0" />
      <div className="grid min-w-0 flex-1 items-start gap-x-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <span className="flex flex-col">
          <Skeleton className="my-1 h-4 w-3/5" />
          {wideTitle && <Skeleton className="my-1 h-4 w-2/5 sm:hidden" />}
        </span>
        <span className="order-last mt-2 flex h-6 items-center justify-self-start sm:order-none sm:mt-0">
          <Skeleton className="h-3 w-20" />
        </span>
        <span className="mt-1 flex flex-col sm:col-start-1">
          <Skeleton className="my-[3px] h-3.5 w-full sm:w-4/5" />
          <Skeleton className="my-[3px] h-3.5 w-3/5 sm:hidden" />
        </span>
        <div className="sm:col-start-1">
          <Skeleton className={`mt-2 w-64 max-w-full sm:h-6 ${badge}`} />
        </div>
      </div>
    </li>
  );
}
