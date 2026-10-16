# Lịch sử thanh toán và phiếu của Author

Commit chức năng: `8e5e236`. Sửa phân trang lịch sử ví khi quay lại bộ lọc cũ: `6aea15e`. Các test frontend tiếp tục nằm trong `frontend/test`, tách khỏi mã ứng dụng.

Trang Doanh thu bổ sung lịch sử khoản thanh toán hệ thống đã ghi nhận, lọc tháng qua nút **Lọc kỳ**, xem tất cả kỳ, làm mới và phân trang 20 bản ghi. Chi tiết tải qua API khi mở hộp thoại. Phiếu có số tiền VND chỉ xuất hiện khi kết quả Paid đủ điều kiện; danh sách và thông tin khoản chờ vẫn dùng xu. Thời gian hiển thị theo giờ Việt Nam.

## Nguồn và điều kiện hiển thị

`GET /author/payouts` nhận period YYYY-MM tùy chọn, limit 1–50 và cursor. Cursor giữ evaluatedAt/ID, ràng buộc kỳ đang lọc; sắp xếp giảm dần với ID làm khóa phụ. Đổi kỳ hoặc làm mới đưa UI về trang đầu. `GET /author/payouts/:id` trả khoản thuộc đúng tài khoản và ví author-earnings đang sở hữu; sai chủ/ví hoặc không tìm thấy trả 404, ID sai trả 400. Cả hai endpoint yêu cầu phiên đăng nhập và quyền Author đang hoạt động. Không cung cấp endpoint Author yêu cầu rút tiền thủ công.

Nguồn là WithdrawalRequest, PayoutSheetRow và PayoutResultEntry hiện có. Không dự đoán Paid từ số dư hoặc ledger debit. Chỉ trả state paid và slip khi request ở paid, có kết quả Paid không ở tương lai, bảng kê khớp request/kỳ/số xu và payoutSlipAmountVnd bằng amountCoins. Thiếu/lệch nguồn hoặc request còn pending nhưng có Paid result trả unavailable và không có phiếu. Failed vẫn là khoản pending chờ xử lý lại, không hoàn xu hoặc thay đổi số dư qua màn hình này.

DTO không trả bank snapshots, corrected bank snapshots, transferReference, ghi chú/actor quản trị hoặc policy snapshot. Phiếu chỉ chứa ID khoản của chính Author, kỳ, số tiền đã lưu và thời gian Paid. Quy tắc nguồn xem `decision-log.md`, quyết định 4 và phần monthly withdrawal identity. Không sửa model/schema; không tạo giao dịch, kết quả thanh toán, email hoặc finance engine mới.

## Kiểm chứng ngày 16/10/2026

- 16 test backend liên quan đạt: Paid hợp lệ và bảo mật DTO, Failed không đổi request/số dư, thiếu Paid/bảng kê, lệch số tiền/kỳ, pending có Paid, kết quả tương lai, sở hữu tài khoản/ví, role/ID, cursor/period/limit và hồi quy ledger/thu nhập.
- 13 test frontend liên quan đạt: chỉ hiện VND trong phiếu đủ điều kiện, không hiện phiếu cho pending/failed/unavailable, tải chi tiết, empty/error/retry, làm mới trạng thái chỉ đọc, áp dụng/xóa tháng, giữ ô nhập và reset cursor khi quay lại bộ lọc cũ.
- Lint hai workspace, i18n 1.259 khóa, build frontend, icons, Prettier và diff check đạt. Không thay schema.
- Browser dùng MongoDB replica set tạm với ba khoản pending/failed/paid: xem đủ trạng thái, lọc tháng và xóa bộ lọc, làm mới, bàn phím mở chi tiết, Paid reload vẫn đọc đúng phiếu. Kiểm tra light/dark, 390/768/1024 px không tràn ngang; thẻ sạch của bản cuối không có warn/error. Dữ liệu/ngân hàng/giao dịch thử không ghi vào database nhóm.

Workbook đã bổ sung bằng chứng và giữ các use case rộng Một phần. Còn job payout tháng, luồng Admin ghi kết quả/điều chỉnh, email phiếu, đối soát đầy đủ và quyền xem sau khi thu hồi Author/đóng tài khoản. Phiếu hiển thị tại trang, chưa có xuất PDF/tải file riêng. Không coi việc đọc bản ghi là hoàn thiện vận hành chi trả.
