import { useState } from 'react';
import { useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  Gavel,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
} from '../../components/icons';
import { ModeratorLayout } from '../../layouts';
import { StoryCover } from '../../components/story/StoryCover';
import { useMockResource } from '../../context/MockDataContext';
import { Badge, Button, ButtonLink, Card, EmptyState, Modal, Skeleton } from '../../components/ui';

const SUBMISSION = {
  id: 'MS-88402',
  story: { id: 'silent-forest', title: 'The Silent Forest: Volume II', author: 'Elena Vance' },
};
const chapters = [
  ['Chương 13: Silver Passage', 'Sạch'],
  ['Chương 14: Echoes', 'Sạch'],
  ['Chương 15: The Threshold', 'Sạch'],
  ['Chương 16: Heart of Ironwood', '1 cảnh báo'],
  ['Chương 17: Afterlight', 'Đang chờ'],
];
const FLAGGED_CHAPTER = 3;
const chapterStatusTone = { Sạch: 'green', '1 cảnh báo': 'orange', 'Đang chờ': 'neutral' };
const policyChecks = [
  'Đã xác minh quyền tác giả gốc',
  'Ảnh bìa đáp ứng chuẩn 1600×2400',
  'Phân loại PG-13 phù hợp mức bạo lực trong truyện',
  'Không có nội dung quảng cáo hoặc liên kết ngoài bị cấm',
  'Định dạng chương và phông Poppins không chân đạt chuẩn',
];
const decisions = {
  approve: {
    label: 'Phê duyệt và xuất bản',
    short: 'Phê duyệt',
    icon: CheckCircle2,
    variant: 'primary',
    tone: 'green',
  },
  changes: {
    label: 'Yêu cầu tác giả chỉnh sửa',
    short: 'Yêu cầu chỉnh sửa',
    icon: Edit3,
    variant: 'outline',
    tone: 'orange',
    needsReason: true,
  },
  escalate: {
    label: 'Chuyển bộ phận pháp lý',
    short: 'Chuyển cấp',
    icon: Scale,
    variant: 'secondary',
    tone: 'purple',
  },
  reject: {
    label: 'Từ chối bản thảo',
    short: 'Từ chối',
    icon: Gavel,
    variant: 'danger',
    tone: 'red',
    needsReason: true,
    destructive: true,
  },
};
const prose = [
  'The canopy of the ancient Ironwood did not sway with the wind. It stood rigid, carved of petrified amber and obsidian vines that drank what little starlight escaped the northern haze. Kaelen tightened his wrist bindings, feeling the steady hum of the meridian sigil pulsing beneath his glove.',
  '“Three leagues north,” Sorsha murmured, not lifting her gaze from the cracked slate compass. Her breathing was measured, though the silver embroidery along her mantle had frayed during their descent through the weeping gorge. “If the crest holds, the inner ward will open before dawn. If it fails, we will be standing directly in their line of sight.”',
  'Neither of them spoke of the scouts they had left at the ford. The silence of the Great Weave was answer enough. Across serialized fantasy traditions, silence often preceded reckoning; Kaelen knew the lore better than any novice scribe from the outer ring.',
  'They crossed the frostline in silence. Beneath their soles, the crystalline foliage fractured with a tone like chiming porcelain. With every dozen paces, the ambient temperature dipped further, frosting the bronze edges of their scabbards until small sparks jumped between their cloaks.',
  '“Listen,” Sorsha halted, her gloved fingers resting on the pommel of her side-blade. “The ridge is vacant. The wardens shouldn’t have abandoned the southern overlook unless something broke the gate wards from inside.”',
  'A tremor shuddered through the peat. It was not the organic shudder of shifting earth, but the metallic crunch of iron roots shearing against subterranean rock.',
];
const fieldClass =
  'w-full rounded-2xl border border-line p-3 text-base leading-6 text-ink outline-none transition-colors placeholder:text-muted focus:border-brand sm:text-sm';
const chapterNumber = (title) => title.split(':')[0].replace('Chương ', '');
const submissionDetail = { story: SUBMISSION.story, chapters, prose };

