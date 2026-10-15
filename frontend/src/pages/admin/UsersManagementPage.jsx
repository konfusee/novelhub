import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from '../../components/icons';
import { AdminLayout } from '../../layouts';
import { ROUTES } from '../../app/routes';
import { adminUsers } from '../../data/mock/admin';
import { useMockResource } from '../../context/MockDataContext';
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  SkeletonText,
  Tabs,
} from '../../components/ui';

const roleTone = { Reader: 'blue', Author: 'green', Moderator: 'orange', Admin: 'purple' };
const statusTone = { Active: 'green', Flagged: 'orange', Suspended: 'red' };
const roleLabels = {
  Reader: 'Độc giả',
  Author: 'Tác giả',
  Moderator: 'Kiểm duyệt viên',
  Admin: 'Quản trị viên',
  Administrator: 'Quản trị viên',
};
const statusLabels = { Active: 'Đang hoạt động', Flagged: 'Bị cảnh báo', Suspended: 'Đã đình chỉ' };
const healthLabels = {
  Active: 'Tài khoản tốt',
  Flagged: 'Cần theo dõi',
  Suspended: 'Đang bị hạn chế',
};
const toNumber = (value) => Number(String(value).replace(/\D/g, '')) || 0;
const sorters = {
  activity: () => 0,
  joined: (a, b) => Date.parse(b.joined) - Date.parse(a.joined),
  coins: (a, b) => toNumber(b.coins) - toNumber(a.coins),
};
const cell = 'px-4 py-4 first:pl-5 last:pr-5';

