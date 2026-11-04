# Sequence mua quyền đọc chương — một trang

- [File draw.io](chapter-purchase-sequence.drawio)
- [Ảnh PNG](chapter-purchase-sequence.png)

Chỉ mô tả một lần người đọc bấm mua chương (POST unlock). Tiền điều kiện: đã đăng nhập và giao diện đã có báo giá. Không mở rộng GET quote, đăng nhập, catalog, tải nội dung hoặc Payouts.

Backend là cột gộp ReaderUnlockRouter, reader-unlocks.js, owner-write.js, unlock-revenue.js, unlock-purchase.js và unlock-wallets.js. Các thao tác kiểm tra tài khoản/nội dung/chính sách được gộp; các model ghi dữ liệu mua được vẽ riêng. Cụ thể, Wallet có một lifeline nhưng nhận 5 lệnh: trừ reader, upsert và cộng tác giả, upsert và cộng nền tảng. Ba ví cùng model/collection, khác ownerId/purpose.

Hai khung alt chính: đã có quyền/miễn phí so với mua mới; không đủ xu so với đủ xu. Đọc từ trên xuống theo số bước. Các lỗi kiểm tra được gộp trong chú thích rollback. Các phản hồi model không ảnh hưởng quyết định và một số chi tiết kiểm tra số nguyên/giới hạn/phiên bản được lược khỏi hình để dễ đọc; code vẫn xử lý các điều kiện đó.

Một lỗi ghi bất kỳ ngăn các bước tiếp theo và abort toàn bộ transaction. status=committed của UnlockRequest không phải commit MongoDB. API chỉ thành công sau khi transaction commit. LedgerEntry và RevenueAllocation không trừ/cộng tiền lần nữa. Tỷ lệ 70/30 chỉ là ví dụ, tỷ lệ thật đọc từ chính sách hoặc thỏa thuận tác giả.

Đối chiếu source ngày 04/11/2026: routes/reader-unlocks.routes.js; modules/reader-unlocks.js; modules/reading/owner-write.js; db/connection.js; modules/unlock-revenue.js; modules/unlock-purchase.js; modules/unlock-wallets.js.
