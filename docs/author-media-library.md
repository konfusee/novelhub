# Thư viện ảnh riêng của tác giả

## Đã nối dữ liệu thật

- `GET /api/author/media`: phân trang 50 ảnh theo ID, chỉ ảnh của tác giả đang đăng nhập; tổng số và dung lượng được tính trong MongoDB trên toàn thư viện, không chỉ trang hiện tại.
- `POST /api/author/media?name=...&kind=image|cover|banner&storyId=...`: nhận binary ảnh, kiểm tra nội dung bằng sharp, chỉ PNG/JPEG/WebP tĩnh, tối đa 10 MB và 16 triệu điểm ảnh. Chuẩn hóa WebP, tự xoay theo ảnh gốc và loại metadata gốc.
- Metadata được lưu vào collection `mediaAssets` hiện có, không sửa model/schema. Bytes ảnh nằm trong `backend/uploads/media`, không nằm trong thư mục public. Tên/kích thước được suy ra từ storage key do máy chủ sinh; không trả đường dẫn lưu trữ ra API.
- `GET /api/author/media/:id/content`: yêu cầu tác giả sở hữu ảnh; kiểm tra dung lượng và checksum trước khi trả WebP, private/no-store. Không phải URL CDN công khai.
- `POST /api/author/media/:id/delete`: kiểm tra version, sở hữu, tham chiếu revision/bìa/khai báo quyền; chỉ ẩn ảnh chưa sử dụng. Giữ bản ghi, bytes và audit; chưa có thao tác khôi phục trong sản phẩm.
- Ghi metadata và audit trong transaction. Nếu transaction thất bại, xóa tệp vừa ghi. Giới hạn xử lý ảnh đồng thời: một ảnh/tác giả và bốn ảnh/process.

## Giao diện

Giữ shell, thẻ ảnh, bộ lọc, lưới/danh sách và bảng chi tiết. Thay mock assets, quota giả, ngày tải/MIME giả bằng API và ảnh thật. Có tải tệp/kéo thả, trạng thái đang xử lý, lỗi xóa trong hộp thoại, tải thêm, thống kê thật và thông báo ảnh không khả dụng. Bộ lọc/tìm kiếm áp dụng trên các trang đã tải, có chú thích rõ. Gán truyện lúc tải ảnh là sắp xếp thư viện, chưa đưa ảnh vào nội dung xuất bản.

## Kiểm chứng

- 6 kiểm thử backend trên MongoDB replica set tạm: lưu/đọc ảnh thật, quyền/CSRF, loại/giới hạn tệp, rollback và dọn tệp, stale version và tham chiếu, soft delete, checksum và phân trang.
- 5 kiểm thử UI: dữ liệu/ảnh/MIME/ngày/tổng thực, upload binary và làm mới, lỗi xóa giữ dữ liệu, phân trang, lỗi mạng và trạng thái rỗng.
- Browser trên database tạm riêng: tải PNG từ giao diện thành WebP, hai ảnh mở được, tổng dung lượng thay đổi; kiểm tra 390/768/1024px và màn hình mặc định, sáng/tối, không tràn ngang; console không có error/warn trong luồng đã kiểm tra.
- Không nạp ảnh thử vào database đang dùng của chủ dự án. Ảnh kiểm chứng ở thư mục outputs của workspace, không commit fixture/dữ liệu tạm.

## Phạm vi còn lại

Chưa gắn ảnh vào AST chương hoặc gói gửi duyệt, chưa xuất bản ảnh ra public, chưa có audio/object storage adapter. AUT-06 vẫn Một phần. Cần lưu bền thư mục uploads cùng backup MongoDB khi triển khai. Tiến trình bị tắt đột ngột giữa ghi tệp và commit DB có thể để lại tệp mồ côi; chưa có tác vụ dọn mồ côi. Dung lượng UI là tổng ảnh available, không bao gồm bytes giữ lại cho lịch sử đã xóa.

## Sắp xếp ảnh theo truyện

`POST /api/author/media/organize` nhận `storyId` (hoặc null để bỏ nhóm) và 1–100 cặp `id/expectedVersion` không trùng. Máy chủ kiểm tra toàn bộ quyền sở hữu, phiên bản, ảnh chưa dùng và truyện nguồn/đích còn chỉnh sửa được; thay đổi và audit nằm trong một transaction. Một ảnh lỗi thì cả nhóm giữ nguyên. Không sửa schema, không đổi nội dung revision hay tự gắn ảnh bìa xuất bản.

Nút Sắp xếp hàng loạt dùng đúng danh sách đã lọc và đã tải, hiển thị tên ảnh để xem lại trước khi lưu. Lỗi máy chủ giữ nguyên hộp thoại và lựa chọn; giao diện chỉ cập nhật sau khi API chấp nhận. Khi các ảnh cùng thuộc một truyện thì chọn sẵn truyện đó. Không dùng cập nhật mảng giả trong frontend.

Kiểm chứng mở rộng: 9 kiểm thử backend và 7 kiểm thử UI đạt. Browser gán ảnh vào truyện trên MongoDB tạm, reload vẫn đúng truyện; hộp thoại và danh sách chọn truyện hoạt động trên màn hình 390px.