export function UsersManagementPage() {
  const resource = useMockResource('admin:users', adminUsers);
  const loading = resource.status === 'loading';
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('activity');
  const [selectedId, setSelectedId] = useState(null);
  const [statusById, setStatusById] = useState({});
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState('');
  const inspectorTitleRef = useRef(null);
  const accounts = useMemo(
    () => resource.data.map((user) => ({ ...user, status: statusById[user.id] ?? user.status })),
    [resource.data, statusById],
  );
  const rows = useMemo(
    () =>
      accounts
        .filter(
          (user) =>
            (role === 'All' || user.role === role) &&
            (status === 'All' || user.status === status) &&
            `${user.name} ${user.handle} ${user.email} ${user.id}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort(sorters[sort]),
    [accounts, query, role, status, sort],
  );
  const selected = accounts.find((user) => user.id === selectedId) ?? null;
  const filtersActive = query !== '' || role !== 'All' || status !== 'All';
  const suspended = selected?.status === 'Suspended';

  const inspect = (user) => {
    setSelectedId(user.id);
    requestAnimationFrame(() => inspectorTitleRef.current?.focus());
  };
  const closeInspector = () => {
    const id = selectedId;
    setSelectedId(null);
    requestAnimationFrame(() => document.querySelector(`[data-inspect="${id}"]`)?.focus());
  };
  const resetFilters = () => {
    setQuery('');
    setRole('All');
    setStatus('All');
  };
  const confirmStatusChange = () => {
    setStatusById((value) => ({ ...value, [selected.id]: suspended ? 'Active' : 'Suspended' }));
    setConfirming(false);
    setNotice(
      suspended
        ? `${selected.name} đã được kích hoạt lại (bản mẫu).`
        : `${selected.name} đã bị đình chỉ (bản mẫu).`,
    );
  };

  return (
    <AdminLayout>
      <div className="page-admin py-6">
        <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0">
            <p className="text-caption text-ink/70">Bảng điều khiển quản trị / Quản lý truy cập</p>
            <h1 className="mt-1 text-h2 sm:text-h1">Người dùng và tài khoản</h1>
            <p className="mt-2 text-caption text-ink/70">
              <strong className="font-semibold text-brand-strong">142.850</strong> tài khoản · 1.240
              tác giả · 48 nhân viên/kiểm duyệt viên
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setNotice('Đã chuẩn bị CSV danh bạ người dùng (bản mẫu).')}
            >
              <Download size={16} />
              Xuất danh bạ
            </Button>
            <Button onClick={() => setNotice('Đã mở lời mời nhân viên (bản mẫu).')}>
              <UserPlus size={16} />
              Mời nhân viên
            </Button>
          </div>
        </header>

        <Card className="mt-6 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Input
              icon={Search}
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Tìm người dùng"
              placeholder="Tên, email hoặc mã…"
              className="sm:col-span-2 xl:col-span-1"
            />
            <Select
              aria-label="Lọc theo trạng thái"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Active">Đang hoạt động</option>
              <option value="Flagged">Bị cảnh báo</option>
              <option value="Suspended">Đã đình chỉ</option>
            </Select>
            <Select
              aria-label="Sắp xếp danh sách"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="activity">Hoạt động nhiều nhất</option>
              <option value="joined">Tham gia mới nhất</option>
              <option value="coins">Nhiều xu nhất</option>
            </Select>
          </div>
          <div className="mt-4 min-w-0">
            <Tabs
              label="Lọc theo vai trò"
              singleRow
              value={role}
              onChange={setRole}
              items={[
                { value: 'All', label: 'Tất cả 142.850' },
                { value: 'Reader', label: 'Độc giả 141.562' },
                { value: 'Author', label: 'Tác giả 1.240' },
                { value: 'Moderator', label: 'Kiểm duyệt viên 38' },
              ]}
            />
          </div>
        </Card>

        <div
          className={`nh-grid-12 mt-5 grid items-start gap-5 ${selected ? 'nh-layout-2xl-8-4' : ''}`}
        >
          <Card className="overflow-hidden p-0">
            {resource.status === 'error' ? (
              <EmptyState
                tone="rose"
                icon={AlertTriangle}
                title="Không tải được danh sách người dùng"
                description="Dịch vụ tài khoản chưa phản hồi. Hãy thử lại sau ít phút."
                action={
                  <Button variant="secondary" size="sm" onClick={resource.retry}>
                    <RefreshCw size={15} />
                    Thử lại
                  </Button>
                }
              />
            ) : resource.status === 'empty' ? (
              <EmptyState
                icon={UsersRound}
                title="Chưa có tài khoản nào"
                description="Hệ thống chưa ghi nhận tài khoản người dùng. Mời nhân viên đầu tiên để bắt đầu."
                action={
                  <Button size="sm" onClick={() => setNotice('Đã mở lời mời nhân viên (bản mẫu).')}>
                    <UserPlus size={15} />
                    Mời nhân viên
                  </Button>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table
                    aria-busy={loading}
                    className="w-full whitespace-nowrap text-left text-sm md:min-w-[820px]"
                  >
                    <caption className="sr-only">
                      {loading ? 'Đang tải danh sách tài khoản' : 'Danh sách tài khoản người dùng'}
                    </caption>
                    <thead className="border-b border-hairline bg-elevated text-[11px] uppercase tracking-[.12em] text-ink/70">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-semibold first:pl-5 last:pr-5">
                          Người dùng và định danh
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Vai trò hệ thống
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Trạng thái
                        </th>
                        <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                          Ngày tham gia
                        </th>
                        <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">
                          Hoạt động và xu
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold last:pr-5">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y divide-hairline ${loading ? '' : 'nh-fade-enter'}`}>
                      {loading
                        ? Array.from({ length: 5 }, (_, index) => <SkeletonRow key={index} />)
                        : rows.map((user) => {
                            const active = selectedId === user.id;
                            return (
                              <tr
                                key={user.id}
                                onClick={() => inspect(user)}
                                className={`cursor-pointer transition-colors ${active ? 'bg-brand/10' : 'hover:bg-elevated/70'}`}
                              >
                                <td className={cell}>
                                  <div className="flex items-center gap-3">
                                    <Avatar name={user.name} />
                                    <div className="min-w-0">
                                      <strong className="block font-semibold">{user.name}</strong>
                                      <span className="text-xs text-muted">
                                        {user.handle} · #{user.id}
                                      </span>
                                    </div>
                                    {/* Row tap opens the inspector; the chevron hints it below md. */}
                                    <ChevronRight
                                      size={16}
                                      aria-hidden="true"
                                      className="ml-auto shrink-0 text-muted md:hidden"
                                    />
                                  </div>
                                </td>
                                <td className={cell}>
                                  <Badge tone={roleTone[user.role]}>
                                    {roleLabels[user.role] ?? user.role}
                                    {user.guild ? ` · ${user.guild}` : ''}
                                  </Badge>
                                </td>
                                <td className={cell}>
                                  <Badge tone={statusTone[user.status]}>
                                    {statusLabels[user.status] ?? user.status}
                                  </Badge>
                                </td>
                                <td className={`${cell} hidden md:table-cell`}>
                                  <span className="block">{user.joined}</span>
                                  <small className="text-xs text-muted">{user.tenure}</small>
                                </td>
                                <td className={`${cell} hidden md:table-cell`}>
                                  <span className="block">{user.activity}</span>
                                  <strong className="text-xs font-semibold text-orange-strong">
                                    {user.coins}
                                  </strong>
                                </td>
                                <td className={`${cell} text-right`}>
                                  <Button
                                    data-inspect={user.id}
                                    size="sm"
                                    variant={active ? 'outline' : 'secondary'}
                                    aria-pressed={active}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      inspect(user);
                                    }}
                                  >
                                    Kiểm tra
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
                {!loading && rows.length === 0 && (
                  <EmptyState
                    icon={UsersRound}
                    title="Không có người dùng nào khớp bộ lọc"
                    description="Thử từ khóa khác hoặc bỏ bộ lọc vai trò và trạng thái."
                    action={
                      filtersActive && (
                        <Button variant="secondary" size="sm" onClick={resetFilters}>
                          Xóa bộ lọc
                        </Button>
                      )
                    }
                  />
                )}
                <div className="flex flex-col justify-between gap-3 border-t border-hairline px-5 py-4 text-caption text-muted sm:flex-row sm:items-center">
                  <span>
                    {loading
                      ? 'Đang tải danh sách tài khoản…'
                      : `Đang hiển thị ${rows.length} / 142.850 tài khoản`}
                  </span>
                  <nav aria-label="Phân trang danh sách người dùng" className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled>
                      Trước
                    </Button>
                    <Button size="sm" aria-current="page" className="min-w-9 px-3">
                      1
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="min-w-9 px-3"
                      onClick={() => setNotice('Đã chọn trang 2 (bản mẫu).')}
                    >
                      2
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setNotice('Đã chọn trang tiếp theo (bản mẫu).')}
                    >
                      Sau
                    </Button>
                  </nav>
                </div>
              </>
            )}
          </Card>
          {selected && (
            <UserInspector
              user={selected}
              titleRef={inspectorTitleRef}
              onClose={closeInspector}
              onEdit={() => setEditing(true)}
              onSuspend={() => setConfirming(true)}
              onNotice={setNotice}
            />
          )}
        </div>

        {selected && (
          <Modal
            open={editing}
            title={`Sửa vai trò · ${selected.name}`}
            onClose={() => setEditing(false)}
          >
            <p className="text-sm text-muted">
              Thay đổi vai trò chỉ được mô phỏng cục bộ trong bản xem trước giao diện.
            </p>
            <fieldset className="mt-4 grid gap-2">
              <legend className="sr-only">Vai trò của {selected.name}</legend>
              {['Reader', 'Author', 'Moderator', 'Administrator'].map((item) => (
                <label
                  key={item}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 text-sm transition-colors hover:border-brand/40"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-brand"
                    defaultChecked={item === selected.role || item === 'Reader'}
                  />
                  {roleLabels[item] ?? item}
                </label>
              ))}
            </fieldset>
            {/* Actions stay reachable when the dialog scrolls (short landscape screens).
                Sticky offsets resolve inside the panel's 24px padding, hence -bottom-6. */}
            <div className="sticky -bottom-6 -mx-6 -mb-6 mt-6 flex flex-wrap justify-end gap-2 border-t border-hairline bg-elevated px-6 py-4">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Hủy
              </Button>
              <Button
                onClick={() => {
                  setEditing(false);
                  setNotice(`Đã lưu thay đổi vai trò của ${selected.name} (bản mẫu).`);
                }}
              >
                Lưu vai trò
              </Button>
            </div>
          </Modal>
        )}
        {selected && (
          <Modal
            open={confirming}
            title={suspended ? 'Kích hoạt lại tài khoản' : 'Đình chỉ tài khoản'}
            onClose={() => setConfirming(false)}
          >
            <div className="flex gap-3 rounded-2xl bg-rose/10 p-4">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-strong" />
              <p className="text-sm">
                {suspended ? 'Bạn sắp kích hoạt lại ' : 'Bạn sắp đình chỉ '}
                <strong className="font-semibold">
                  {selected.name} ({selected.handle} · #{selected.id})
                </strong>
                .{' '}
                {suspended
                  ? 'Tài khoản sẽ đăng nhập, đọc và xuất bản lại bình thường.'
                  : 'Tài khoản sẽ không thể đăng nhập, đọc hoặc xuất bản cho đến khi được kích hoạt lại.'}{' '}
                Thao tác chỉ được mô phỏng cục bộ.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirming(false)}>
                Hủy
              </Button>
              <Button variant={suspended ? 'primary' : 'danger'} onClick={confirmStatusChange}>
                {suspended ? `Kích hoạt lại ${selected.name}` : `Đình chỉ ${selected.name}`}
              </Button>
            </div>
          </Modal>
        )}
        <Modal open={Boolean(notice)} title="Thao tác quản trị" onClose={() => setNotice('')}>
          <p className="text-sm">{notice}</p>
          <Button onClick={() => setNotice('')} className="mt-6 w-full">
            Hoàn tất
          </Button>
        </Modal>
      </div>
    </AdminLayout>
  );
}