export function ContentReviewDetailPage() {
  const { submissionId = SUBMISSION.id } = useParams();
  const review = useMockResource(`submission:${submissionId}`, submissionDetail, {
    isEmpty: (value) => !value.chapters.length,
  });
  const detail = review.data;
  const [activeChapter, setActiveChapter] = useState(FLAGGED_CHAPTER);
  const [reviewed, setReviewed] = useState(false);
  const [checks, setChecks] = useState(policyChecks.map(() => true));
  const [notes, setNotes] = useState(
    'Đã xác minh văn phong. Các cảnh hành động ở Chương 16 tuân thủ hướng dẫn kỳ ảo PG-13. Không có máu me trực diện. Thẻ chính xác và phù hợp để độc giả khám phá.',
  );
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [completed, setCompleted] = useState(null);
  const passed = checks.filter(Boolean).length;
  const [chapterTitle] = detail.chapters[activeChapter] ?? [''];
  const pending = decision ? decisions[decision] : null;
  const openDecision = (key) => {
    setReason(notes);
    setDecision(key);
  };
  return (
    <ModeratorLayout>
      <div className="page-moderator py-6">
        <div className="flex flex-col gap-4 border-b border-hairline pb-5 lg:flex-row lg:items-center">
          <ButtonLink
            to="/moderator/submissions"
            variant="ghost"
            size="sm"
            className="-ml-3 self-start lg:self-auto"
          >
            <ArrowLeft size={15} />
            Quay lại hàng đợi bản thảo
          </ButtonLink>
          <div className="min-w-0 lg:border-l lg:border-hairline lg:pl-5">
            <p className="text-sm">
              Đang xét duyệt bản thảo <strong className="tabular-nums">#{submissionId}</strong>
            </p>
            {review.status === 'loading' ? (
              <span className="flex h-4 items-center">
                <Skeleton className="h-3 w-64 max-w-full" />
              </span>
            ) : (
              review.status === 'ready' && (
                <p className="nh-fade-enter text-xs text-muted">
                  {detail.story.author} · Tác giả đã xác minh · Gửi 18 giờ trước
                </p>
              )
            )}
          </div>
          {review.status === 'loading' ? (
            <div aria-hidden="true" className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-9 w-[7.5rem]" />
              <Skeleton className="h-9 w-40" />
            </div>
          ) : (
            review.status === 'ready' && (
              <div className="nh-fade-enter flex flex-wrap items-center gap-2 lg:ml-auto">
                <Badge tone="orange">SLA: còn 5 giờ 42 phút</Badge>
                {completed ? (
                  <Badge tone={decisions[completed].tone}>
                    <Check size={12} />
                    Đã ghi nhận: {decisions[completed].short}
                  </Badge>
                ) : (
                  <>
                    <Button size="sm" onClick={() => openDecision('approve')}>
                      <CheckCircle2 size={15} />
                      Phê duyệt
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openDecision('changes')}>
                      Yêu cầu chỉnh sửa
                    </Button>
                  </>
                )}
              </div>
            )
          )}
        </div>

        {review.status === 'loading' ? (
          <ReviewSkeleton />
        ) : review.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              headingAs="h1"
              title={`Không tải được bản thảo #${submissionId}`}
              description="Nội dung chương và tín hiệu kiểm duyệt chưa phản hồi. Bản thảo vẫn được giữ trong hàng đợi."
              action={
                <Button variant="secondary" size="sm" onClick={review.retry}>
                  <RotateCcw size={14} />
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : review.status === 'empty' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              icon={FileText}
              headingAs="h1"
              title={`Bản thảo #${submissionId} chưa có chương`}
              description="Tác giả chưa gửi chương nào trong lô này, hoặc lô đã được rút khỏi hàng đợi."
              action={
                <ButtonLink to="/moderator/submissions" variant="secondary" size="sm">
                  <ArrowLeft size={14} />
                  Quay lại hàng đợi bản thảo
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <div className="nh-fade-enter nh-grid-12 mt-6 grid items-start gap-5 nh-layout-xl-3-6-3">
            <aside className="order-2 grid min-w-0 gap-4 sm:grid-cols-2 xl:order-none xl:grid-cols-1">
              <Card className="p-4">
                <div className="flex gap-3">
                  <StoryCover
                    story={detail.story}
                    className="aspect-[2/3] w-16 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0">
                    <Badge tone="orange">PG-13</Badge>
                    <h2 className="mt-2 text-sm font-semibold leading-5">{detail.story.title}</h2>
                    <p className="mt-1 text-xs text-muted">Kỳ ảo · 14.200 từ</p>
                  </div>
                </div>
                <p className="mt-4 border-t border-hairline pt-3 text-xs text-muted">
                  Lô: 5 chương · Lô #4 / 6
                </p>
              </Card>
              <Card className="p-4 sm:row-span-2 xl:row-span-1">
                <h2 className="text-sm font-semibold">Các chương gửi duyệt</h2>
                <ul className="mt-3 space-y-1">
                  {detail.chapters.map(([title, status], index) => {
                    const active = activeChapter === index;
                    return (
                      <li key={title}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => setActiveChapter(index)}
                          className={`w-full whitespace-normal rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 ${active ? 'bg-brand/12 text-brand-strong' : 'hover:bg-elevated'}`}
                        >
                          <span className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 flex-1 text-xs font-medium leading-5">
                              {title}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-2 pl-[22px]">
                            <Badge tone={chapterStatusTone[status]} className="px-2 py-0.5 text-xs">
                              {status}
                            </Badge>
                            {active && <span className="text-xs text-muted">Đang mở</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Card className="p-4">
                <h2 className="text-sm font-semibold">Thông số bản gửi</h2>
                <dl className="mt-3 space-y-2 text-xs">
                  {[
                    ['Độc giả mục tiêu', 'Thanh thiếu niên (14+)'],
                    ['Tỷ lệ bìa', '1600 × 2400'],
                    ['Khớp bản quyền', '100%'],
                    ['Kiếm tiền', 'Khóa bằng xu (từ Chương 15)'],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt className="text-muted">{term}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </aside>

            <article className="order-1 min-w-0 rounded-3xl border border-line bg-reader p-5 shadow-whisper sm:p-8 xl:order-none">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted">
                The Silent Forest · Volume II
              </p>
              <h1 className="mt-2 text-h2 sm:text-h1">{chapterTitle}</h1>
              <p className="mt-2 text-xs text-muted">
                Số từ: 2.150 · Thời gian đọc: ~9 phút · Phông: Poppins 17px/31px
              </p>
              <div className="mt-6 rounded-2xl border border-hairline bg-surface p-4">
                <strong className="flex items-center gap-2 text-sm">
                  <FileText size={15} className="shrink-0 text-brand" />
                  Ghi chú gửi duyệt của tác giả (Elena Vance):
                </strong>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Tập II tiếp nối thế giới truyện từ Tập I. Chương 16 có cảnh chiến đấu thần thoại
                  tuân thủ tiêu chuẩn PG-13.
                </p>
              </div>
              <div className="mx-auto mt-8 max-w-[68ch] space-y-6">
                {detail.prose.map((paragraph, index) =>
                  index === 5 && activeChapter === FLAGGED_CHAPTER ? (
                    <FlaggedText
                      key={paragraph}
                      reviewed={reviewed}
                      onReview={() => setReviewed((value) => !value)}
                    >
                      {paragraph}
                    </FlaggedText>
                  ) : (
                    <p key={paragraph} className="text-base leading-8 sm:text-[17px] sm:leading-9">
                      {paragraph}
                    </p>
                  ),
                )}
              </div>
              <div className="mt-8 flex flex-col justify-between gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center">
                <span className="flex items-center gap-2 text-xs text-brand-strong">
                  <CheckCircle2 size={15} className="shrink-0" />
                  Dấu xác minh cuối Chương {chapterNumber(chapterTitle)} · Đã hiển thị 2.150 từ
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setActiveChapter((value) => Math.max(0, value - 1))}
                    disabled={activeChapter === 0}
                    variant="secondary"
                    size="sm"
                  >
                    <ChevronLeft size={14} />
                    Trước
                  </Button>
                  <Button
                    onClick={() =>
                      setActiveChapter((value) => Math.min(detail.chapters.length - 1, value + 1))
                    }
                    disabled={activeChapter === detail.chapters.length - 1}
                    variant="secondary"
                    size="sm"
                  >
                    Sau
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </article>

            <aside className="order-3 min-w-0 space-y-4 xl:sticky xl:top-24 xl:order-none">
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <Sparkles size={17} className="text-purple" />
                    Chỉ số và tín hiệu AI
                  </h2>
                  <Badge tone="purple">Bộ máy v4.2</Badge>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Tín hiệu chỉ là dữ liệu hỗ trợ, không phải phán quyết tự động.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Signal label="Điểm an toàn nội dung" value="98,2%" note="Nội dung sạch" />
                  <Signal
                    label="Chỉ số bạo lực/máu me"
                    value="14%"
                    note="Vùng an toàn PG-13"
                    tone="orange"
                  />
                  <Signal label="Chỉ số đạo văn" value="1,2%" note="Văn phong gốc 100%" />
                  <Signal
                    label="Mức phù hợp nhịp độ"
                    value="94%"
                    note="Mạch truyện kỳ ảo dài kỳ"
                    tone="purple"
                  />
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">
                    Danh sách kiểm tra chính sách biên tập
                  </h2>
                  <Badge tone={passed === policyChecks.length ? 'green' : 'red'}>
                    {passed} / {policyChecks.length}
                  </Badge>
                </div>
                <ul className="mt-4 space-y-2">
                  {policyChecks.map((label, index) => (
                    <li key={label}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checks[index]}
                        onClick={() =>
                          setChecks((current) =>
                            current.map((value, itemIndex) =>
                              itemIndex === index ? !value : value,
                            ),
                          )
                        }
                        className="flex w-full items-start gap-2.5 whitespace-normal rounded-xl px-2 py-1.5 text-left transition-colors duration-200 hover:bg-elevated"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${checks[index] ? 'bg-brand text-on-brand' : 'bg-rose/16 text-rose-strong'}`}
                        >
                          {checks[index] ? <Check size={12} /> : <AlertTriangle size={11} />}
                        </span>
                        <span className="text-xs leading-5">{label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-5">
                <label htmlFor="review-notes" className="text-base font-semibold">
                  Ghi chú và lý do của kiểm duyệt viên
                </label>
                <textarea
                  id="review-notes"
                  value={notes}
                  maxLength={500}
                  onChange={(event) => setNotes(event.target.value)}
                  className={`${fieldClass} mt-3 min-h-28 bg-elevated`}
                />
                <p className="mt-1.5 text-right text-xs text-muted tabular-nums">
                  {notes.length} / 500 ký tự
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted">
                  Quyết định cuối cùng
                </p>
                {completed && (
                  <p
                    role="status"
                    className="mt-3 flex items-center gap-2 rounded-2xl bg-brand/12 px-3 py-2 text-sm font-semibold text-brand-strong"
                  >
                    <CheckCircle2 size={16} className="shrink-0" />
                    Đã ghi nhận quyết định: {decisions[completed].label}
                  </p>
                )}
                <div className="mt-3 grid gap-2">
                  <DecisionButton id="approve" onClick={openDecision} className="w-full" />
                  <DecisionButton id="changes" onClick={openDecision} className="w-full" />
                  <div className="grid grid-cols-2 gap-2">
                    <DecisionButton id="escalate" short onClick={openDecision} />
                    <DecisionButton id="reject" short onClick={openDecision} />
                  </div>
                </div>
              </Card>
            </aside>
          </div>
        )}

        <Modal
          open={Boolean(pending)}
          title={pending?.destructive ? 'Từ chối bản thảo này?' : 'Ghi nhận quyết định kiểm duyệt'}
          onClose={() => setDecision(null)}
        >
          {pending && (
            <>
              <div
                className={`flex gap-3 rounded-2xl p-4 ${pending.destructive ? 'border border-rose/30 bg-rose/10' : 'bg-surface'}`}
              >
                <ShieldAlert
                  className={`shrink-0 ${pending.destructive ? 'text-rose-strong' : 'text-orange-strong'}`}
                />
                <div className="min-w-0">
                  <strong className="text-sm">{pending.label}</strong>
                  <p className="mt-1 text-sm leading-6 text-ink/75">
                    Áp dụng cho <strong>{detail.story.title}</strong> (#{submissionId},{' '}
                    {detail.chapters.length} chương).{' '}
                    {pending.destructive
                      ? 'Tác giả sẽ nhận thông báo từ chối và bản thảo rời khỏi hàng đợi.'
                      : 'Thao tác mẫu này chỉ thêm quyết định vào nhật ký kiểm tra cục bộ.'}
                  </p>
                </div>
              </div>
              {decision === 'approve' && passed < policyChecks.length && (
                <p className="mt-3 flex items-start gap-2 text-sm text-rose-strong">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Còn {policyChecks.length - passed} mục kiểm tra chính sách chưa đạt.
                </p>
              )}
              <label htmlFor="decision-reason" className="mt-4 block text-sm font-semibold">
                Lý do đưa ra quyết định{pending.needsReason ? ' (bắt buộc)' : ''}
              </label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={`${fieldClass} mt-2 min-h-24 bg-surface`}
                placeholder="Lý do đưa ra quyết định..."
              />
              {/* Actions stay reachable when the dialog scrolls (short landscape screens, soft keyboard).
                  Sticky offsets resolve inside the panel's 24px padding, hence -bottom-6. */}
              <div className="sticky -bottom-6 -mx-6 -mb-6 mt-5 flex flex-wrap justify-end gap-2 border-t border-hairline bg-elevated px-6 py-4">
                <Button variant="secondary" onClick={() => setDecision(null)}>
                  Hủy
                </Button>
                <Button
                  variant={pending.destructive ? 'danger' : 'primary'}
                  disabled={pending.needsReason && !reason.trim()}
                  onClick={() => {
                    setCompleted(decision);
                    setDecision(null);
                  }}
                >
                  {pending.destructive ? 'Xác nhận từ chối' : 'Xác nhận quyết định'}
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </ModeratorLayout>
  );
}

function DecisionButton({ id, short = false, onClick, className = '' }) {
  const { label, short: shortLabel, icon: Icon, variant } = decisions[id];
  return (
    <Button
      variant={variant}
      onClick={() => onClick(id)}
      className={`${short ? 'px-3 text-sm' : ''} ${className}`}
    >
      <Icon size={15} />
      {short ? shortLabel : label}
    </Button>
  );
}

function FlaggedText({ children, reviewed, onReview }) {
  return (
    <div className="rounded-2xl border border-orange/60 bg-orange/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-orange-strong">
        <AlertTriangle size={14} className="shrink-0" />
        Kiểm tra thẻ cảnh báo: Chiến đấu thần thoại và thương tích
        <Badge tone="orange">Phù hợp tiêu chí PG-13</Badge>
      </div>
      <p className="mt-4 text-base leading-8 sm:text-[17px] sm:leading-9">{children}</p>
      <div className="mt-4 flex flex-col gap-2 border-t border-orange/30 pt-3 text-xs text-ink/70 sm:flex-row sm:items-center sm:justify-between">
        <span>Chỉ số xét duyệt: Cường độ va chạm 14% · Giao chiến phòng vệ</span>
        <Button
          variant={reviewed ? 'ghost' : 'outline'}
          size="sm"
          aria-pressed={reviewed}
          onClick={onReview}
          className="self-start sm:self-auto"
        >
          {reviewed ? <CheckCircle2 size={14} /> : <Check size={14} />}
          {reviewed ? 'Đã xem xét' : 'Đánh dấu đã xem xét'}
        </Button>
      </div>
    </div>
  );
}

const signalTone = {
  green: 'text-brand-strong',
  orange: 'text-orange-strong',
  purple: 'text-purple-strong',
};

function Signal({ label, value, note, tone = 'green' }) {
  return (
    <div className="rounded-2xl border border-hairline bg-elevated p-3">
      <span className="block text-xs leading-4 text-ink/70">{label}</span>
      <strong className={`mt-1.5 block text-lg tabular-nums ${signalTone[tone]}`}>{value}</strong>
      <span className="block text-xs leading-4 text-ink/70">{note}</span>
    </div>
  );
}

/* [lines from sm, extra lines below sm] per paragraph. */
const skeletonParagraphs = [
  [6, 3],
  [7, 3],
  [5, 3],
  [6, 2],
  [4, 3],
];

/* Three-column review layout with the same cards, reader article, H1 slot and decision stack. */
function ReviewSkeleton() {
  return (
    <div aria-busy="true" className="nh-grid-12 mt-6 grid items-start gap-5 nh-layout-xl-3-6-3">
      <div
        aria-hidden="true"
        className="order-2 grid min-w-0 gap-4 sm:grid-cols-2 xl:order-none xl:grid-cols-1"
      >
        <Card as="div" className="p-4">
          <div className="flex gap-3">
            <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-14" />
              <span className="mt-2 flex h-10 flex-col justify-center gap-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-2/3" />
              </span>
              <span className="mt-1 flex h-4 items-center">
                <Skeleton className="h-3 w-24" />
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-hairline pt-3">
            <span className="flex h-4 items-center">
              <Skeleton className="h-3 w-40" />
            </span>
          </div>
        </Card>
        <Card as="div" className="p-4 sm:row-span-2 xl:row-span-1">
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-36" />
          </span>
          <div className="mt-3 space-y-1">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="px-3 py-2.5">
                <span className="flex h-5 items-center gap-2">
                  <Skeleton className="size-3.5 shrink-0" />
                  <Skeleton className="h-3 w-3/4" />
                </span>
                <Skeleton className="ml-[22px] mt-1 h-6 w-16" />
              </div>
            ))}
          </div>
        </Card>
        <Card as="div" className="p-4">
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-28" />
          </span>
          <div className="mt-3 space-y-2">
            {['w-28', 'w-32', 'w-16', 'w-40'].map((width) => (
              <div key={width} className="space-y-1.5 py-0.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className={`h-3 ${width}`} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <article className="order-1 min-w-0 rounded-3xl border border-line bg-reader p-5 shadow-whisper sm:p-8 xl:order-none">
        <span aria-hidden="true" className="flex h-4 items-center">
          <Skeleton className="h-2.5 w-44" />
        </span>
        <h1 className="mt-2 text-h2 sm:text-h1">
          <span className="sr-only">Đang tải nội dung chương…</span>
          <span aria-hidden="true" className="flex h-8 items-center sm:h-10">
            <Skeleton className="h-6 w-3/4 rounded-xl sm:h-7" />
          </span>
        </h1>
        <div aria-hidden="true">
          <span className="mt-2 flex h-4 items-center">
            <Skeleton className="h-3 w-72 max-w-full" />
          </span>
          <div className="mt-6 rounded-2xl border border-hairline bg-surface p-4">
            <span className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </span>
            <div className="mt-2">
              {['w-full', 'w-1/2'].map((width) => (
                <span key={width} className="flex h-6 items-center">
                  <Skeleton className={`h-3 ${width}`} />
                </span>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-8 max-w-[68ch] space-y-6">
            {skeletonParagraphs.map(([lines, extra], paragraph) => (
              <SkeletonLines key={paragraph} lines={lines} extra={extra} />
            ))}
            <div className="rounded-2xl border border-hairline p-4 sm:p-5">
              <span className="flex h-6 items-center">
                <Skeleton className="h-3 w-3/5" />
              </span>
              <SkeletonLines lines={5} extra={4} className="mt-4" />
              <div className="mt-4 flex h-[3.0625rem] items-end justify-between gap-3 border-t border-hairline">
                <Skeleton className="mb-3 h-3 w-1/2" />
                <Skeleton className="h-9 w-40" />
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-col justify-between gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center">
            <Skeleton className="h-3.5 w-64 max-w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </div>
      </article>

      <div aria-hidden="true" className="order-3 min-w-0 space-y-4 xl:order-none">
        <Card as="div" className="p-5">
          <div className="flex h-6 items-center justify-between gap-2 xl:h-14 xl:flex-col xl:items-start">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <span className="mt-2 flex h-4 flex-col justify-center gap-2 xl:h-8">
            <Skeleton className="h-3 w-full" />
            <span className="hidden xl:block">
              <Skeleton className="h-3 w-1/2" />
            </span>
          </span>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-[5.75rem] rounded-2xl xl:h-[7.75rem]" />
            ))}
          </div>
        </Card>
        <Card as="div" className="p-5">
          <div className="flex h-6 items-center justify-between gap-2 xl:h-20 xl:flex-col xl:items-start">
            <Skeleton className="h-4 w-44 max-w-full" />
            <Skeleton className="h-6 w-14" />
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <span
                key={index}
                className="flex h-8 items-center gap-2.5 px-2 pointer-coarse:h-11 xl:h-[3.75rem]"
              >
                <Skeleton className="size-5 shrink-0" />
                <Skeleton className="h-3 w-4/5" />
              </span>
            ))}
          </div>
        </Card>
        <Card as="div" className="p-5">
          <span className="flex h-6 items-center xl:h-[3.6875rem]">
            <Skeleton className="h-4 w-48" />
          </span>
          <Skeleton className="mt-3 h-28 w-full rounded-2xl" />
          <span className="mt-1.5 flex h-4 items-center justify-end">
            <Skeleton className="h-3 w-20" />
          </span>
        </Card>
        <Card as="div" className="p-5">
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-28" />
          </span>
          <div className="mt-3 grid gap-2">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* Reader line pitch (32px, 36px from sm); `extra` lines show only below sm where text wraps more. */
function SkeletonLines({ lines, extra = 0, className = '' }) {
  const total = lines + extra;
  return (
    <div className={className}>
      {Array.from({ length: total }, (_, line) => (
        <span
          key={line}
          className={`h-8 items-center sm:h-9 ${line < lines ? 'flex' : 'flex sm:hidden'}`}
        >
          <Skeleton className={`h-3 ${line === total - 1 ? 'w-2/3' : 'w-full'}`} />
        </span>
      ))}
    </div>
  );
}
