import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Coins, RefreshCw, Save, WalletCards } from '../../components/icons'
import { AuthorLayout } from '../../layouts'
import { apiRequest } from '../../api/client'
import { useBackendDocument } from '../../api/useBackendResource'
import { useLocale } from '../../context/LocaleContext'
import { Badge, Button, Card, EmptyState, Input, Skeleton } from '../../components/ui'

const emptyFinance = {
  balance: 0,
  entries: [],
  hasMoreEntries: false,
  paymentDetails: null,
  payouts: [],
}

const ledgerLabels = {
  'allocation-credit': 'Phân bổ doanh thu',
  'withdrawal-debit': 'Trừ cho khoản chi trả',
  adjustment: 'Điều chỉnh ví',
  reversal: 'Đảo giao dịch',
  'deletion-forfeiture': 'Thu hồi khi đóng tài khoản',
}

const payoutLabels = { pending: 'Đang chờ xử lý', paid: 'Đã thanh toán' }

function RetryButton({ onClick }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick}>
      <RefreshCw size={14} aria-hidden="true" />
      Tải lại
    </Button>
  )
}

function formatCoins(value) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} xu`
}

function FinanceSkeleton() {
  return (
    <div
      aria-busy="true"
      className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]"
    >
      <Card>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-4 h-12 w-64" />
        <Skeleton className="mt-7 h-48 w-full rounded-2xl" />
      </Card>
      <Card>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-5 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
        <Skeleton className="mt-3 h-10 w-full" />
      </Card>
    </div>
  )
}

export function AuthorEarningsPage() {
  const { formatDate, formatNumber } = useLocale()
  const finance = useBackendDocument('/author/earnings', emptyFinance)
  const [details, setDetails] = useState(null)
  const [savedDetails, setSavedDetails] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (finance.status === 'ready') {
      const next = finance.data.paymentDetails ?? {
        bankName: '',
        accountNumber: '',
        accountHolder: '',
      }
      // The form mirrors the latest server snapshot when the resource changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetails(next)
      setSavedDetails(next)
    }
  }, [finance.status, finance.data.paymentDetails])

  const changed = useMemo(
    () => JSON.stringify(details ?? {}) !== JSON.stringify(savedDetails ?? {}),
    [details, savedDetails],
  )

  const saveDetails = async event => {
    event.preventDefault()
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const result = await apiRequest('/author/earnings/payment-details', {
        method: 'PUT',
        body: details,
      })
      setDetails(result.paymentDetails)
      setSavedDetails(result.paymentDetails)
      setNotice('Đã lưu thông tin ngân hàng cho kỳ chi trả tiếp theo.')
    } catch (failure) {
      setError(failure.message || 'Không lưu được thông tin ngân hàng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthorLayout>
      <div className="page-author py-7">
        <header className="flex flex-col gap-3">
          <p className="nh-eyebrow">Doanh thu tác giả · dữ liệu máy chủ</p>
          <h1 className="text-h2 sm:text-h1">Doanh thu và chi trả</h1>
          <p className="max-w-[70ch] text-sm leading-6 text-muted">
            Theo dõi số dư nhuận bút, giao dịch phân bổ từ lượt mở khóa và các kỳ chi trả đã ghi
            nhận. Thông tin ngân hàng chỉ áp dụng cho những kỳ đánh giá tiếp theo.
          </p>
        </header>
        {finance.status === 'loading' ? (
          <FinanceSkeleton />
        ) : finance.status === 'error' ? (
          <Card className="mt-6 p-0">
            <EmptyState
              tone="rose"
              icon={AlertTriangle}
              title="Không tải được dữ liệu doanh thu"
              description="Kết nối tới máy chủ bị gián đoạn. Hãy tải lại để xem số dư và lịch sử chi trả."
              action={<RetryButton onClick={finance.retry} />}
            />
          </Card>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="grid gap-4 sm:grid-cols-2">
              <Card className="border-brand/30 bg-brand/8">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand/15 text-brand-strong">
                    <Coins size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm text-muted">Số dư nhuận bút khả dụng</p>
                    <strong className="mt-1 block text-h2 tabular-nums">
                      {formatCoins(finance.data.balance)}
                    </strong>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-muted">
                  Số dư này tách biệt với ví xu độc giả. Các khoản chi trả hàng tháng được tạo theo
                  chính sách hiện hành.
                </p>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-orange/15 text-orange-strong">
                    <WalletCards size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm text-muted">Giao dịch đang hiển thị</p>
                    <strong className="mt-1 block text-h2 tabular-nums">
                      {formatNumber(finance.data.entries.length)}
                    </strong>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-6 text-muted">
                  Tối đa 50 bút toán gần nhất. Bút toán là lịch sử bất biến và không thể sửa trực
                  tiếp.
                </p>
              </Card>
            </section>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)]">
              <div className="min-w-0 space-y-6">
                <Card className="overflow-hidden p-0">
                  <div className="p-6 pb-4">
                    <h2 className="text-h3">Lịch sử giao dịch thu nhập</h2>
                    <p className="mt-1 text-sm text-muted">
                      Các khoản phân bổ, chi trả và điều chỉnh gắn với ví nhuận bút.
                    </p>
                  </div>
                  {finance.data.entries.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="border-y border-hairline bg-elevated text-xs text-muted">
                          <tr>
                            <th scope="col" className="px-6 py-3 font-semibold">
                              Thời gian
                            </th>
                            <th scope="col" className="px-3 py-3 font-semibold">
                              Loại giao dịch
                            </th>
                            <th scope="col" className="px-3 py-3 text-right font-semibold">
                              Số xu
                            </th>
                            <th scope="col" className="px-3 py-3 font-semibold">
                              Mã tham chiếu
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {finance.data.entries.map(entry => (
                            <tr key={entry.id}>
                              <td className="whitespace-nowrap px-6 py-4 text-muted">
                                {formatDate(entry.occurredAt)}
                              </td>
                              <th scope="row" className="px-3 py-4 font-semibold">
                                {ledgerLabels[entry.type] ?? entry.type}
                              </th>
                              <td
                                className={`px-3 py-4 text-right font-semibold tabular-nums ${entry.amount >= 0 ? 'text-brand-strong' : 'text-rose-strong'}`}
                              >
                                {entry.amount >= 0 ? '+' : ''}
                                {formatNumber(entry.amount)}
                              </td>
                              <td
                                className="max-w-48 truncate px-3 py-4 font-mono text-xs text-muted"
                                title={entry.sourceId ?? ''}
                              >
                                {entry.sourceId ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Coins}
                      title="Chưa có giao dịch thu nhập"
                      description="Các khoản phân bổ từ lượt mở khóa sẽ xuất hiện tại đây sau khi có giao dịch hợp lệ."
                    />
                  )}
                </Card>
                <Card className="overflow-hidden p-0">
                  <div className="p-6 pb-4">
                    <h2 className="text-h3">Lịch sử chi trả</h2>
                    <p className="mt-1 text-sm text-muted">
                      Mỗi dòng giữ lại kỳ chi trả, số xu đã trừ và kết quả xử lý mới nhất.
                    </p>
                  </div>
                  {finance.data.payouts.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="border-y border-hairline bg-elevated text-xs text-muted">
                          <tr>
                            <th scope="col" className="px-6 py-3 font-semibold">
                              Kỳ
                            </th>
                            <th scope="col" className="px-3 py-3 text-right font-semibold">
                              Số xu
                            </th>
                            <th scope="col" className="px-3 py-3 font-semibold">
                              Trạng thái
                            </th>
                            <th scope="col" className="px-3 py-3 font-semibold">
                              Kết quả gần nhất
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {finance.data.payouts.map(payout => (
                            <tr key={payout.id}>
                              <th scope="row" className="px-6 py-4 font-semibold">
                                {payout.periodId}
                              </th>
                              <td className="px-3 py-4 text-right tabular-nums">
                                {formatNumber(payout.amountCoins)}
                              </td>
                              <td className="px-3 py-4">
                                <Badge tone={payout.status === 'paid' ? 'green' : 'neutral'}>
                                  {payoutLabels[payout.status] ?? payout.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-4 text-muted">
                                {payout.result
                                  ? `${payout.result}${payout.resultAt ? ` · ${formatDate(payout.resultAt)}` : ''}`
                                  : 'Chưa có kết quả'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={WalletCards}
                      title="Chưa có kỳ chi trả"
                      description="Kỳ chi trả đầu tiên sẽ xuất hiện sau khi số dư và thông tin ngân hàng đủ điều kiện."
                    />
                  )}
                </Card>
              </div>
              <Card as="form" onSubmit={saveDetails} className="min-w-0">
                <h2 className="text-h3">Ngân hàng nhận chi trả</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Thay đổi chỉ áp dụng cho những kỳ đánh giá sau. Thông tin ngân hàng đã chụp trong
                  khoản chi trả cũ không bị sửa.
                </p>
                {notice && (
                  <p
                    className="mt-4 rounded-2xl bg-brand/10 px-4 py-3 text-sm text-brand-strong"
                    role="status"
                  >
                    <Check size={16} className="mr-2 inline" aria-hidden="true" />
                    {notice}
                  </p>
                )}
                {error && (
                  <p
                    className="mt-4 rounded-2xl bg-rose/10 px-4 py-3 text-sm text-rose-strong"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-5 space-y-4">
                  <label className="block text-sm font-semibold" htmlFor="author-bank-name">
                    Tên ngân hàng
                    <Input
                      id="author-bank-name"
                      className="mt-2"
                      value={details?.bankName ?? ''}
                      onChange={event =>
                        setDetails(current => ({
                          ...(current ?? {}),
                          bankName: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold" htmlFor="author-bank-account">
                    Số tài khoản
                    <Input
                      id="author-bank-account"
                      className="mt-2"
                      value={details?.accountNumber ?? ''}
                      onChange={event =>
                        setDetails(current => ({
                          ...(current ?? {}),
                          accountNumber: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold" htmlFor="author-bank-holder">
                    Tên chủ tài khoản
                    <Input
                      id="author-bank-holder"
                      className="mt-2"
                      value={details?.accountHolder ?? ''}
                      onChange={event =>
                        setDetails(current => ({
                          ...(current ?? {}),
                          accountHolder: event.target.value,
                        }))
                      }
                      required
                    />
                  </label>
                </div>
                {changed && (
                  <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-hairline pt-5">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDetails(savedDetails)
                        setError('')
                        setNotice('')
                      }}
                    >
                      Hủy thay đổi
                    </Button>
                    <Button type="submit" disabled={saving}>
                      <Save size={16} aria-hidden="true" />
                      {saving ? 'Đang lưu…' : 'Lưu thông tin'}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </AuthorLayout>
  )
}
