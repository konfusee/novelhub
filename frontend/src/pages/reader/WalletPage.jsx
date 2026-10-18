import { useEffect, useId, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  BookOpen,
  Check,
  ChevronDown,
  Coins,
  Download,
  LockKeyhole,
  Plus,
  RefreshCw,
  WalletCards,
} from '../../components/icons';
import { ReaderLayout } from '../../layouts';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Reveal,
  Skeleton,
  Tabs,
} from '../../components/ui';
import { useBackendResource } from '../../api/useBackendResource';
import { useLocale } from '../../context/LocaleContext';
import { TopUpDialog } from './TopUpDialog';

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
const emptyWallet = { balance: 0, packages: [], entries: [], orders: [], payment: null };
const selectWallet = (value) => {
  if (
    !value ||
    !Number.isSafeInteger(value.balance) ||
    value.balance < 0 ||
    !Array.isArray(value.packages) ||
    !Array.isArray(value.entries) ||
    !Array.isArray(value.orders) ||
    value.packages.some(
      (p) =>
        !p ||
        typeof p.id !== 'string' ||
        !Number.isSafeInteger(p.coinAmount) ||
        p.coinAmount <= 0 ||
        !Number.isSafeInteger(p.priceVnd) ||
        p.priceVnd <= 0,
    ) ||
    value.entries.some(
      (e) =>
        !e ||
        typeof e.id !== 'string' ||
        !Number.isSafeInteger(e.amount) ||
        !Number.isFinite(Date.parse(e.occurredAt)),
    ) ||
    value.orders.some((o) => !o || typeof o.id !== 'string' || typeof o.paymentCode !== 'string')
  )
    throw new Error('Invalid wallet response');
  return value;
};
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
  const { t } = useLocale();
  const m = (key) => t(`walletLive.${key}`);
  const wallet = useBackendResource('/reader/wallet', emptyWallet, selectWallet);
  const balance = wallet.data.balance;
  const packs = {
    ...wallet,
    data: wallet.data.packages.map((p) => ({
      id: p.id,
      coins: p.coinAmount,
      total: p.coinAmount,
      label: `${formatCoins(p.coinAmount)} xu`,
      price: `${formatCoins(p.priceVnd)} VND`,
      note: m('fixedRate'),
    })),
  };
  if (packs.status === 'ready' && !packs.data.length) packs.status = 'empty';
  const ledger = wallet;
  const autoUnlock = false;
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
    () =>
      wallet.data.entries.map((e) => ({
        id: e.id,
        date: new Date(e.occurredAt).toLocaleString('vi-VN'),
        type: e.type === 'topup-credit' ? 'added' : e.type === 'unlock-debit' ? 'unlock' : 'other',
        label: t(`walletLive.ledgerTypes.${e.type}`),
        item: e.id,
        amount: e.amount,
      })),
    [wallet.data.entries, t],
  );
  const shown = useMemo(
    () => (filter === 'all' ? records : records.filter((item) => item.type === filter)),
    [filter, records],
  );
  const exportCsv = () => {
    const rows = [
      ['Ngày & giờ', 'Loại', 'Chi tiết', 'Số xu'],
      ...shown.map((item) => [item.date, item.label, item.item, item.amount]),
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
          {m('ledgerTitle')}
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
                    <p className="mt-3 text-caption text-muted">{m('fixedRate')}</p>
                  </div>
                  <div className="sm:shrink-0 sm:text-right">
                    <Button
                      onClick={() => setSelected(packs.data[0])}
                      disabled={packs.status !== 'ready' || !packs.data.length}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Nạp thêm xu
                    </Button>
                    <p className="mt-2 flex items-center gap-1.5 text-caption text-brand-strong sm:justify-end sm:whitespace-nowrap">
                      <LockKeyhole size={13} aria-hidden="true" className="shrink-0" />
                      {m('verifiedPayment')}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-hairline pt-5">
                  <div>
                    <strong id={`${ids}-auto`} className="text-sm">
                      Tự động mở khóa chương mới khi phát hành
                    </strong>
                    <p id={`${ids}-auto-note`} className="mt-0.5 text-caption text-muted">
                      {m('autoUnlockDeferred')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoUnlock}
                    aria-labelledby={`${ids}-auto`}
                    aria-describedby={`${ids}-auto-note`}
                    disabled
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
              <p className="mt-1 text-sm text-ink/70">{m('creditAfterVerification')}</p>
              {packs.status === 'loading' ? (
                <div
                  aria-busy="true"
                  aria-label="Đang tải các gói nạp xu"
                  className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4"
                >
                  {Array.from({ length: 4 }, (_, index) => (
                    <PackageSkeleton key={index} />
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
                        {Array.from({ length: 4 }, (_, index) => (
                          <tr key={index}>
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
                          <tr key={item.id}>
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
                            <td
                              title={m('historicalBalanceUnavailable')}
                              className="px-3 text-right tabular-nums text-muted"
                            >
                              —
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
                        <Button
                          size="sm"
                          disabled={!packs.data.length}
                          onClick={() => setSelected(packs.data[0])}
                        >
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
                <p className="text-sm text-muted">{m('policyShare')}</p>
                <strong className="text-brand-strong">
                  {wallet.status === 'ready' && wallet.data.authorRatePercent != null
                    ? `${wallet.data.authorRatePercent}%`
                    : '—'}
                </strong>
              </div>
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
            <Card>
              <h2 className="text-h3">{m('pendingOrders')}</h2>
              {wallet.data.orders.map((order) => (
                <Button
                  key={order.id}
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => setSelected({ order })}
                >
                  {order.paymentCode}
                </Button>
              ))}
              {wallet.status === 'ready' && !wallet.data.orders.length && (
                <p className="mt-2 text-sm text-muted">{m('noPendingOrders')}</p>
              )}
              <Button
                variant="secondary"
                className="mt-4"
                disabled={wallet.status === 'loading'}
                onClick={wallet.retry}
              >
                {m('refresh')}
              </Button>
              {wallet.data.hasMore && (
                <p className="mt-3 text-caption text-muted">{m('latestEntries')}</p>
              )}
            </Card>
          </aside>
        </div>
        {selected && (
          <TopUpDialog
            key={selected.order?.id ?? selected.id}
            selected={selected}
            payment={wallet.data.payment}
            onClose={() => setSelected(null)}
            onRefresh={wallet.retry}
          />
        )}
      </div>
    </ReaderLayout>
  );
}
