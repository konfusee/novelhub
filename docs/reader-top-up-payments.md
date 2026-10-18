# Xác nhận nạp xu từ ngân hàng

API hóa đơn `/api/reader/top-up-orders` lưu gói và thời hạn policy tại thời điểm tạo. Tạo hóa đơn không cộng xu. Không thay đổi schema backend.

## Webhook

`POST /api/webhooks/sepay` nhận JSON, xác thực `Authorization: Apikey <key>` bằng so sánh digest constant-time. Cấu hình đồng thời `SEPAY_WEBHOOK_API_KEY` (32–256 ký tự) và `SEPAY_ACCOUNT_NUMBER` trong môi trường backend. Để trống cả hai thì endpoint trả 503; cấu hình thiếu một biến làm server từ chối khởi động. Không sửa `.env` đang sử dụng và không tự đăng ký webhook bên ngoài.

Trên SePay chọn API Key, tài khoản nhận tiền tương ứng, sự kiện tiền vào và URL HTTPS của endpoint. Contract payload/response theo [tài liệu tích hợp](https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook) và [xác thực chính thức](https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc). Body cần `id`, `accountNumber`, `transferType`, `transferAmount`, `content`; các trường bổ sung của nhà cung cấp được bỏ qua. ID/số tiền là số nguyên dương an toàn. Tiền ra được xác nhận đã nhận nhưng không tạo khoản nạp.

Mã thanh toán lấy từ nội dung gốc: đúng một mã `NH` + 8 số, có ranh giới chữ/số. Nội dung mơ hồ không được tự động khớp. Không tin mã gói, số xu hay trạng thái do trình duyệt gửi.

## Bất biến tài chính

- Chỉ cộng xu khi đúng tài khoản ngân hàng, hóa đơn pending còn hạn tại thời điểm server xử lý, đúng số tiền snapshot và chủ ví còn active.
- Mã giao dịch SePay unique chống gửi lại; cùng ID nhưng đổi nội dung/số tiền trả 409.
- Receipt, paid invoice, credit ví, ledger và audit cùng transaction. Audit lỗi rollback toàn bộ; gửi lại có thể xử lý sạch.
- Khóa tài khoản và CAS version ví/hóa đơn bảo vệ các receipt khác nhau đến đồng thời, cũng như đóng/khóa tài khoản đồng thời.
- `topup-credit` lưu scope theo chủ sở hữu + hóa đơn. Gửi lại không cộng thêm; receipt khác trả vào hóa đơn đã trả tiền được lưu `already-paid`.
- Sai số tiền, hết hạn, mã không khớp hoặc chủ tài khoản ngừng hoạt động vẫn lưu BankTransaction để đối soát, không cộng xu. Không tự áp dụng lại receipt unmatched khi tài khoản được mở lại.
- Gói/policy mới không làm thay đổi số xu hay hạn của hóa đơn đã tạo. Không dùng thời gian trong payload để vượt hạn.

## Kiểm tra và phần còn lại

Kiểm thử dùng MongoDB replica set tạm: concurrent replay, hai receipt tranh một hóa đơn, mismatch/ambiguous code, expiry/inactive account, audit rollback, auth/config và số tiền không hợp lệ. Không gọi ngân hàng hoặc cộng xu vào database dùng chung.

A-UC-05 vẫn chưa hoàn thiện toàn bộ: còn nối giao diện ví vào hóa đơn/xác nhận thực, giao diện Admin xử lý receipt ngoại lệ, policy thời hạn claim và phân bổ doanh thu khi mở khóa. Media/AI nằm ngoài phạm vi nghiệm thu.
