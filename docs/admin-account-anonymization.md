# Đóng và ẩn danh tài khoản Author

Kiểm chứng 18/10/2026, nhánh A-UC-01. Không thay schema hoặc xóa lịch sử giao dịch.

Admin chọn tài khoản trong danh bạ, bấm “Đóng và ẩn danh tài khoản”, đọc hậu quả, đánh dấu xác nhận và nhập lý do. API `/admin/accounts/:accountId/status` nhận `action: close`, version hiện tại và lý do. Chỉ áp dụng Author/cựu Author active hoặc suspended, không có quyền nhân viên; không tự đóng tài khoản Admin. Ghi cùng transaction và audit, chặn baseline cũ.

- Hồ sơ trở thành `Deleted user`, bỏ email đăng nhập, mật khẩu, hồ sơ và tùy chọn. Tăng phiên bản thông tin đăng nhập/quyền; thu hồi session, token email chưa dùng và role hiện hành.
- Đóng băng soạn thảo, ngừng công khai truyện, hủy chương chưa phát hành và submission đang chờ/chưa công khai với `account-deleted`. Claim được giải phóng và giữ lịch sử. Không xóa revision hay quyền mở khóa cũ.
- Xu Reader còn lại về 0 qua một ledger `deletion-forfeiture`. Không hoàn tiền. Thu nhập Author và withdrawal đang pending không bị ghi nợ lần nữa hay chuyển thành Paid.
- Chụp thông tin ngân hàng và giữ dữ liệu tài chính ở trường riêng tư. Nếu không còn thu nhập chưa chi trả và không có withdrawal pending, đóng tài chính ngay. Nếu còn nghĩa vụ, giữ email thanh toán riêng tư và chưa đặt `financiallyClosedAt`/`finalPayoutEvaluatedAt`.
- Danh mục loại tài khoản anonymized; bình luận hiển thị `Deleted user`.

## Kiểm chứng

4 kiểm thử backend chuyên biệt và 29 kiểm thử hồi quy tài khoản/quyền/danh mục/cộng đồng/workspace đạt. 8 kiểm thử UI danh bạ/hộp thoại đạt, bao gồm bắt buộc xác nhận và lý do. Lint, Prettier, i18n và build đạt. Trình duyệt kiểm tra hiển thị cảnh báo và nút bị khóa khi chưa xác nhận, sáng/tối ở 390/768/1024/1536. Không thực hiện đóng tài khoản bằng trình duyệt; giao dịch đóng được kiểm thử trên MongoDB tạm.

## Còn lại để hoàn tất A-UC-01

Luồng đánh giá cuối vào bảng chi trả tháng tiếp theo, sửa thông tin ngân hàng qua Admin và đóng tài chính sau khi tất cả khoản được ghi Paid chưa được triển khai trong nhánh này. Tài khoản còn nghĩa vụ được giữ ở trạng thái chưa đóng tài chính, không báo quyết toán thành công.
