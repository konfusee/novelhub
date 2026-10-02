import { useMemo, useState } from 'react'
import {
  BadgeDollarSign,
  Check,
  ChevronDown,
  Coins,
  Download,
  Heart,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
} from '../../components/icons'
import { ReaderLayout } from '../../layouts'
import { Badge, Button, Card, Modal } from '../../components/ui'
import { coinPackages, transactions } from '../../data/mock/wallet'

const filters = [
  ['all', 'Tất cả giao dịch'], ['added', 'Xu đã nạp'], ['unlock', 'Chương đã mở khóa'], ['tip', 'Ủng hộ tác giả'],
]

export function WalletPage() {
  const [balance, setBalance] = useState(1420)
  const [autoUnlock, setAutoUnlock] = useState(true)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [faq, setFaq] = useState(0)
  const [records, setRecords] = useState(transactions)
  const shown = useMemo(
    () => (filter === 'all' ? records : records.filter(item => item.type === filter)),
    [filter, records],
  )
  const purchase = () => {
    if (!selected) return
    setBalance(current => current + selected.total)
    setRecords(current => [
      {
        date: 'Vừa xong',
        type: 'added',
        label: 'Nạp xu',
        item: `${selected.label} (${selected.price})`,
        amount: selected.total,
        balance: balance + selected.total,
      },
      ...current,
    ])
    setSelected(null)
  }
  return (
    <ReaderLayout>
      <main className="page-reader py-7">
        <p className="text-[10px] uppercase tracking-[.2em] text-brand">
          Sổ giao dịch · Tài khoản độc giả #NH-94821
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Ví &amp; Xu</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Quản lý số dư, mở khóa chương và ủng hộ tác giả yêu thích bằng hệ thống xu minh bạch.
        </p>
        <div className="nh-grid-12 mt-6 grid min-w-0 items-start gap-6 nh-layout-xl-8-4">
          <div className="min-w-0 space-y-6">
            <Card>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs text-muted">Số dư khả dụng</p>
                  <p className="mt-2 flex items-center gap-3 text-4xl font-bold">
                    <span className="grid size-11 place-items-center rounded-full bg-orange/20 text-orange">
                      <Coins />
                    </span>
                    {balance.toLocaleString()} <span className="text-lg text-orange">Xu</span>
                  </p>
                  <p className="mt-2 text-[10px] text-muted">
                    Quy đổi: <strong className="text-ink">100 xu ≈ 0,99 USD</strong> · Xu không hết hạn
                  </p>
                </div>
                <div>
                  <Button onClick={() => setSelected(coinPackages[1])}>
                    <Plus size={16} />
                    Nạp thêm xu
                  </Button>
                  <p className="mt-2 flex items-center gap-1 text-[10px] text-brand">
                    <LockKeyhole size={12} />
                    Thanh toán mô phỏng bảo mật 256-bit
                  </p>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
                <div>
                  <strong className="text-sm">Tự động mở khóa chương mới khi phát hành</strong>
                  <p className="text-xs text-muted">
                    Tự động dùng xu trong ví cho các truyện đã đánh dấu.
                  </p>
                </div>
                <button
                  aria-label="Bật hoặc tắt tự động mở khóa"
                  onClick={() => setAutoUnlock(!autoUnlock)}
                  className={`h-7 w-12 rounded-full p-1 ${autoUnlock ? 'bg-brand' : 'bg-line'}`}
                >
                  <span
                    className={`block size-5 rounded-full bg-white transition ${autoUnlock ? 'translate-x-5' : ''}`}
                  />
                </button>
              </div>
            </Card>
            <section>
              <h2 className="text-xl font-semibold">Các gói nạp xu</h2>
              <p className="text-xs text-muted">
                Xu được cộng ngay vào tài khoản đọc của bạn.
              </p>
              <div className="nh-grid-12 mt-4 grid nh-cols-2 gap-3 nh-lg-cols-4">
                {coinPackages.map(pack => (
                  <Card
                    key={pack.id}
                    className={`relative flex min-h-72 flex-col p-4 ${pack.badge ? 'border-brand' : ''}`}
                  >
                    {pack.badge && (
                      <Badge
                        tone="green"
                        className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap"
                      >
                        {pack.badge}
                      </Badge>
                    )}
                    <p className="text-xs text-muted">{pack.label}</p>
                    <p className="mt-4 text-2xl font-bold">{pack.coins.toLocaleString()}</p>
                    {pack.bonus && (
                      <p className="text-[10px] text-orange">
                        +{pack.bonus} xu thưởng · Tổng {pack.total.toLocaleString()} xu
                      </p>
                    )}
                    <p className="mt-4 text-xs leading-5 text-muted">{pack.note}</p>
                    <div className="mt-auto border-t border-line pt-4">
                      <strong className="text-lg">{pack.price}</strong>
                      <Button
                        variant={pack.badge ? 'primary' : 'secondary'}
                        onClick={() => setSelected(pack)}
                        className="mt-3 w-full min-h-9 px-2 py-1 text-xs"
                      >
                        {pack.badge ? 'Mua gói' : 'Chọn gói'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Lịch sử giao dịch</h2>
                  <p className="text-xs text-muted">
                    Chi tiết các lần mở khóa, nạp xu và ủng hộ tác giả.
                  </p>
                </div>
                <button onClick={() => window.alert('Đã xuất CSV giao dịch (mô phỏng).')} className="flex items-center gap-1 text-xs text-brand">
                  <Download size={14} />
                  Xuất dữ liệu
                </button>
              </div>
              <div className="mt-5 flex gap-2 overflow-x-auto">
                {filters.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${filter === value ? 'bg-brand text-white' : 'bg-elevated text-muted'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="border-y border-line text-[10px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="py-3">Ngày &amp; giờ</th><th>Loại</th><th>Chi tiết</th><th>Số xu</th><th>Số dư</th><th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(item => (
                      <tr key={`${item.date}-${item.item}`} className="border-b border-line">
                        <td className="py-4 text-muted">{item.date}</td>
                        <td
                          className={
                            item.amount > 0
                              ? 'text-brand'
                              : item.type === 'tip'
                                ? 'text-purple'
                                : 'text-ink'
                          }
                        >
                          {item.label}
                        </td>
                        <td>{item.item}</td>
                        <td className={item.amount > 0 ? 'font-semibold text-brand' : ''}>
                          {item.amount > 0 ? '+' : ''}
                          {item.amount.toLocaleString()} xu
                        </td>
                        <td className="text-muted">{item.balance.toLocaleString()}</td>
                        <td>
                          <Badge tone="green">Hoàn tất</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
          <aside className="min-w-0 space-y-5">
            <Card>
              <div className="flex gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand/15 text-brand">
                  <BadgeDollarSign />
                </span>
                <div>
                  <h2 className="text-lg font-semibold">Xu của bạn được phân bổ thế nào?</h2>
                  <p className="text-xs text-muted">Hỗ trợ trực tiếp nhà sáng tạo</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-muted">
                NovelHub xây dựng hệ sinh thái truyện dài minh bạch. Khi bạn dùng xu, khoản tiền sẽ trực tiếp hỗ trợ các tác giả.
              </p>
              <div className="mt-4 rounded-2xl bg-elevated p-4">
                <div className="flex justify-between text-sm">
                  <span>Phần chia sẻ cho tác giả độc lập</span>
                  <strong className="text-brand">70%</strong>
                </div>
                <div className="mt-3 flex h-2 overflow-hidden rounded-full">
                  <span className="w-[70%] bg-brand" />
                  <span className="w-[20%] bg-orange" />
                  <span className="w-[10%] bg-muted" />
                </div>
              </div>
              <p className="mt-4 flex gap-2 rounded-xl bg-orange/10 p-3 text-xs text-orange">
                <Heart size={15} />
                Hơn 1,4 triệu USD tiền bản quyền nhỏ đã được trả cho các tác giả độc lập.
              </p>
            </Card>
            <Card>
              <h2 className="text-lg font-semibold">Câu hỏi về Xu &amp; Ví</h2>
              <div className="mt-4 divide-y divide-line">
                {[
                  'Xu đã mua có hết hạn không?', 'Giá mở khóa chương là bao nhiêu?', 'Tôi có thể yêu cầu hoàn xu không?', 'Xu thưởng là gì?',
                ].map((question, index) => (
                  <button
                    key={question}
                    onClick={() => setFaq(faq === index ? -1 : index)}
                    className="w-full py-3 text-left text-xs font-semibold"
                  >
                    <span className="flex items-center justify-between">
                      {question}
                      <ChevronDown size={14} />
                    </span>
                    {faq === index && (
                      <p className="mt-2 font-normal leading-5 text-muted">
                        Xu không hết hạn và luôn gắn với hồ sơ độc giả. Bộ phận hỗ trợ có thể xem xét các giao dịch đủ điều kiện.
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </Card>
            <Card className="flex gap-3 bg-purple/10">
              <Sparkles className="shrink-0 text-orange" />
              <div>
                <strong className="text-sm">Thưởng đọc hằng ngày</strong>
                <p className="mt-1 text-xs text-muted">
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
              <div className="flex items-center justify-between rounded-2xl bg-elevated p-4">
                <div>
                  <strong>{selected.label}</strong>
                  <p className="text-xs text-muted">{selected.total.toLocaleString()} xu</p>
                </div>
                <strong className="text-xl">{selected.price}</strong>
              </div>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted">
                <ShieldCheck className="text-brand" />
                Đây chỉ là giao diện mô phỏng — không có thanh toán thật.
              </p>
              <Button onClick={purchase} className="mt-5 w-full">
                <Check size={16} />
                Hoàn tất giao dịch mô phỏng
              </Button>
            </div>
          )}
        </Modal>
      </main>
    </ReaderLayout>
  )
}
