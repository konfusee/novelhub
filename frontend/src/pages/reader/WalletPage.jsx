import { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BookOpen,
  Check,
  ChevronDown,
  Coins,
  Download,
  Heart,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Modal,
  Reveal,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { useMockResource } from '../../context/MockDataContext';
import { coinPackages, transactions } from '../../data/mock/wallet';

const filters = [
  ['all', 'Tất cả giao dịch'],
  ['added', 'Xu đã nạp'],
  ['unlock', 'Chương đã mở khóa'],
  ['tip', 'Ủng hộ tác giả'],
];
const faqs = [
  'Xu đã mua có hết hạn không?',
  'Giá mở khóa chương là bao nhiêu?',
  'Tôi có thể yêu cầu hoàn xu không?',
  'Xu thưởng là gì?',
];
const typeTone = { added: 'text-brand-strong', tip: 'text-purple-strong', unlock: 'text-ink' };
const formatCoins = (value) => value.toLocaleString('vi-VN');
const STARTING_BALANCE = 1420;
const never = () => false;
const TABLE_COLUMNS = 6;

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  );
}

/* Coin package card frame: label row, coin total, bonus line, note, price footer. */
function PackageSkeleton() {
  return (
    <Card as="div" aria-hidden="true" className="flex flex-col p-5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-24" />
      </div>
      <span className="mt-4 flex h-7 items-end gap-1.5">
        <Skeleton className="h-6 w-24 rounded-xl" />
        <Skeleton className="h-3 w-5" />
      </span>
      <span className="mt-2 flex h-5 items-center">
        <Skeleton className="h-3 w-4/5" />
      </span>
      <span className="mb-5 mt-3 flex flex-col gap-2 py-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </span>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-24" />
      </div>
    </Card>
  );
}

