import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, EmptyState, Modal, Reveal, Skeleton, Tabs } from '../../components/ui'
import {
  AlertTriangle,
  Check,
  Coins,
  Download,
  Plus,
  RefreshCw,
  WalletCards,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { useBackendResource } from '../../api/useBackendResource'
import { apiRequest } from '../../api/client'
import { notifyWalletBalanceChanged } from '../../api/walletEvents'
import { PendingTopUps } from '../../components/reader/PendingTopUps'
import { useLocale } from '../../context/LocaleContext'
import { downloadReportCsv } from '../../utils/reportCsv'

const transactionLabels = {
  'topup-credit': 'Nạp xu',
  'unlock-debit': 'Mở khóa chương',
  'allocation-credit': 'Phân bổ doanh thu',
  'withdrawal-debit': 'Lập khoản chi trả',
  adjustment: 'Điều chỉnh ví',
  reversal: 'Bút toán đảo',
  'deletion-forfeiture': 'Thu hồi xu khi đóng tài khoản',
}

const filters = [
  ['all', 'Tất cả giao dịch'],
  ['added', 'Xu đã nạp'],
  ['unlock', 'Chương đã mở khóa'],
  ['other', 'Biến động khác'],
]

const typeTone = { added: 'text-brand-strong', unlock: 'text-ink' }
const formatCoins = value => value.toLocaleString('vi-VN')
const TABLE_COLUMNS = 6

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Thử lại
    </Button>
  )
}

const emptyWallet = {
  balance: 0,
  entries: [],
  hasMore: false,
}

const selectWallet = response => {
  if (
    !response ||
    !Number.isSafeInteger(response.balance) ||
    response.balance < 0 ||
    !Array.isArray(response.entries) ||
    response.entries.length > 50 ||
    typeof response.hasMore !== 'boolean'
  ) {
    throw new Error('Dữ liệu ví không hợp lệ')
  }

  const invalidEntry = response.entries.some(entry => {
    return (
      !entry ||
      typeof entry.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(entry.id) ||
      !Object.hasOwn(transactionLabels, entry.type) ||
      !Number.isSafeInteger(entry.amount) ||
      typeof entry.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(entry.occurredAt))
    )
  })

  if (invalidEntry) {
    throw new Error('Dữ liệu giao dịch không hợp lệ')
  }

  return response
}

const emptyPackages = []

const selectPackages = response => {
  if (!response || !Array.isArray(response.items)) {
    throw new Error('Danh sách gói nạp không hợp lệ')
  }

  const invalidPackage = response.items.some(pack => {
    return (
      !pack ||
      typeof pack.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(pack.id) ||
      !Number.isSafeInteger(pack.priceVnd) ||
      pack.priceVnd <= 0 ||
      !Number.isSafeInteger(pack.coinAmount) ||
      pack.coinAmount !== pack.priceVnd
    )
  })

  if (invalidPackage) {
    throw new Error('Thông tin gói nạp không hợp lệ')
  }

  return response.items
}

function buildTopUpQrUrl(payment) {
  const params = new URLSearchParams({
    acc: payment.accountNumber,
    bank: payment.bankName,
    amount: String(payment.amount),
    des: payment.content,
    template: 'compact',
  })

  return `https://vietqr.app/img?${params.toString()}`
}

