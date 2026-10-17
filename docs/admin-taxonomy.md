# Quản lý thể loại thật của Admin

Kiểm chứng 18/10/2026, phần quản lý thể loại trong A-UC-03. Không thay schema hoặc file route thể loại cũ đang có chỉnh sửa của chủ dự án.

## Hành vi

Trang `/admin/categories` đọc MongoDB qua `/api/admin/taxonomy/categories`, có tìm tên, lọc active/retired, phân trang và số truyện tham chiếu thật. Tạo thể loại, sửa tên/thứ tự hiển thị và đổi trạng thái đều cần lý do; cập nhật cần expectedVersion. Tên chuẩn hóa NFC, chữ thường để kiểm tra trùng; tìm kiếm xử lý ký tự regex như văn bản.

Ngừng dùng không xóa thể loại hoặc sửa categoryIds/revision của truyện cũ. Thể loại retired không xuất hiện trong danh sách công khai và không được chọn cho truyện mới; các điều kiện gửi/phát hành vẫn kiểm tra active như trước. Khôi phục trả thể loại về active. Đây không phải thao tác xóa vật lý hay viết lại snapshot công khai.

Mỗi ghi chạy trong transaction với khóa account/quyền Admin, version và audit. Hai cập nhật đồng thời cùng baseline chỉ một thắng; audit thất bại rollback toàn bộ. Response lưu được kiểm tra ID và phiên bản trước khi đóng form, lỗi giữ dữ liệu đang nhập. Không còn thể loại/số đọc/thẻ mẫu hoặc thông báo lưu/chạy job giả trên trang này. Các tab thẻ, xếp hạng nội dung và vòng đời chưa có nghiệp vụ máy chủ được ghi rõ chưa triển khai.

## Kiểm chứng

- 9 test backend taxonomy/catalogue đạt: tạo/sửa/ngừng dùng/khôi phục, tham chiếu truyện không đổi, duplicate/version/concurrency/rollback, quyền và Origin.
- 3 test frontend đạt: số liệu thật, lọc máy chủ, lưu đúng version/lý do, giữ form lỗi và không đưa dữ liệu mẫu vào nhóm chưa hỗ trợ.
- Lint, i18n 1.766 khóa, build và Prettier đạt.
- Browser MongoDB tạm: tạo thể loại, ngừng dùng và reload vẫn đọc đúng retired. Sáng/tối 390/768/1024/1536px không tràn ngang; console không warn/error. Không thay dữ liệu database nhóm.

## Phạm vi A-UC-01–05 còn lại

A-UC-01 có danh bạ và khóa/mở Author, còn đóng/ẩn danh tài khoản gắn nghĩa vụ tài chính. A-UC-02 đã có cấp, thu hồi và xin cấp lại, giữ lịch sử và bảo vệ tài khoản không đủ điều kiện. A-UC-03 còn nhánh Admin xử lý trực tiếp nội dung của former Author theo exception, không đồng nhất với CRUD thể loại. A-UC-04 có tra cứu audit thật. A-UC-05 đã có cấu hình/lịch sử policy và tỷ lệ doanh thu, còn áp dụng thời hạn/snapshot vào các nghiệp vụ giao dịch tương ứng. Media và AI đều tạm hoãn, không làm giảm mức độ của phần ngoài media/AI.