export function WalletPage() {
  const ids = useId();
  const wallet = useMockResource('reader:wallet:balance', STARTING_BALANCE, { isEmpty: never });
  const packs = useMockResource('reader:wallet:packages', coinPackages);
  const ledger = useMockResource('reader:wallet:transactions', transactions);
  const [credited, setCredited] = useState(0);
  const [purchases, setPurchases] = useState([]);
  const balance = (wallet.status === 'empty' ? 0 : wallet.data) + credited;
  const [autoUnlock, setAutoUnlock] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [faq, setFaq] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const records = useMemo(
    () => (ledger.status === 'ready' ? [...purchases, ...ledger.data] : purchases),
    [ledger.status, ledger.data, purchases],
  );
  const shown = useMemo(
    () => (filter === 'all' ? records : records.filter((item) => item.type === filter)),
    [filter, records],
  );
  const purchase = () => {
    if (!selected) return;
    setCredited((current) => current + selected.total);
    setPurchases((current) => [
      {
        date: 'Vừa xong',
        type: 'added',
        label: 'Nạp xu',
        item: `${selected.label} (${selected.price})`,
        amount: selected.total,
        balance: balance + selected.total,
      },
      ...current,
    ]);
    setNotice(`Đã cộng ${formatCoins(selected.total)} xu vào ví của bạn.`);
    setSelected(null);
  };
  const exportCsv = () => {
    const rows = [
      ['Ngày & giờ', 'Loại', 'Chi tiết', 'Số xu', 'Số dư'],
      ...shown.map((item) => [item.date, item.label, item.item, item.amount, item.balance]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv' }));
    link.download = 'novelhub-giao-dich.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setNotice('Đã xuất CSV giao dịch.');
  };
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-strong">
          Sổ giao dịch · Tài khoản độc giả #NH-94821
        </p>
        <h1 className="mt-2 text-h2 sm:text-h1">Ví &amp; Xu</h1>
        <p className="mt-2 max-w-prose text-sm text-ink/70">
          Quản lý số dư, mở khóa chương và ủng hộ tác giả yêu thích bằng hệ thống xu minh bạch.
        </p>
        {/* Always-mounted live region; the toast floats above the fold where the purchase happened. */}
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 flex justify-center"
        >
          {notice && (
            <p className="nh-fade-enter pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border border-brand/30 bg-surface px-4 py-3 text-sm font-medium text-brand-strong shadow-float">
              <Check size={16} aria-hidden="true" className="shrink-0" />
              {notice}
            </p>
          )}
        </div>
        <div className="nh-grid-12 mt-6 grid min-w-0 items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-8">
            {wallet.status === 'error' ? (
              <Card className="p-0">
                <EmptyState
                  tone="rose"
                  icon={AlertTriangle}
                  title="Không tải được số dư ví"
                  description="Số xu của bạn vẫn an toàn. Hãy thử tải lại sau ít phút."
                  action={<RetryButton onClick={wallet.retry} />}
                />
              </Card>
            ) : (
              <Card bezel innerClassName="p-6 sm:p-7">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-caption text-muted">Số dư khả dụng</p>
                    <p
                      className="mt-2 flex items-center gap-3"
                      aria-busy={wallet.status === 'loading' || undefined}
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                        <Coins aria-hidden="true" />
                      </span>
                      {wallet.status === 'loading' ? (
                        <>
                          <span className="sr-only">Đang tải số dư</span>
                          <Skeleton className="h-10 w-36 rounded-2xl" />
                        </>
                      ) : (
                        <span className="nh-fade-enter text-[2.5rem] font-bold leading-none tracking-[-0.03em] tabular-nums">
                          {formatCoins(balance)}
                        </span>
                      )}
                      <span className="self-end pb-1 text-lg font-semibold text-orange-strong">
                        Xu
                      </span>
                    </p>
                    <p className="mt-3 text-caption text-muted">
                      Quy đổi: <strong className="text-ink">100 xu ≈ 0,99 USD</strong> · Xu không
                      hết hạn
                    </p>
                  </div>
                  <div className="sm:shrink-0 sm:text-right">
                    <Button
                      onClick={() => setSelected(coinPackages[1])}
                      disabled={wallet.status === 'loading'}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Nạp thêm xu
                    </Button>
                    <p className="mt-2 flex items-center gap-1.5 text-caption text-brand-strong sm:justify-end sm:whitespace-nowrap">
                      <LockKeyhole size={13} aria-hidden="true" className="shrink-0" />
                      Thanh toán mô phỏng bảo mật 256-bit
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-hairline pt-5">
                  <div>
                    <strong id={`${ids}-auto`} className="text-sm">
                      Tự động mở khóa chương mới khi phát hành
                    </strong>
                    <p id={`${ids}-auto-note`} className="mt-0.5 text-caption text-muted">
                      Tự động dùng xu trong ví cho các truyện đã đánh dấu.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoUnlock}
                    aria-labelledby={`${ids}-auto`}
                    aria-describedby={`${ids}-auto-note`}
                    onClick={() => setAutoUnlock(!autoUnlock)}
                    className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors after:absolute after:-inset-2 ${autoUnlock ? 'bg-brand' : 'bg-ink/15'}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`size-5 rounded-full bg-surface shadow-whisper transition-transform duration-200 ${autoUnlock ? 'translate-x-5' : ''}`}
                    />
                  </button>
                </div>
              </Card>
            )}
            <Reveal as="section" aria-labelledby={`${ids}-packs`}>
              <h2 id={`${ids}-packs`} className="text-h3 md:text-h2">
                Các gói nạp xu
              </h2>
              <p className="mt-1 text-sm text-ink/70">
                Xu được cộng ngay vào tài khoản đọc của bạn.
              </p>
              {packs.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label="Đang tải các gói nạp xu"
                  className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4"
                >
                  {coinPackages.map((pack) => (
                    <PackageSkeleton key={pack.id} />
                  ))}
                </div>
              ) : packs.status === 'error' ? (
                <Card className="mt-6 p-0">
                  <EmptyState
                    tone="rose"
                    headingAs="h3"
                    icon={AlertTriangle}
                    title="Không tải được các gói nạp xu"
                    description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                    action={<RetryButton onClick={packs.retry} />}
                  />
                </Card>
              ) : packs.status === 'empty' ? (
                <Card className="mt-6 p-0">
                  <EmptyState
                    headingAs="h3"
                    icon={Coins}
                    title="Hiện chưa mở bán gói xu"
                    description="Bạn vẫn có thể dùng số dư hiện có để mở khóa chương và ủng hộ tác giả."
                    action={
                      <ButtonLink to="/reader/library" variant="secondary" size="sm">
                        <BookOpen size={14} aria-hidden="true" />
                        Tiếp tục đọc
                      </ButtonLink>
                    }
                  />
                </Card>
              ) : (
                <div className="nh-fade-enter mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                  {packs.data.map((pack) => (
                    <Card
                      as="article"
                      key={pack.id}
                      className={`relative flex flex-col p-5 ${pack.badge ? 'border-brand ring-1 ring-brand/30' : ''}`}
                    >
                      <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-ink/80">{pack.label}</h3>
                        {pack.badge && <Badge tone="green">{pack.badge}</Badge>}
                      </div>
                      <p className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-[1.75rem] font-bold leading-none tracking-[-0.02em] tabular-nums">
                          {formatCoins(pack.coins)}
                        </span>
                        <span className="text-sm font-semibold text-muted">xu</span>
                      </p>
                      <p className="mt-2 min-h-5 text-caption font-semibold text-orange-strong">
                        {pack.bonus
                          ? `+${formatCoins(pack.bonus)} xu thưởng · Tổng ${formatCoins(pack.total)} xu`
                          : ''}
                      </p>
                      <p className="mb-5 mt-3 text-caption text-muted">{pack.note}</p>
                      <div className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-4">
                        <strong className="text-lg tabular-nums">{pack.price}</strong>
                        <Button
                          size="sm"
                          variant={pack.badge ? 'primary' : 'secondary'}
                          onClick={() => setSelected(pack)}
                        >
                          {pack.badge ? 'Mua gói' : 'Chọn gói'}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Reveal>
            <Reveal>
              <Card className="p-0">
                <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6">
                  <div>
                    <h2 className="text-h3">Lịch sử giao dịch</h2>
                    <p className="mt-0.5 text-caption text-muted">
                      Chi tiết các lần mở khóa, nạp xu và ủng hộ tác giả.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-brand-strong"
                    onClick={exportCsv}
                    disabled={ledger.status !== 'ready' || !shown.length}
                  >
                    <Download size={15} aria-hidden="true" />
                    Xuất dữ liệu
                  </Button>
                </div>
                <div className="mt-5 px-6">
                  <Tabs
                    singleRow
                    label="Lọc giao dịch"
                    value={filter}
                    onChange={setFilter}
                    items={filters.map(([value, label]) => ({ value, label }))}
                  />
                </div>
                {ledger.status === 'loading' ? (
                  <div
                    aria-busy="true"
                    aria-label="Đang tải lịch sử giao dịch"
                    className="mt-4 overflow-x-auto pb-2"
                  >
                    <table aria-hidden="true" className="w-full min-w-[760px] text-left text-sm">
                      <thead className="whitespace-nowrap border-y border-hairline bg-ink/[0.025] text-xs uppercase tracking-[0.08em] text-ink/70">
                        <tr>
                          <th className="py-3 pl-6 pr-3 font-semibold">Ngày &amp; giờ</th>
                          <th className="px-3 font-semibold">Loại</th>
                          <th className="px-3 font-semibold">Chi tiết</th>
                          <th className="px-3 text-right font-semibold">Số xu</th>
                          <th className="px-3 text-right font-semibold">Số dư</th>
                          <th className="pl-3 pr-6 font-semibold">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {transactions.map((item) => (
                          <tr key={`${item.date}-${item.item}`}>
                            {Array.from({ length: TABLE_COLUMNS }, (_, column) => (
                              <td
                                key={column}
                                className={`py-4 ${column === 0 ? 'pl-6 pr-3' : column === TABLE_COLUMNS - 1 ? 'pl-3 pr-6' : 'px-3'}`}
                              >
                                <span
                                  className={`flex h-6 items-center ${column === 3 || column === 4 ? 'justify-end' : ''}`}
                                >
                                  <Skeleton
                                    className={
                                      column === TABLE_COLUMNS - 1
                                        ? 'h-6 w-20'
                                        : column === 2
                                          ? 'h-3 w-40'
                                          : 'h-3 w-16'
                                    }
                                  />
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : ledger.status === 'error' ? (
                  <EmptyState
                    tone="rose"
                    headingAs="h3"
                    icon={AlertTriangle}
                    title="Không tải được lịch sử giao dịch"
                    description="Kết nối tới máy chủ bị gián đoạn. Hãy thử lại sau ít phút."
                    action={<RetryButton onClick={ledger.retry} />}
                  />
                ) : shown.length ? (
                  <div className="nh-fade-enter mt-4 overflow-x-auto pb-2">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="whitespace-nowrap border-y border-hairline bg-ink/[0.025] text-xs uppercase tracking-[0.08em] text-ink/70">
                        <tr>
                          <th scope="col" className="py-3 pl-6 pr-3 font-semibold">
                            Ngày &amp; giờ
                          </th>
                          <th scope="col" className="px-3 font-semibold">
                            Loại
                          </th>
                          <th scope="col" className="px-3 font-semibold">
                            Chi tiết
                          </th>
                          <th scope="col" className="px-3 text-right font-semibold">
                            Số xu
                          </th>
                          <th scope="col" className="px-3 text-right font-semibold">
                            Số dư
                          </th>
                          <th scope="col" className="pl-3 pr-6 font-semibold">
                            Trạng thái
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {shown.map((item) => (
                          <tr key={`${item.date}-${item.item}`}>
                            <td className="whitespace-nowrap py-4 pl-6 pr-3 text-caption text-muted">
                              {item.date}
                            </td>
                            <td
                              className={`whitespace-nowrap px-3 font-medium ${typeTone[item.type] || 'text-ink'}`}
                            >
                              {item.label}
                            </td>
                            <td className="px-3">{item.item}</td>
                            <td
                              className={`whitespace-nowrap px-3 text-right font-semibold tabular-nums ${item.amount > 0 ? 'text-brand-strong' : 'text-ink'}`}
                            >
                              {item.amount > 0 ? '+' : ''}
                              {formatCoins(item.amount)} xu
                            </td>
                            <td className="px-3 text-right tabular-nums text-muted">
                              {formatCoins(item.balance)}
                            </td>
                            <td className="whitespace-nowrap pl-3 pr-6">
                              <Badge tone="green">Hoàn tất</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    headingAs="h3"
                    icon={WalletCards}
                    title="Chưa có giao dịch nào"
                    description={
                      records.length
                        ? 'Không có giao dịch trong nhóm này. Hãy thử bộ lọc khác.'
                        : 'Nạp xu để mở khóa chương và ủng hộ tác giả yêu thích.'
                    }
                    action={
                      filter !== 'all' ? (
                        <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                          Xem tất cả giao dịch
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => setSelected(coinPackages[1])}>
                          <Plus size={14} aria-hidden="true" />
                          Nạp thêm xu
                        </Button>
                      )
                    }
                  />
                )}
              </Card>
            </Reveal>
          </div>
          <aside className="min-w-0 space-y-5">
            <Card>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
                  <BadgeDollarSign aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-h3">Xu của bạn được phân bổ thế nào?</h2>
                  <p className="mt-0.5 text-caption text-muted">Hỗ trợ trực tiếp nhà sáng tạo</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-muted">
                NovelHub xây dựng hệ sinh thái truyện dài minh bạch. Khi bạn dùng xu, khoản tiền sẽ
                trực tiếp hỗ trợ các tác giả.
              </p>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between gap-3 text-sm">
                  <span>Phần chia sẻ cho tác giả độc lập</span>
                  <strong className="text-brand-strong">70%</strong>
                </div>
                <div
                  role="img"
                  aria-label="Tác giả độc lập nhận 70% giá trị xu"
                  className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full"
                >
                  <span className="w-[70%] rounded-full bg-brand" />
                  <span className="w-[20%] rounded-full bg-orange" />
                  <span className="w-[10%] rounded-full bg-ink/20" />
                </div>
              </div>
              <p className="mt-4 flex gap-2 rounded-2xl bg-orange/12 p-3 text-caption text-orange-strong">
                <Heart size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                Hơn 1,4 triệu USD tiền bản quyền nhỏ đã được trả cho các tác giả độc lập.
              </p>
            </Card>
            <Card>
              <h2 className="text-h3">Câu hỏi về Xu &amp; Ví</h2>
              <div className="mt-3 divide-y divide-hairline">
                {faqs.map((question, index) => {
                  const open = faq === index;
                  return (
                    <div key={question}>
                      <h3>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`${ids}-faq-${index}`}
                          onClick={() => setFaq(open ? -1 : index)}
                          className="flex min-h-12 w-full items-center justify-between gap-3 whitespace-normal py-3 text-left text-sm font-semibold text-ink transition-colors hover:text-brand-strong"
                        >
                          {question}
                          <ChevronDown
                            size={16}
                            aria-hidden="true"
                            className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </h3>
                      {open && (
                        <p
                          id={`${ids}-faq-${index}`}
                          className="nh-fade-enter pb-4 text-caption text-muted"
                        >
                          Xu không hết hạn và luôn gắn với hồ sơ độc giả. Bộ phận hỗ trợ có thể xem
                          xét các giao dịch đủ điều kiện.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="flex gap-3 border-purple/20 bg-purple/8">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-orange/16 text-orange-strong">
                <Sparkles size={18} aria-hidden="true" />
              </span>
              <div>
                <strong className="text-sm">Thưởng đọc hằng ngày</strong>
                <p className="mt-1 text-caption text-ink/70">
                  Đọc 20 phút hôm nay để nhận 5 xu miễn phí cho chương tiếp theo.
                </p>
              </div>
            </Card>
          </aside>
        </div>
        <Modal
          open={Boolean(selected)}
          title="Xác nhận giao dịch mô phỏng"
          onClose={() => setSelected(null)}
        >
          {selected && (
            <div>
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface p-4">
                <div>
                  <strong>{selected.label}</strong>
                  <p className="text-caption text-muted">{formatCoins(selected.total)} xu</p>
                </div>
                <strong className="text-xl tabular-nums">{selected.price}</strong>
              </div>
              <p className="mt-4 flex items-center gap-2 text-caption text-ink/70">
                <ShieldCheck size={18} aria-hidden="true" className="shrink-0 text-brand-strong" />
                Đây chỉ là giao diện mô phỏng — không có thanh toán thật.
              </p>
              <Button onClick={purchase} className="mt-5 w-full">
                <Check size={16} aria-hidden="true" />
                Hoàn tất giao dịch mô phỏng
              </Button>
            </div>
          )}
        </Modal>
      </div>
    </ReaderLayout>
  );
}
