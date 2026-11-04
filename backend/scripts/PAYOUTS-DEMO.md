# Dữ liệu demo chi trả tác giả

Chạy tại thư mục gốc:

```powershell
node backend/scripts/seed-payouts-demo.js
node backend/scripts/seed-payouts-demo.js --current-db --apply
```

Lệnh đầu xem trước; lệnh sau thêm vào database trong `backend/.env`.
Không chạy với NODE_ENV=production. Không sửa tài khoản cũ, chính sách chung,
không reset số dư khi chạy lại. Toàn bộ dữ liệu mới được tạo trong transaction,
có marker `novelhub-payouts-demo-v1` để chống tạo trùng.

Tạo admin `admin.payouts-demo@example.test` và 7 tác giả có tiền tố
`[DEMO PAYOUTS]`: rich, threshold, below, missing-bank, pending, failed, paid.
Email tác giả có dạng `rich.payouts-demo@example.test`.
Mật khẩu ngẫu nhiên nằm trong file Git bỏ qua:
`backend/.tmp/novelhub-payouts-demo-v1-<database>.credentials.json`.

Ba khoản chi ở tháng chạy seed: pending chưa thử, pending có một lần Failed,
paid có lịch sử Failed rồi Paid. Số dư tác giả còn lại sau khi lập chi được
ghi bằng adjustment để mô phỏng thu nhập mới. Các khoản xu ban đầu cũng có
ledger adjustment mang nhãn demo; tổng ledger khớp số dư ví.

Ngân hàng và số tài khoản đều là giả lập. Không gọi SePay, không chuyển tiền,
không gửi email. Script tạo fixture trực tiếp qua helper transaction nên không
cần chờ cuối tháng; API admin vẫn giữ kiểm tra chỉ lập danh sách cuối tháng.
Không mô phỏng doanh thu mua chương hoặc phân bổ cho platform.

Mở `/admin/payouts`, chọn kỳ tháng đã seed và trạng thái Tất cả.
Ngưỡng lấy từ chính sách hiện hành; không thay đổi chính sách để tạo demo.
Chạy lại giữ nguyên dữ liệu ngay cả khi admin đã xử lý các khoản demo.
