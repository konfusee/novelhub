// Financial notices are derived from committed evidence, not from client-side success messages.
// Keep account numbers, reader identity and private staff notes out of the notification view.
export function financeNotificationView(item) {
  const payload = item.payload ?? {}
  const coins = value =>
    Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('vi-VN') : '—'
  const title =
    typeof payload.chapterTitle === 'string' ? payload.chapterTitle.slice(0, 200) : 'Chương đã mua'
  const period = /^\d{4}-\d{2}$/.test(payload.periodId ?? '') ? payload.periodId : 'hiện tại'
  const simulated = payload.executionMode === 'simulation'
  const author = {
    type: 'system',
    label: 'Doanh thu & chi trả',
    href: '/author/earnings',
    action: 'Xem doanh thu',
  }
  const reader = {
    type: 'system',
    label: 'Ví & giao dịch',
    href: '/reader/wallet',
    action: 'Xem ví',
  }
  const notices = {
    'wallet.topup-credited': {
      ...reader,
      title: 'Nạp xu thành công',
      description: `Đã cộng ${coins(payload.amountCoins)} xu vào ví của bạn. Bạn có thể xem giao dịch trong lịch sử ví.`,
    },
    'wallet.topup-needs-review': {
      ...reader,
      title: 'Giao dịch nạp xu cần đối soát',
      description: `Đã ghi nhận khoản chuyển ${coins(payload.amountVnd)} VND liên quan đến đơn nạp của bạn, nhưng chưa thể tự động cộng xu. Không chuyển lại tiền; giao dịch đang chờ đối soát.`,
    },
    'wallet.reconciliation-credited': {
      ...reader,
      title: 'Đã cộng xu sau đối soát ngân hàng',
      description: `Giao dịch đã được đối soát. Ví của bạn được cộng ${coins(payload.amountCoins)} xu.`,
    },
    'wallet.chapter-unlocked': {
      ...reader,
      title: 'Mở khóa chương thành công',
      description: `Bạn đã dùng ${coins(payload.priceCoins)} xu để mở khóa “${title}”.`,
      ...(/^[a-f\d]{24}$/i.test(payload.storyId ?? '') &&
      /^[a-f\d]{24}$/i.test(payload.chapterId ?? '')
        ? { href: `/read/${payload.storyId}/${payload.chapterId}`, action: 'Đọc chương' }
        : {}),
    },
    'author.chapter-purchased': {
      ...author,
      title: 'Có độc giả mua chương của bạn',
      description: `Một độc giả đã mua quyền đọc “${title}” với giá ${coins(payload.priceCoins)} xu. Phần doanh thu ${coins(payload.amountCoins)} xu đã được cộng vào ví thu nhập của bạn.`,
    },
    'monthly-payout.created': {
      ...author,
      title: 'Đã lập khoản chi trả cho bạn',
      description: `Khoản chi kỳ ${period} đã được lập, trích ${coins(payload.amountCoins)} xu từ ví thu nhập để chờ ${simulated ? 'thanh toán giả lập' : 'xử lý thanh toán'}.`,
    },
    'monthly-payout.bank-details-missing': {
      ...author,
      title: 'Cần kiểm tra ngân hàng nhận chi trả',
      description: `Chưa thể lập khoản chi kỳ ${period} do thiếu hoặc sai thông tin ngân hàng. Xu vẫn nằm trong ví thu nhập; vui lòng cập nhật thông tin nhận tiền.`,
    },
    'monthly-payout.Paid': {
      ...author,
      title: simulated ? 'Chi trả giả lập thành công' : 'Khoản chi trả đã thanh toán',
      description: `Khoản chi kỳ ${period}: ${coins(payload.amountCoins)} xu (${coins(payload.amountCoins)} VND) đã ${simulated ? 'được thanh toán giả lập. Không có chuyển khoản ngân hàng thực tế.' : 'được ghi nhận thanh toán.'}`,
    },
    'monthly-payout.Failed': {
      ...author,
      title: simulated ? 'Chi trả giả lập chưa thành công' : 'Chi trả chưa thành công',
      description: `Khoản chi kỳ ${period}, ${coins(payload.amountCoins)} xu, vẫn chờ xử lý. Vui lòng kiểm tra ngân hàng nhận hoặc liên hệ hỗ trợ. Hệ thống không trích thêm xu khi thử lại.${simulated ? ' Đây là kết quả giả lập, không có chuyển khoản thực tế.' : ''}`,
    },
  }
  return notices[item.eventType] ?? null
}