/* Mirrors a user row: 40px avatar + two text lines, badges, two-line dates, a small button. */
function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className={cell}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </td>
      <td className={cell}>
        <Skeleton className="h-6 w-24" />
      </td>
      <td className={cell}>
        <Skeleton className="h-6 w-28" />
      </td>
      {['w-20', 'w-24'].map((width) => (
        <td key={width} className={`${cell} hidden md:table-cell`}>
          <Skeleton className={`h-3.5 ${width}`} />
          <Skeleton className="mt-2 h-3 w-14" />
        </td>
      ))}
      <td className={`${cell} text-right`}>
        <Skeleton className="ml-auto h-9 w-[5.5rem]" />
      </td>
    </tr>
  );
}

function UserInspector({ user, titleRef, onClose, onEdit, onSuspend, onNotice }) {
  const isAuthor = user.role === 'Author';
  const detail = useMockResource(`user:${user.id}`, user);
  const loading = detail.status === 'loading';
  return (
    <aside
      aria-labelledby="user-inspector-title"
      aria-busy={loading}
      className="grid content-start gap-4 md:grid-cols-2 2xl:sticky 2xl:top-24 2xl:grid-cols-1"
    >
      <Card className="nh-dialog-enter md:col-span-2 2xl:col-span-1">
        <div className="flex items-start gap-3">
          <Avatar name={user.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="user-inspector-title"
                ref={titleRef}
                tabIndex={-1}
                className="text-h3 outline-none"
              >
                {user.name}
              </h2>
              {user.guild && <Badge tone="green">{user.guild}</Badge>}
            </div>
            <p className="break-all text-xs text-muted">
              {user.handle} · #{user.id}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={statusTone[user.status]}>
                {statusLabels[user.status] ?? user.status}
              </Badge>
              <span className="text-xs text-muted">{healthLabels[user.status]}</span>
            </p>
          </div>
          <IconButton
            label={`Đóng thông tin ${user.name}`}
            shape="circle"
            size="sm"
            onClick={onClose}
          >
            <X size={16} />
          </IconButton>
        </div>
        <div className="nh-grid-12 mt-5 grid gap-2 nh-sm-cols-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Edit3 size={15} />
            Sửa vai trò
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNotice(`Đã mở hộp thoại điều chỉnh xu cho ${user.name} (bản mẫu).`)}
          >
            <BadgeDollarSign size={15} />
            Điều chỉnh xu
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNotice(`Đã mở trình soạn cảnh báo gửi ${user.name} (bản mẫu).`)}
          >
            <AlertTriangle size={15} />
            Gửi cảnh báo
          </Button>
          <Button
            variant={user.status === 'Suspended' ? 'outline' : 'danger'}
            size="sm"
            onClick={onSuspend}
          >
            {user.status === 'Suspended' ? 'Kích hoạt lại' : 'Đình chỉ tài khoản'}
          </Button>
        </div>
      </Card>
      {loading ? (
        <InspectorSkeleton isAuthor={isAuthor} />
      ) : detail.status === 'error' ? (
        <Card className="p-0 md:col-span-2 2xl:col-span-1">
          <EmptyState
            tone="rose"
            icon={AlertTriangle}
            headingAs="h3"
            title="Không tải được chi tiết tài khoản"
            description="Hồ sơ, tài chính và nhật ký của tài khoản này chưa phản hồi."
            action={
              <Button variant="secondary" size="sm" onClick={detail.retry}>
                <RefreshCw size={15} />
                Thử lại
              </Button>
            }
          />
        </Card>
      ) : (
        <UserDetails user={user} isAuthor={isAuthor} />
      )}
    </aside>
  );
}

