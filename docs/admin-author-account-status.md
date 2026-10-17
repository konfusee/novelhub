# Khóa và mở lại tài khoản Author

Ngày kiểm chứng: 18/10/2026. Đây là phần suspend/restore của A-UC-01; chưa bao gồm đóng/xóa tài khoản và quyết toán cuối cùng. Media và AI không thuộc tiêu chí hoàn thiện hiện tại.

## API và bảo vệ dữ liệu

`POST /api/admin/accounts/:accountId/status` nhận `{ action: 'suspend' | 'restore', expectedVersion, reason }`. Chỉ Admin đang hoạt động, phiên và quyền còn hiệu lực mới được thực hiện. Cần Origin hợp lệ, ID, version và lý do không rỗng. Chỉ áp dụng cho tài khoản đã từng là Author, không có quyền Admin/Moderator đang hoạt động; không tự thao tác trên tài khoản Admin hiện tại.

Transaction khóa account Admin, kiểm tra tài khoản đích và version/trạng thái, chuyển active ↔ suspended, tăng authorizationEpoch, thu hồi tất cả session đang hoạt động và ghi AuditEvent. Lỗi audit rollback cả trạng thái và session. Hai thao tác cùng baseline chỉ một thành công. Mở lại không làm sống lại phiên đăng nhập cũ; người dùng cần đăng nhập mới.

Danh mục công khai, thống kê/thể loại và đọc truyện qua published snapshot loại truyện của Author suspended; mở lại làm truyện đủ điều kiện xuất hiện trở lại. Không sửa Story/Chapter/revision/published pointer, không thu hồi quyền Author, không cập nhật wallet/ledger/payout. Khóa tài khoản khác với thu hồi vai trò Author: vai trò bị thu hồi có luồng đóng băng/hủy phần chưa phát hành riêng. Các job chưa phát hành vẫn phải kiểm tra quyền và trạng thái tài khoản khi chạy.

## Giao diện

Hồ sơ trong danh bạ Admin cung cấp nút khóa/mở lại theo trạng thái thật từ API, có hộp xác nhận và lý do bắt buộc. Phản hồi phải đúng ID/trạng thái/version mới được xem là thành công. Lỗi giữ lý do và yêu cầu tải lại trước khi thử tiếp. Thành công làm mới cả danh bạ và danh sách quyền Author, tránh hiển thị trạng thái cũ ở hai vùng khác nhau.

## Kiểm chứng

- 9 test trong nhóm trạng thái tài khoản/catalogue đạt; kiểm tra session, quyền, Origin, version, cạnh tranh, rollback, ẩn/hiện truyện và giữ revision/role.
- 20 test hồi quy danh bạ, rankings và thu hồi Author đạt.
- 7 test frontend dialog/danh bạ đạt; lint, i18n 1.728 khóa, build và Prettier đạt.
- Browser trên MongoDB tạm thực hiện khóa → đọc trạng thái suspended → mở lại → đọc active và hai audit. Sáng/tối, 390/768/1024/1536px không tràn ngang; ảnh xác nhận và mobile đã kiểm tra. Không nạp fixture vào database nhóm.

A-UC-01 vẫn Một phần vì còn vòng đóng tài khoản/ẩn danh và tài chính cuối cùng. Không đánh dấu toàn bộ nhóm Admin/Author hoàn tất từ riêng bước suspend/restore này.
