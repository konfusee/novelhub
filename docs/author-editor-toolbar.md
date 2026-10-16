# Thanh công cụ editor văn bản thuần

Commit `e4c9208` sửa lỗi các nút in đậm/nghiêng/gạch chân/tiêu đề/trích dẫn/ảnh chèn Markdown hoặc HTML trong khi editor hiện tại chỉ lưu paragraph và kiểm tra gửi duyệt không chấp nhận mã định dạng này. Các nút vẫn nằm trong thanh công cụ nhưng bị vô hiệu, có chú thích và mô tả truy cập nêu giới hạn. Không sửa nội dung đã lưu hay loại bỏ ký tự tác giả đã nhập.

Ngắt cảnh, hội thoại và đề cập tiếp tục hoạt động dưới dạng văn bản thuần; lưu thủ công và phím tắt vẫn dùng API/version hiện có. Không thay schema, API, shell hoặc dependencies. Chưa triển khai rich-text AST, ảnh hay gạch chân; UC-AUT-04 vẫn Một phần.

Kiểm tra ngày 16/10/2026: 9 test editor đạt, gồm nút chưa hỗ trợ không thay nội dung hoặc làm dirty, thao tác văn bản thuần lưu đúng paragraphs và hồi quy lưu dài/version/gửi duyệt. Lint frontend, i18n 1.187 khóa, build và Prettier đạt. Browser trên MongoDB tạm đã chèn ngắt cảnh bằng bàn phím, lưu, reload thấy nội dung giữ nguyên; kiểm tra light/dark, 390/768/1024 px không tràn ngang, console không warn/error trong lượt kiểm tra cuối. Dữ liệu nhóm không nhận fixture thử.