function UserDetails({ user, isAuthor }) {
  return (
    <>
      <InfoCard title="Thông tin tài khoản" icon={ShieldCheck}>
        <Row label="Địa chỉ email" value={user.email} />
        <Row label="Vai trò hiện tại" value={roleLabels[user.role] ?? user.role} />
        <Row label="Thời gian tham gia" value={`${user.joined} (${user.tenure})`} />
      </InfoCard>
      <InfoCard title="Hồ sơ sáng tác và chỉ số" icon={BookOpen}>
        <div className="nh-grid-12 grid nh-cols-3 gap-2 text-center">
          <Metric value={isAuthor ? '6' : '0'} label="Truyện dài kỳ" />
          <Metric value={isAuthor ? '1,25 triệu' : '0'} label="Lượt đọc" />
          <Metric value="99,4%" label="Toàn vẹn" />
        </div>
        {isAuthor ? (
          <>
            <p className="mt-5 text-xs font-semibold text-muted">Tác phẩm nổi bật đã xuất bản</p>
            <ul className="mt-2 divide-y divide-hairline text-sm">
              {[
                ['The Silent Forest', '820K'],
                ['Echoes of Eldoria', '312K'],
              ].map(([title, reads]) => (
                <li key={title} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{title}</span>
                  <span className="shrink-0 text-xs text-muted">{reads} lượt đọc</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-caption text-muted">Tài khoản này chưa xuất bản tác phẩm.</p>
        )}
      </InfoCard>
      <InfoCard title="Tài chính và nhuận bút" icon={BadgeDollarSign}>
        <Row label="Số dư sổ cái" value={user.coins} />
        <Row
          label="Phương thức nhận tiền"
          value={isAuthor ? 'Stripe Connect · Đã xác minh' : 'Chưa cấu hình'}
        />
        <Row label="Kỳ tiếp theo" value="01/11/2026" />
        {isAuthor && (
          <ButtonLink
            to={ROUTES.adminUser(user.id)}
            variant="outline"
            size="sm"
            trailingIcon={ArrowRight}
            className="mt-4 w-full"
          >
            Thỏa thuận doanh thu
          </ButtonLink>
        )}
      </InfoCard>
      <InfoCard title="Nhật ký kiểm tra · 60 ngày gần nhất" icon={CheckCircle2}>
        <ol className="space-y-4 border-l border-line pl-4 text-sm">
          <li>
            <strong className="font-semibold">Cập nhật thông tin bảo mật</strong>
            <p className="text-caption text-muted">Đặt lại mật khẩu đã được xác thực qua 2FA</p>
          </li>
          <li>
            <strong className="font-semibold">Đã xác minh vai trò tài khoản</strong>
            <p className="text-caption text-muted">
              Được quản trị viên cấp cao Marcus Vance xem xét
            </p>
          </li>
        </ol>
      </InfoCard>
    </>
  );
}

/* Same cards and titles as UserDetails; bodies mirror row, tile and list heights. */
function InspectorSkeleton({ isAuthor }) {
  return (
    <>
      <InfoCard title="Thông tin tài khoản" icon={ShieldCheck} loading>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </InfoCard>
      <InfoCard title="Hồ sơ sáng tác và chỉ số" icon={BookOpen} loading>
        <div className="nh-grid-12 grid nh-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-[4.25rem] rounded-2xl" />
          ))}
        </div>
        {isAuthor ? (
          <>
            <Skeleton className="mt-[1.375rem] h-3 w-40" />
            <div className="mt-2.5 divide-y divide-hairline">
              {[0, 1].map((item) => (
                <span key={item} className="flex h-9 items-center justify-between gap-3">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </span>
              ))}
            </div>
          </>
        ) : (
          <SkeletonText lines={1} className="mb-1 mt-5 w-56" />
        )}
      </InfoCard>
      <InfoCard title="Tài chính và nhuận bút" icon={BadgeDollarSign} loading>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
        {isAuthor && <Skeleton className="mt-4 h-9 w-full" />}
      </InfoCard>
      <InfoCard title="Nhật ký kiểm tra · 60 ngày gần nhất" icon={CheckCircle2} loading>
        <div className="space-y-4 border-l border-line pl-4">
          {[0, 1].map((item) => (
            <div key={item} className="space-y-2.5 py-0.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          ))}
        </div>
      </InfoCard>
    </>
  );
}
function RowSkeleton() {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-hairline py-3 last:border-0 sm:flex-row sm:gap-4">
      <span className="flex h-5 items-center">
        <Skeleton className="h-3 w-24" />
      </span>
      <span className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-36" />
      </span>
    </div>
  );
}
function InfoCard({ title, icon: Icon, loading = false, children }) {
  return (
    <Card className={`p-5 ${loading ? '' : 'nh-fade-enter'}`}>
      <h3 className="flex items-center justify-between gap-3 text-base font-semibold">
        {title}
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand-strong">
          <Icon size={16} aria-hidden="true" />
        </span>
      </h3>
      <div className="mt-3">{children}</div>
    </Card>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex flex-col justify-between gap-1 border-b border-hairline py-3 text-sm last:border-0 sm:flex-row sm:gap-4">
      <span className="shrink-0 text-muted">{label}</span>
      <strong className="break-all font-semibold sm:text-right">{value}</strong>
    </div>
  );
}
function Metric({ value, label }) {
  return (
    <div className="rounded-2xl bg-elevated px-2 py-3">
      <strong className="block text-lg font-bold text-brand">{value}</strong>
      <span className="text-xs text-ink/70">{label}</span>
    </div>
  );
}
