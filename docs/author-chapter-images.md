# Ảnh riêng trong bản nháp chương

## Phạm vi hoàn thiện

Trong chế độ soạn có định dạng (`?mode=rich`), công cụ Hình ảnh mở thư viện thật của tác giả. Chọn ảnh thuộc truyện hiện tại hoặc chưa gán truyện, nhập mô tả ảnh bắt buộc và chú thích tùy chọn. Ảnh được thêm cuối chương; có thể sửa mô tả/chú thích, gỡ khỏi nháp và undo/redo. Tối đa 20 khối ảnh và tổng 1.000 khối mỗi chương. Thư viện mở ở tab mới để không bỏ bản thảo đang sửa.

Ảnh hiển thị trong trình soạn và bản xem trước riêng bằng API yêu cầu phiên đăng nhập. Tệp ảnh, đường dẫn lưu trữ và URL tùy ý không nằm trong AST. Preview giữ cùng thứ tự nội dung, định dạng chữ, mô tả và chú thích; không ghi lượt đọc hay tiến độ độc giả.

## Contract và dữ liệu

- Bản văn bản thuần và rich-text cũ giữ `blocks-v1` / `blocks-v2`. Không tự di trú dữ liệu.
- Bản có ảnh lưu `blocks-v3` trong ContentRevision hiện có, không sửa schema/model.
- Khối ảnh: `{ type: 'image', mediaId: '<ObjectId>', alt: 'Mô tả', caption: 'Chú thích' }`.
- `mediaIds` của revision phải trùng tập tham chiếu ảnh trong AST. Trình soạn từ chối đọc/lưu đè nguồn không nhất quán thay vì làm phẳng hoặc bỏ ảnh.
- GET rich trả đúng format và tài liệu; PUT/POST lưu AST và mediaIds trong cùng transaction. Bỏ hết ảnh tạo revision blocks-v2 mới, revision có ảnh cũ được giữ nguyên.
- Khi lưu, máy chủ kiểm tra Author/owner/story, trạng thái ảnh available/private/local, ảnh chưa gán truyện hoặc thuộc đúng truyện, bytes và checksum. Pin version MediaAsset và ghi audit cùng transaction; một tham chiếu lỗi làm rollback toàn bộ chương và các pin.
- Gắn ảnh và xóa ảnh dùng chung account lock. Không thể tạo chương trỏ tới ảnh đã xóa trong tranh chấp đồng thời. Library không cho xóa ảnh đã được bất kỳ revision lịch sử nào tham chiếu.
- Ảnh và chú thích không được tính là số từ văn bản truyện. Sửa chữ, heading hoặc inline marks vẫn giữ nguyên ảnh, kể cả khi trình duyệt bọc figure vào khối định dạng khác.

## Gửi duyệt còn thiếu

**blocks-v3 vẫn là bản nháp riêng, chưa được gửi duyệt/phát hành.** Checklist nhận diện nội dung hợp lệ nhưng media chưa hỗ trợ; POST gửi duyệt cũng từ chối, không tạo package. Còn khai báo quyền theo ảnh, đóng băng manifest/digest và phục vụ ảnh từ package đã duyệt. Không tự approve hay publish.

Checklist chương có ảnh dẫn đúng về editor có định dạng để xử lý ảnh. Các bản rich-text cũng được đưa về đúng chế độ soạn khi sửa nội dung; gói thông tin truyện giữ đường dẫn media riêng.

## Kiểm chứng

- 38 test backend liên quan: lưu/đọc/đổi phiên bản, quyền, sai truyện, thiếu/hỏng bytes, rollback audit, lịch sử media, manifest không khớp, tranh chấp gắn/xóa và chặn gửi duyệt.
- 42 test frontend liên quan: chọn ảnh, alt bắt buộc, lọc đúng truyện, giữ chữ đậm, lưu AST, preview, chú thích/gỡ/undo và đường dẫn sửa nhanh. Test nằm trong frontend/test.
- Browser trên MongoDB tạm: chọn ảnh từ thư viện, thêm mô tả/chú thích, lưu, reload, API đọc lại blocks-v3 và preview giữ ảnh/định dạng. Kiểm tra 390/768/1024px và desktop, sáng/tối; không tràn ngang trong các màn hình đã kiểm tra.
- Dữ liệu thử và ảnh minh họa kiểm thử không được nạp vào database chính. Giữ nguyên thay đổi ngoài phạm vi của chủ dự án.

AUT-04/AUT-06 vẫn Một phần do còn gói xuất bản có media.
