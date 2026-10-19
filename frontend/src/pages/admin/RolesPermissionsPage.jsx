import { Fragment, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Download,
  KeyRound,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  UserRound,
  X,
} from '../../components/icons';
import { AdminLayout } from '../../layouts';
import { useMockResource } from '../../context/MockDataContext';
import { Badge, Button, Card, EmptyState, Input, Modal, Skeleton, Tabs } from '../../components/ui';

const roles = [
  {
    name: 'Reader',
    users: '141,562',
    icon: BookOpen,
    description:
      'Standard public account. Read chapters, purchase coins, leave comments, and follow creators.',
    tags: ['Default Role', 'Unrestricted Signup'],
  },
  {
    name: 'Author',
    users: '1,240',
    icon: UserRound,
    description:
      'Creator account with Author Studio, Chapter Editor, PDF import, royalty wallet, and AI Co-Pilot.',
    tags: ['Verified Identity', 'Monetization Enabled'],
  },
  {
    name: 'Moderator',
    users: '38',
    icon: ShieldCheck,
    description:
      'Trust & Safety console access, submission inspection, similarity analysis, and report resolution.',
    tags: ['Staff Only', 'NDA Signed'],
  },
  {
    name: 'Administrator',
    users: '10',
    icon: Shield,
    description:
      'Full platform governance, user management, service configuration, taxonomy control, and audit logs.',
    tags: ['Protected Role', 'Hardware 2FA'],
  },
];
const roleLabels = {
  Reader: 'Độc giả',
  Author: 'Tác giả',
  Moderator: 'Kiểm duyệt viên',
  Administrator: 'Quản trị viên',
};
const roleDescriptions = {
  Reader: 'Tài khoản công khai tiêu chuẩn. Đọc chương, mua xu, bình luận và theo dõi tác giả.',
  Author:
    'Tài khoản sáng tác có Studio tác giả, trình soạn chương, nhập PDF, ví nhuận bút và trợ lý AI.',
  Moderator:
    'Truy cập khu vực Tin cậy và An toàn, kiểm tra bản gửi, phân tích tương đồng và xử lý báo cáo.',
  Administrator:
    'Quản trị toàn bộ nền tảng, người dùng, cấu hình dịch vụ, phân loại và nhật ký kiểm tra.',
};
const tagLabels = {
  'Default Role': 'Vai trò mặc định',
  'Unrestricted Signup': 'Đăng ký không hạn chế',
  'Verified Identity': 'Đã xác minh danh tính',
  'Monetization Enabled': 'Đã bật kiếm tiền',
  'Staff Only': 'Chỉ dành cho nhân viên',
  'NDA Signed': 'Đã ký NDA',
  'Protected Role': 'Vai trò được bảo vệ',
  'Hardware 2FA': '2FA phần cứng',
};
const capabilities = [
  [
    'Content Publishing & Authoring',
    'story.create',
    'Create manuscripts and upload metadata',
    [0, 1, 1, 1],
  ],
  [
    'Content Publishing & Authoring',
    'chapter.edit',
    'Edit long-form text and autosave to cloud',
    [0, 1, 0, 1],
  ],
  [
    'Content Publishing & Authoring',
    'pdf.import',
    'OCR and auto-structure manuscript PDFs',
    [0, 1, 0, 1],
  ],
  [
    'Content Publishing & Authoring',
    'ai_copilot.access',
    'Invoke NovelCraft writing assistance',
    [0, 1, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'queue.review',
    'Claim submissions and execute approval decisions',
    [0, 0, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'plagiarism.inspect',
    'Inspect canonical similarity comparisons',
    [0, 0, 1, 1],
  ],
  [
    'Editorial & Moderation',
    'report.resolve',
    'Triage community and content reports',
    [0, 0, 1, 1],
  ],
  ['Editorial & Moderation', 'user.strike', 'Issue warnings or shadowban accounts', [0, 0, 1, 1]],
  ['Monetization & Ledger', 'wallet.spend', 'Purchase coins and unlock chapters', [1, 1, 1, 1]],
  [
    'Monetization & Ledger',
    'royalty.withdraw',
    'Request payout for accrued royalties',
    [0, 1, 0, 1],
  ],
  [
    'Monetization & Ledger',
    'coin.override',
    'Manually credit or debit user balances',
    [0, 0, 0, 1],
  ],
  [
    'Platform Infrastructure',
    'system.configure',
    'Modify TTS endpoints, AI keys, and storage',
    [0, 0, 0, 1],
  ],
  [
    'Platform Infrastructure',
    'audit.view',
    'Inspect complete administrative event stream',
    [0, 0, 1, 1],
  ],
];
const modules = [
  'All Modules',
  'Content & Stories',
  'Reader & Social',
  'Moderation',
  'Billing & Coins',
  'Platform Config',
];
const moduleLabels = {
  'All Modules': 'Tất cả mô-đun',
  'Content & Stories': 'Nội dung và truyện',
  'Reader & Social': 'Độc giả và cộng đồng',
  Moderation: 'Kiểm duyệt',
  'Billing & Coins': 'Thanh toán và xu',
  'Platform Config': 'Cấu hình nền tảng',
};
const groupLabels = {
  'Content Publishing & Authoring': 'Xuất bản nội dung và sáng tác',
  'Editorial & Moderation': 'Biên tập và kiểm duyệt',
  'Monetization & Ledger': 'Kiếm tiền và sổ cái',
  'Platform Infrastructure': 'Hạ tầng nền tảng',
};
const capabilityDescriptions = {
  'Create manuscripts and upload metadata': 'Tạo bản thảo và tải lên siêu dữ liệu',
  'Edit long-form text and autosave to cloud': 'Sửa văn bản dài và tự động lưu lên đám mây',
  'OCR and auto-structure manuscript PDFs': 'OCR và tự động cấu trúc PDF bản thảo',
  'Invoke NovelCraft writing assistance': 'Sử dụng trợ lý viết NovelCraft',
  'Claim submissions and execute approval decisions': 'Nhận bản gửi và thực hiện quyết định duyệt',
  'Inspect canonical similarity comparisons': 'Kiểm tra so sánh tương đồng với nội dung chuẩn',
  'Triage community and content reports': 'Phân loại báo cáo cộng đồng và nội dung',
  'Issue warnings or shadowban accounts': 'Cảnh báo hoặc hạn chế ngầm tài khoản',
  'Purchase coins and unlock chapters': 'Mua xu và mở khóa chương',
  'Request payout for accrued royalties': 'Yêu cầu thanh toán nhuận bút tích lũy',
  'Manually credit or debit user balances': 'Điều chỉnh tăng hoặc giảm số dư người dùng thủ công',
  'Modify TTS endpoints, AI keys, and storage': 'Thay đổi điểm cuối TTS, khóa AI và lưu trữ',
  'Inspect complete administrative event stream': 'Kiểm tra toàn bộ luồng sự kiện quản trị',
};

const moduleGroups = {
  'Content & Stories': 'Content Publishing & Authoring',
  Moderation: 'Editorial & Moderation',
  'Billing & Coins': 'Monetization & Ledger',
  'Platform Config': 'Platform Infrastructure',
};
const baselineMatrix = () => capabilities.map((row) => [...row[3]]);
const inModule = (module, row) => {
  if (module === 'All Modules') return true;
  /* Reader & Social = every capability a standard reader account holds by default. */
  if (module === 'Reader & Social') return row[3][0] === 1;
  return row[0] === moduleGroups[module];
};
const stickyCell = 'sticky left-0 z-10';

export function RolesPermissionsPage() {
  const fieldId = useId();
  const roleList = useMockResource('admin:roles', roles);
  const permissions = useMockResource('admin:permissions', capabilities);
  const [module, setModule] = useState('All Modules');
  const [query, setQuery] = useState('');
  const [baseline, setBaseline] = useState(baselineMatrix);
  const [matrix, setMatrix] = useState(baselineMatrix);
  const [modal, setModal] = useState('');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return permissions.data
      .map((row, index) => ({ ...row, index }))
      .filter(
        (row) =>
          inModule(module, row) &&
          `${row[1]} ${row[2]} ${capabilityDescriptions[row[2]] ?? ''}`
            .toLowerCase()
            .includes(needle),
      );
  }, [permissions.data, module, query]);
  const drafts = matrix.reduce(
    (total, cells, row) =>
      total + cells.filter((enabled, col) => enabled !== baseline[row][col]).length,
    0,
  );
  const toggle = (row, col) => {
    setMatrix((value) =>
      value.map((cells, index) =>
        index === row
          ? cells.map((enabled, cell) => (cell === col ? (enabled ? 0 : 1) : enabled))
          : cells,
      ),
    );
  };
  const closeModal = () => setModal('');
  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-ink/70">
              Bảng điều khiển quản trị / Quản lý truy cập / Ma trận vai trò và RBAC
            </p>
            <h1 className="mt-1 text-h2 sm:text-h1">Quản trị vai trò và quyền hạn</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setModal('Đã xuất chính sách quyền dạng JSON')}
            >
              <Download size={16} />
              Xuất JSON chính sách
            </Button>
            <Button onClick={() => setModal('Tạo vai trò tùy chỉnh')}>
              <Plus size={16} />
              Tạo vai trò tùy chỉnh
            </Button>
          </div>
        </header>

        <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-orange/30 bg-orange/10 p-4 sm:flex-row sm:items-center sm:p-5">
          <Shield size={20} aria-hidden="true" className="shrink-0 text-orange-strong" />
          <p className="flex-1 text-sm">
            <strong className="font-semibold">Lưu ý chính sách bảo mật:</strong> Thay đổi có tác
            động lớn yêu cầu xác thực lại bằng 2FA và được ghi vào nhật ký kiểm tra bất biến.
          </p>
          <Badge tone="orange" className="self-start sm:self-auto">
            POLICY_V4.2
          </Badge>
        </div>

        <section className="mt-8" aria-labelledby="core-roles-title">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="core-roles-title" className="text-h3 md:text-h2">
              Vai trò cốt lõi của hệ thống
            </h2>
            {roleList.status === 'ready' && (
              <Badge tone="green" className="nh-fade-enter">
                {roleList.data.length} loại đang hoạt động
              </Badge>
            )}
          </div>
          {roleList.status === 'error' ? (
            <Card className="mt-4 p-0">
              <LoadError
                title="Không tải được danh sách vai trò"
                description="Dịch vụ phân quyền chưa phản hồi. Quyền hiện hành vẫn được áp dụng."
                onRetry={roleList.retry}
              />
            </Card>
          ) : roleList.status === 'empty' ? (
            <Card className="mt-4 p-0">
              <EmptyState
                icon={Shield}
                headingAs="h3"
                title="Chưa có vai trò nào"
                description="Tạo vai trò đầu tiên để bắt đầu phân quyền cho tài khoản."
                action={
                  <Button size="sm" onClick={() => setModal('Tạo vai trò tùy chỉnh')}>
                    <Plus size={14} />
                    Tạo vai trò tùy chỉnh
                  </Button>
                }
              />
            </Card>
          ) : (
            <div
              aria-busy={roleList.status === 'loading'}
              aria-label={roleList.status === 'loading' ? 'Đang tải vai trò' : undefined}
              className="nh-grid-12 mt-4 grid gap-4 nh-md-cols-2 nh-xl-cols-4"
            >
              {roleList.status === 'loading'
                ? Array.from({ length: 4 }, (_, index) => <RoleCardSkeleton key={index} />)
                : roleList.data.map((role) => (
                    <RoleCard
                      key={role.name}
                      role={role}
                      onAction={() => setModal(`Sửa chính sách ${roleLabels[role.name]}`)}
                    />
                  ))}
            </div>
          )}
        </section>

        <Card as="section" aria-labelledby="matrix-title" className="mt-8 overflow-hidden p-0">
          <div className="border-b border-hairline p-5">
            <div className="flex flex-col justify-between gap-1 lg:flex-row lg:items-baseline">
              <h2 id="matrix-title" className="text-h3">
                Ma trận quyền theo vai trò
              </h2>
              <p className="text-caption text-muted">
                Bấm vào ô để cấp hoặc thu hồi quyền. Thay đổi được giữ trong bản nháp.
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <Tabs
                  label="Lọc theo mô-đun"
                  singleRow
                  value={module}
                  onChange={setModule}
                  items={modules.map((value) => ({ value, label: moduleLabels[value] }))}
                />
              </div>
              <Input
                icon={Search}
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Tìm quyền"
                placeholder="Tìm mã định danh quyền…"
                className="w-full shrink-0 xl:w-72"
              />
            </div>
          </div>
          {permissions.status === 'error' ? (
            <LoadError
              title="Không tải được ma trận quyền"
              description="Danh mục phạm vi quyền chưa phản hồi. Chưa có thay đổi nào bị mất."
              onRetry={permissions.retry}
            />
          ) : permissions.status === 'empty' ? (
            <EmptyState
              icon={KeyRound}
              headingAs="h3"
              title="Chưa có phạm vi quyền nào"
              description="Ma trận sẽ hiển thị khi dịch vụ đăng ký phạm vi quyền đầu tiên. Xuất chính sách hiện hành để đối chiếu."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModal('Đã xuất chính sách quyền dạng JSON')}
                >
                  <Download size={14} />
                  Xuất JSON chính sách
                </Button>
              }
            />
          ) : permissions.status === 'loading' || visible.length ? (
            <div className="overflow-x-auto">
              <table
                aria-busy={permissions.status === 'loading'}
                className="w-full text-left text-sm md:min-w-[880px]"
              >
                <caption className="sr-only">
                  {permissions.status === 'loading'
                    ? 'Đang tải ma trận quyền theo vai trò'
                    : 'Ma trận quyền theo vai trò'}
                </caption>
                <thead className="border-b border-hairline bg-elevated text-[11px] uppercase tracking-[.12em] text-ink/70">
                  <tr>
                    <th scope="col" className={`${stickyCell} bg-elevated px-5 py-3 font-semibold`}>
                      Khả năng / mã quyền
                    </th>
                    <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                      Mô tả
                    </th>
                    {roles.map((role) => (
                      <th
                        key={role.name}
                        scope="col"
                        className="w-28 px-2 py-3 text-center font-semibold last:pr-5"
                      >
                        {roleLabels[role.name]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={permissions.status === 'loading' ? undefined : 'nh-fade-enter'}>
                  {permissions.status === 'loading' && <MatrixSkeletonRows />}
                  {permissions.status === 'ready' &&
                    visible.map((row, position) => {
                      const group = row[0];
                      const slug = row[1];
                      const description = capabilityDescriptions[row[2]] ?? row[2];
                      const showGroup = group !== visible[position - 1]?.[0];
                      return (
                        <FragmentRow key={slug} showGroup={showGroup} group={group}>
                          <th
                            scope="row"
                            className={`${stickyCell} min-w-44 bg-surface px-5 py-3 font-mono text-[13px] font-medium text-brand-strong transition-colors group-hover:bg-elevated md:min-w-0`}
                          >
                            {slug}
                            {/* Below md the description column is folded in here so the role toggles stay on screen. */}
                            <span className="mt-0.5 block font-sans text-xs font-normal text-muted md:hidden">
                              {description}
                            </span>
                          </th>
                          <td className="hidden min-w-64 px-4 py-3 text-muted md:table-cell">
                            {description}
                          </td>
                          {matrix[row.index].map((enabled, col) => {
                            const changed = enabled !== baseline[row.index][col];
                            return (
                              <td key={col} className="px-2 py-3 text-center last:pr-5">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={Boolean(enabled)}
                                  aria-label={`${slug} cho ${roleLabels[roles[col].name]}`}
                                  title={changed ? 'Đã thay đổi trong bản nháp' : undefined}
                                  onClick={() => toggle(row.index, col)}
                                  className={`mx-auto grid size-9 place-items-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200 ease-spring active:scale-[0.94] pointer-coarse:size-11 ${
                                    enabled
                                      ? 'bg-brand text-on-brand shadow-[0_6px_14px_-10px_var(--primary)]'
                                      : 'border border-line bg-surface text-ink/45 hover:border-brand/50 hover:text-ink/70'
                                  } ${changed ? 'ring-2 ring-orange ring-offset-2 ring-offset-surface' : ''}`}
                                >
                                  {enabled ? (
                                    <Check size={16} aria-hidden="true" />
                                  ) : (
                                    <X size={14} aria-hidden="true" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </FragmentRow>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="Không tìm thấy quyền phù hợp"
              description="Thử mã định danh khác hoặc chọn mô-đun Tất cả."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setModule('All Modules');
                  }}
                >
                  Xóa bộ lọc
                </Button>
              }
            />
          )}
          <div className="flex flex-col justify-between gap-3 border-t border-hairline px-5 py-4 text-caption text-muted sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-brand text-on-brand">
                  <Check size={11} aria-hidden="true" />
                </span>
                Phạm vi đã bật
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full border border-line text-ink/45">
                  <X size={10} aria-hidden="true" />
                </span>
                Từ chối rõ ràng
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-5 rounded-full ring-2 ring-orange ring-inset" />
                Thay đổi trong bản nháp
              </span>
            </div>
            <span>
              {permissions.status === 'loading'
                ? 'Đang tải phạm vi quyền…'
                : `Đang hiển thị ${visible.length} phạm vi quyền trên 4 vai trò`}
            </span>
          </div>
        </Card>

        {drafts > 0 && (
          <Card className="nh-dialog-enter mt-6 flex flex-col gap-4 border-orange/40 lg:flex-row lg:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
              <KeyRound size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1" role="status">
              <h2 className="text-base font-semibold">
                {drafts} thay đổi chính sách đang chờ trong bản nháp
              </h2>
              <p className="mt-1 text-caption text-muted">
                Khi lưu, thay đổi áp dụng cho mọi phiên đang hoạt động. Quyền bị thu hồi sẽ vô hiệu
                hóa token làm mới trên toàn hệ thống.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setMatrix(baseline.map((cells) => [...cells]))}
              >
                Hủy bản nháp
              </Button>
              <Button onClick={() => setModal('Áp dụng ma trận quyền')}>
                <ShieldCheck size={16} />
                Áp dụng ma trận · 2FA
              </Button>
            </div>
          </Card>
        )}

        <Modal open={Boolean(modal)} title={modal} onClose={closeModal}>
          {modal === 'Tạo vai trò tùy chỉnh' ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                closeModal();
              }}
            >
              <div>
                <label htmlFor={`${fieldId}-name`} className="text-sm font-semibold">
                  Tên vai trò
                </label>
                <Input id={`${fieldId}-name`} required className="mt-2" />
              </div>
              <div>
                <label htmlFor={`${fieldId}-description`} className="text-sm font-semibold">
                  Mô tả vai trò
                </label>
                <Input id={`${fieldId}-description`} className="mt-2" />
              </div>
              <Button type="submit" className="w-full">
                Tạo vai trò mẫu
              </Button>
            </form>
          ) : (
            <>
              <p className="text-sm text-muted">
                {modal === 'Áp dụng ma trận quyền'
                  ? `${drafts} thay đổi sẽ được áp dụng sau khi xác thực 2FA. `
                  : ''}
                Thao tác được bảo vệ này chỉ được mô phỏng cục bộ trong bản xem trước giao diện.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={closeModal}>
                  Hủy
                </Button>
                <Button
                  onClick={() => {
                    if (modal === 'Áp dụng ma trận quyền')
                      setBaseline(matrix.map((cells) => [...cells]));
                    closeModal();
                  }}
                >
                  Xác nhận thao tác mẫu
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}

function RoleCard({ role, onAction }) {
  const Icon = role.icon;
  const protectedRole = role.name === 'Administrator';
  return (
    <Card as="article" className={`flex flex-col ${protectedRole ? 'border-brand' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand-strong">
          <Icon size={20} aria-hidden="true" />
        </span>
        <p className="text-right text-base font-bold">
          {role.users}
          <small className="block text-xs font-normal text-muted">người dùng được gán</small>
        </p>
      </div>
      <h3 className="mt-5 text-h3">{roleLabels[role.name]}</h3>
      <p className="mt-2 text-sm text-muted">{roleDescriptions[role.name]}</p>
      <div className="mb-5 mt-4 flex flex-wrap gap-2">
        {role.tags.map((tag, index) => (
          <Badge key={tag} tone={index ? 'blue' : protectedRole ? 'red' : 'green'}>
            {tagLabels[tag] ?? tag}
          </Badge>
        ))}
      </div>
      <Button
        variant={protectedRole ? 'primary' : 'secondary'}
        onClick={onAction}
        className="mt-auto w-full"
      >
        {protectedRole ? 'Quản lý khóa' : role.name === 'Reader' ? 'Xem phạm vi' : 'Sửa chính sách'}
      </Button>
    </Card>
  );
}
function FragmentRow({ showGroup, group, children }) {
  return (
    <>
      {showGroup && (
        <tr className="border-y border-hairline bg-brand-soft">
          <th
            scope="colgroup"
            colSpan={6}
            className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-[.1em] text-brand-strong"
          >
            <span className="sticky left-5">{groupLabels[group] ?? group}</span>
          </th>
        </tr>
      )}
      <tr className="group border-b border-hairline transition-colors last:border-0 hover:bg-elevated">
        {children}
      </tr>
    </>
  );
}

/* Same card rhythm as RoleCard: icon + count row, title, three description lines, tags, button. */
function RoleCardSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="size-11 shrink-0 rounded-2xl" />
        <span className="flex flex-col items-end gap-2 py-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-24" />
        </span>
      </div>
      <span className="mt-5 flex h-7 items-center">
        <Skeleton className="h-5 w-28" />
      </span>
      <div className="mt-2">
        {['w-full', 'w-full', 'w-full', 'w-2/3'].map((width, line) => (
          <span key={line} className="flex h-5 items-center">
            <Skeleton className={`h-3 ${width}`} />
          </span>
        ))}
      </div>
      <div className="mb-5 mt-4 flex flex-wrap gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-28" />
      </div>
      <Skeleton className="mt-auto h-11 w-full" />
    </Card>
  );
}

/* Module bands with their capability rows (4/4/3/2) in the real matrix columns. */
function MatrixSkeletonRows() {
  return [4, 4, 3, 2].map((rows, band) => (
    <Fragment key={band}>
      <tr aria-hidden="true" className="border-y border-hairline bg-brand-soft">
        <td colSpan={6} className="px-5 py-2.5">
          <span className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-52" />
          </span>
        </td>
      </tr>
      {Array.from({ length: rows }, (_, index) => (
        <tr key={index} aria-hidden="true" className="border-b border-hairline last:border-0">
          <td className={`${stickyCell} min-w-44 bg-surface px-5 py-3 md:min-w-0`}>
            <Skeleton className="h-3.5 w-28" />
            <span className="mt-0.5 flex h-8 flex-col justify-center gap-2 md:hidden">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </span>
          </td>
          <td className="hidden min-w-64 px-4 py-3 md:table-cell">
            <Skeleton className="h-3 w-60 max-w-full" />
          </td>
          {[0, 1, 2, 3].map((col) => (
            <td key={col} className="px-2 py-3 last:pr-5">
              <Skeleton className="mx-auto size-9 pointer-coarse:size-11" />
            </td>
          ))}
        </tr>
      ))}
    </Fragment>
  ));
}

function LoadError({ title, description, onRetry }) {
  return (
    <EmptyState
      tone="rose"
      icon={AlertTriangle}
      headingAs="h3"
      title={title}
      description={description}
      action={
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw size={14} />
          Thử lại
        </Button>
      }
    />
  );
}
