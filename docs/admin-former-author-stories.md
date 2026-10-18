# Admin xử lý truyện của cựu Author

Kiểm chứng 18/10/2026. Nhánh ngoại lệ của A-UC-03, ngoài media và AI.

- `/admin/content` đọc danh sách từ MongoDB, mở thông tin công khai và hiệu chỉnh tên, mô tả, thể loại; có ngừng công khai/công khai lại và lý do bắt buộc.
- Máy chủ chỉ cho phép Admin còn hiệu lực xử lý truyện từng công khai của tài khoản active đã bị thu hồi Author, không có quyền Author active và đang đóng băng soạn thảo. Không mở lại quyền soạn thảo.
- Mỗi lần ghi kiểm tra version và published revision, khóa giao dịch với tài khoản quản trị/chủ truyện, kiểm tra gói duyệt gốc và khai báo quyền. Thể loại phải active khi công khai; vẫn cho phép ẩn truyện có thể loại đã ngừng hoạt động.
- Hiệu chỉnh tạo revision immutable mới với digest và nguồn gốc gói duyệt/khai báo quyền ban đầu. Không sửa revision cũ, khai báo quyền gốc, bản nháp riêng, chương hoặc số dư. Đây là ngoại lệ quản trị metadata; không phải cấp quyền duyệt thông thường cho Admin.
- Audit cùng giao dịch; lỗi audit hoàn tác nội dung. Ghi đồng thời trên cùng baseline chỉ một yêu cầu thành công. Gói hiệu chỉnh sai digest bị từ chối.

## Kiểm chứng

4 kiểm thử backend chuyên biệt, 41 kiểm thử hồi quy thu hồi quyền/xuất bản/catalogue và 3 kiểm thử giao diện đạt. Lint các file thay đổi, Prettier, i18n và build frontend đạt. Kiểm tra trình duyệt trên DB tạm: lưu metadata, trang độc giả hiển thị tên mới, ngừng công khai phản ánh trong danh sách. Bố cục không tràn trang ở 390/768/1024/1536, sáng và tối.

## Phần còn lại

A-UC-01 còn đóng/ẩn danh tài khoản gắn nghĩa vụ tài chính. A-UC-05 còn áp dụng snapshot/thời hạn policy vào luồng giao dịch thực tế. Không đánh dấu hai use case này hoàn thiện từ nhánh quản trị nội dung.