export function WalletPage() {
  const { t } = useLocale()
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const [orderRevision, setOrderRevision] = useState(0)
  const wallet = useBackendResource(
    `/reader/wallet?page=${page}&type=${filter}`,
    emptyWallet,
    selectWallet,
  )
  const packages = useBackendResource('/reader/top-up-packages', emptyPackages, selectPackages)
  const ledger = wallet
  const balance = wallet.data.balance
  const [notice, setNotice] = useState('')

  const [creatingPackageId, setCreatingPackageId] = useState(null)
  const [topUpOrder, setTopUpOrder] = useState(null)
  const [orderError, setOrderError] = useState('')
  const [qrError, setQrError] = useState(false)

  const [checkingOrder, setCheckingOrder] = useState(false)
  const [statusError, setStatusError] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)

  const [currentTime, setCurrentTime] = useState(() => Date.now())

  const pendingOrderId = topUpOrder?.status === 'pending' ? topUpOrder.id : null

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const records = useMemo(
    () =>
      wallet.data.entries.map(entry => ({
        id: entry.id,
        date: new Date(entry.occurredAt).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
        type:
          entry.type === 'topup-credit'
            ? 'added'
            : entry.type === 'unlock-debit'
              ? 'unlock'
              : 'other',
        label: transactionLabels[entry.type],
        item: entry.description ?? entry.id,
        balanceAfter: entry.balanceAfter,
        amount: entry.amount,
      })),
    [wallet.data.entries],
  )

  const shown = records

  const exportCsv = () => {
    const rows = [
      ['Ngày & giờ', 'Loại', 'Chi tiết', 'Số xu'],
      ...shown.map(item => [item.date, item.label, item.item, item.amount]),
    ]
    downloadReportCsv('novelhub-giao-dich-trang-' + page + '.csv', rows[0], rows.slice(1))
    setNotice('Đã xuất CSV giao dịch.')
  }

  async function openOrder(orderId) {
    setQrError(false)
    setOrderError('')
    try {
      const result = await apiRequest(`/reader/top-up-orders/${orderId}`)
      setTopUpOrder(result.order)
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function handleCreateOrder(pack) {
    if (creatingPackageId) return

    setCreatingPackageId(pack.id)
    setOrderError('')
    setQrError(false)

    try {
      const result = await apiRequest('/reader/top-up-orders', {
        method: 'POST',
        body: { packageId: pack.id },
      })

      setTopUpOrder(result.order)
      setOrderRevision(value => value + 1)
    } catch (error) {
      setOrderError(error.message || 'Không tạo được đơn nạp xu.')
    } finally {
      setCreatingPackageId(null)
    }
  }

  async function handleCheckPayment() {
    if (!topUpOrder || checkingOrder) return

    const orderId = topUpOrder.id

    setStatusMessage(null)
    setCheckingOrder(true)
    setStatusError(null)

    try {
      const result = await apiRequest(`/reader/top-up-orders/${orderId}`)

      setTopUpOrder(current =>
        current?.id === orderId ? { ...current, ...result.order } : current,
      )

      setStatusMessage({
        orderId,
        text:
          result.order.reviewState &&
          result.order.reviewState !== 'no-payment' &&
          result.order.status !== 'paid'
            ? t('walletFlow.' + result.order.reviewState) + '. ' + t('walletFlow.doNotRepay')
            : result.order.status === 'paid'
              ? t('walletFlow.paymentConfirmed')
              : result.order.status === 'expired'
                ? t('walletFlow.paymentExpired')
                : t('walletFlow.paymentNotReceived'),
      })

      if (result.order.status === 'paid') {
        wallet.retry()
        notifyWalletBalanceChanged()
        setOrderRevision(value => value + 1)
        setNotice('Đơn đã được xác nhận thanh toán.')
      }
    } catch (error) {
      setStatusError({
        orderId,
        message: error.message || 'Không kiểm tra được thanh toán.',
      })
    } finally {
      setCheckingOrder(false)
    }
  }

  useEffect(() => {
    if (!pendingOrderId) return undefined

    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(timer)
  }, [pendingOrderId])

  const displayedOrderStatus =
    topUpOrder?.status === 'pending' && new Date(topUpOrder.expiresAt).getTime() <= currentTime
      ? 'expired'
      : topUpOrder?.status
  return (
    <ReaderLayout>
      <div className="page-reader py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-brand-strong">
          Sổ giao dịch · Tài khoản độc giả
        </p>
        <h1 className="mt-2 text-h2 sm:text-h1">Ví &amp; Xu</h1>
        <p className="mt-2 max-w-prose text-sm text-ink/70">
          Quản lý số dư và lịch sử giao dịch xu của bạn.
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
            {wallet.status === 'error' || wallet.status === 'empty' ? (
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
                    <p className="mt-3 text-caption text-muted">Xu không hết hạn.</p>
                  </div>
                  <div className="sm:shrink-0 sm:text-right">
                    <Button
                      type="button"
                      onClick={() => {
                        document.getElementById('coin-packages')?.scrollIntoView({
                          block: 'start',
                        })
                      }}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Nạp thêm xu
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <PendingTopUps key={orderRevision} revision={orderRevision} onOpen={openOrder} />
            <Reveal as="section" id="coin-packages" className="scroll-mt-24">
              <h2 className="text-h3">Các gói nạp xu</h2>
              {orderError && (
                <p role="alert" className="mt-3 text-sm text-red-600">
                  {orderError}
                </p>
              )}

              {packages.status === 'loading' ? (
                <p className="mt-3 text-sm text-muted">Đang tải gói nạp...</p>
              ) : packages.status === 'error' ? (
                <Card className="mt-3">
                  <p className="mb-3 text-sm">Không tải được danh sách gói nạp.</p>
                  <RetryButton onClick={packages.retry} />
                </Card>
              ) : packages.status === 'empty' ? (
                <Card className="mt-3">
                  <p className="text-sm text-muted">Hiện chưa có gói nạp khả dụng.</p>
                </Card>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {packages.data.map(pack => (
                    <Card key={pack.id}>
                      <h3 className="text-h3">{formatCoins(pack.coinAmount)} xu</h3>

                      <p className="mt-2 text-sm text-muted">{formatCoins(pack.priceVnd)} VND</p>

                      <Button
                        className="mt-4"
                        disabled={creatingPackageId !== null}
                        onClick={() => handleCreateOrder(pack)}
                      >
                        {creatingPackageId === pack.id ? 'Đang tạo đơn...' : 'Chọn gói'}
                      </Button>
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
                      Chi tiết các lần tăng và giảm xu trong ví.
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
                    {t('walletFlow.exportPage')}
                  </Button>
                </div>
                <div className="mt-5 px-6">
                  <Tabs
                    singleRow
                    label="Lọc giao dịch"
                    value={filter}
                    onChange={value => {
                      setFilter(value)
                      setPage(1)
                    }}
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
                        {Array.from({ length: 3 }, (_, index) => (
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
                ) : ledger.status === 'error' || ledger.status === 'empty' ? (
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
                        {shown.map(item => (
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
                            <td className="px-3 text-right tabular-nums text-muted">
                              {Number.isSafeInteger(item.balanceAfter)
                                ? formatCoins(item.balanceAfter)
                                : '—'}
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
                        : 'Các biến động xu sẽ được hiển thị tại đây.'
                    }
                    action={
                      filter !== 'all' ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setFilter('all')
                            setPage(1)
                          }}
                        >
                          Xem tất cả giao dịch
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            document
                              .getElementById('coin-packages')
                              ?.scrollIntoView({ behavior: 'smooth' })
                          }}
                        >
                          <Plus size={14} aria-hidden="true" />
                          Nạp thêm xu
                        </Button>
                      )
                    }
                  />
                )}
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line p-4">
                  <Button
                    variant="secondary"
                    disabled={page === 1 || ledger.status === 'loading'}
                    onClick={() => setPage(value => value - 1)}
                  >
                    {t('walletFlow.previous')}
                  </Button>
                  <span>{page}</span>
                  <Button
                    variant="secondary"
                    disabled={!wallet.data.hasMore || ledger.status === 'loading'}
                    onClick={() => setPage(value => value + 1)}
                  >
                    {t('walletFlow.next')}
                  </Button>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>
      <Modal open={topUpOrder !== null} title="Đơn nạp xu" onClose={() => setTopUpOrder(null)}>
        {topUpOrder && (
          <div className="space-y-4">
            <p>
              Trạng thái:{' '}
              {displayedOrderStatus === 'pending'
                ? 'Chờ thanh toán'
                : displayedOrderStatus === 'expired'
                  ? 'Đã hết hạn'
                  : 'Đã thanh toán'}
            </p>

            <p>
              Mã thanh toán: <strong>{topUpOrder.paymentCode}</strong>
            </p>

            <p>
              Số tiền: <strong>{formatCoins(topUpOrder.priceVnd)} VND</strong>
            </p>

            <p>
              Số xu: <strong>{formatCoins(topUpOrder.coinAmount)} xu</strong>
            </p>

            <p>
              Hạn thanh toán:{' '}
              {new Date(topUpOrder.expiresAt).toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh',
              })}
            </p>

            {topUpOrder.reviewState &&
              topUpOrder.reviewState !== 'no-payment' &&
              topUpOrder.status !== 'paid' && (
                <p role="status" className="rounded-xl border border-line p-3 text-sm">
                  {t('walletFlow.' + topUpOrder.reviewState)}. {t('walletFlow.doNotRepay')}
                </p>
              )}
            {/* QR code for payment */}
            {topUpOrder.payment && (
              <div className="space-y-3 border-t border-border pt-4">
                <p>
                  Ngân hàng: <strong>{topUpOrder.payment.bankName}</strong>
                </p>

                <p>
                  Số tài khoản:{' '}
                  <strong className="break-all">{topUpOrder.payment.accountNumber}</strong>
                </p>

                <p>
                  Chủ tài khoản: <strong>{topUpOrder.payment.accountName}</strong>
                </p>

                <p>
                  Nội dung chuyển khoản: <strong>{topUpOrder.payment.content}</strong>
                </p>

                {displayedOrderStatus === 'pending' &&
                  (!topUpOrder.reviewState || topUpOrder.reviewState === 'no-payment') &&
                  (qrError ? (
                    <p role="alert" className="text-sm text-muted">
                      Không tải được QR. Bạn có thể chuyển khoản theo thông tin trên, giữ đúng số
                      tiền và nội dung chuyển khoản.
                      <a
                        href={buildTopUpQrUrl(topUpOrder.payment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Mở trực tiếp ảnh QR để kiểm tra
                      </a>
                    </p>
                  ) : (
                    <img
                      src={buildTopUpQrUrl(topUpOrder.payment)}
                      alt="Mã QR chuyển khoản thanh toán đơn nạp xu"
                      className="mx-auto h-auto w-full max-w-72"
                      onError={() => setQrError(true)}
                    />
                  ))}
              </div>
            )}

            <div className="space-y-4 border-t border-line pt-4">
              <p className="text-sm leading-6 text-muted">{t('walletFlow.confirmationHint')}</p>

              {statusMessage?.orderId === topUpOrder.id && (
                <div
                  role="status"
                  aria-atomic="true"
                  className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  {displayedOrderStatus === 'paid' ? (
                    <Check
                      size={20}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-brand-strong"
                    />
                  ) : (
                    <RefreshCw
                      size={20}
                      aria-hidden="true"
                      className="mt-0.5 shrink-0 text-brand-strong"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-ink">{t('walletFlow.checkResult')}</p>
                    <p className="break-words text-sm leading-6 text-ink">{statusMessage.text}</p>
                  </div>
                </div>
              )}

              {statusError?.orderId === topUpOrder.id && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-2xl border border-rose/25 bg-rose/10 p-4"
                >
                  <AlertTriangle
                    size={20}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-rose-strong"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-rose-strong">
                      {t('walletFlow.checkError')}
                    </p>
                    <p className="break-words text-sm leading-6 text-ink">{statusError.message}</p>
                  </div>
                </div>
              )}

              {topUpOrder.status === 'pending' && (
                <Button
                  type="button"
                  className="min-h-12 w-full gap-2"
                  onClick={handleCheckPayment}
                  disabled={checkingOrder}
                  aria-busy={checkingOrder}
                >
                  <RefreshCw
                    size={18}
                    aria-hidden="true"
                    className={checkingOrder ? 'shrink-0 motion-safe:animate-spin' : 'shrink-0'}
                  />
                  {t(checkingOrder ? 'walletFlow.checkingPayment' : 'walletFlow.checkPayment')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </ReaderLayout>
  )
}
