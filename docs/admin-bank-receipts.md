# Đối soát nạp xu

Admin mở `/admin/bank-receipts` từ mục Đối soát nạp xu trong sidebar hiện có. API private/no-store, bắt buộc Admin; mọi ghi có Origin hợp lệ và kiểm tra lại quyền Admin trong transaction.

Danh sách phân trang 20 dòng có hai nhóm chưa xử lý/đã xử lý, bao gồm giao dịch không khớp, sai số tiền, hết hạn và mã của hóa đơn đã thanh toán. Nội dung, mã và trạng thái ngân hàng ban đầu luôn được giữ nguyên.

Admin nhập mã tài khoản nhận, lý do/bằng chứng đối chiếu và đánh dấu xác nhận. Số xu là toàn bộ giá trị receipt theo 1 VND = 1 xu, không nhận số tiền tùy ý từ frontend. Chỉ receipt đã xác thực API key và chưa cộng xu mới đủ điều kiện; chủ ví nhận phải active. Điều chỉnh append-only, thay đổi số dư theo CAS, đánh dấu resolved và audit cùng một transaction. Receipt xử lý lại cùng người nhận/lý do/Admin trả kết quả cũ; nội dung khác hoặc hai người nhận tranh cùng receipt chỉ một bên thành công. Audit lỗi rollback toàn bộ.

Đây là gán khoản tiền ngân hàng cho người dùng bằng điều chỉnh. Không đổi hóa đơn gốc thành paid, không sửa snapshot gói hay thời hạn, không sửa nội dung/giá trị receipt. Một khoản đã được webhook matched không thể được cộng lại qua trang này. Giao dịch legacy chưa xác thực không được cộng. Trường hợp cần hoàn tiền ngân hàng bên ngoài chưa có thao tác tự động.

Frontend không báo thành công cục bộ; đọc lại danh sách sau API thành công. Lỗi ghi giữ nguyên input và yêu cầu đóng/tải lại để lấy baseline mới. Kiểm thử backend gồm quyền, CSRF, stale version, replay, tranh người nhận, audit rollback và bằng chứng legacy; kiểm thử frontend gồm xác nhận người nhận, payload/version, lỗi và đọc lịch sử.

Không thay đổi schema, không gọi ngân hàng thật. Media/AI tiếp tục nằm ngoài phạm vi. Phần thời hạn claim và settlement của A-UC-05 vẫn đang triển khai.
