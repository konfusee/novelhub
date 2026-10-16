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
- Khi tạo/lưu revision có ảnh, `validation.mediaManifestVersion = chapter-images-v1` và `validation.mediaManifest` giữ mediaId, SHA-256, sizeBytes, contentType và storageProvider theo thứ tự xuất hiện đầu tiên trong AST. `mediaDigest` là SHA-256 của JSON manifest này; ảnh lặp chỉ có một mục. Không lưu objectKey hay URL vào manifest. Máy chủ đối chiếu bytes với metadata trong transaction và chỉ nhận WebP đã chuẩn hóa.
- Mỗi revision mới có manifest riêng. Đổi thứ tự ảnh đổi digest; bỏ hết ảnh tạo revision không mang manifest/digest cũ. Revision lịch sử không bị ghi đè. Đây là snapshot bản nháp, chưa phải bằng chứng quyền sử dụng hoặc package gửi duyệt đã đóng băng.
- Ảnh và chú thích không được tính là số từ văn bản truyện. Sửa chữ, heading hoặc inline marks vẫn giữ nguyên ảnh, kể cả khi trình duyệt bọc figure vào khối định dạng khác.

## Gửi duyệt chương có ảnh

Chương blocks-v3 có thể gửi duyệt khi truyện cha đã duyệt, quyền truyện cha còn hợp lệ và toàn bộ checklist đạt. Prepare kiểm tra lại bytes, metadata, thứ tự mediaIds và manifest/digest đã lưu. Nháp có ảnh trước khi có manifest cần lưu lại bằng editor.

Prepare trả `requiresRights: true` và `imageRights: {count, mediaDigest}`. POST cần `rights` (basis, asserted=true, sourceLicenceNote) và `imageManifestDigest` trùng bản chuẩn bị. Khai báo áp dụng cho toàn bộ nội dung chương và tập ảnh chính xác, không phải bằng chứng tải lên đồng nghĩa với có quyền. Nếu basis=licensed thì phải ghi nguồn/phạm vi cấp phép. Chương văn bản vẫn kế thừa quyền truyện cha và không nhận khai báo ảnh.

Transaction kiểm tra/pin ảnh lại, tạo RightsDeclaration riêng theo revision chương và đóng băng manifest, rightsDigest, mediaDigest, packageDigest cùng revision. validation lưu liên kết quyền truyện cha. Gửi lặp chỉ trả lại gói cũ khi khai báo và digest ảnh khớp; lỗi audit rollback pin/quyền/package/bằng chứng. Không sửa model/schema và không gán lại quyền trên MediaAsset tái sử dụng.

Gói ở validated, EvidenceBatch ở pending. Chưa có worker bằng chứng hoặc API quyết định kiểm duyệt trong phạm vi này. **Gửi duyệt không tự phê duyệt/phát hành; ảnh công khai từ package đã duyệt vẫn cần triển khai.** Ảnh bìa/banner còn bị chặn.

Sau reload, biểu mẫu đọc đúng khai báo bất biến từ máy chủ và khóa sửa. Khi có yêu cầu chỉnh sửa, tạo revision mới giữ AST/manifest nhưng bỏ chữ ký quyền/package cũ, mở đúng rich editor và yêu cầu xác nhận quyền mới khi gửi lại.

Checklist chương có ảnh dẫn đúng về editor có định dạng để xử lý ảnh. Các bản rich-text cũng được đưa về đúng chế độ soạn khi sửa nội dung; gói thông tin truyện giữ đường dẫn media riêng.

## Kiểm chứng

- 48 test backend liên quan: lưu/đọc/đổi phiên bản, quyền, sai truyện, thiếu/hỏng bytes, rollback audit, lịch sử media, manifest không khớp, tranh chấp gắn/xóa, gửi duyệt đồng thời và tạo bản sửa từ phản hồi.
- 47 test frontend liên quan: chọn ảnh, alt bắt buộc, lọc đúng truyện, giữ chữ đậm, lưu AST, preview, chú thích/gỡ/undo, đường dẫn sửa nhanh, giấy phép bắt buộc, xác nhận lại khi đổi revision và đọc quyền bất biến sau reload. Test nằm trong frontend/test.
- Browser trên MongoDB tạm: chọn ảnh từ thư viện, thêm mô tả/chú thích, lưu, reload, API đọc lại blocks-v3 và preview giữ ảnh/định dạng. Kiểm tra 390/768/1024px và desktop, sáng/tối; không tràn ngang trong các màn hình đã kiểm tra.
- Dữ liệu thử và ảnh minh họa kiểm thử không được nạp vào database chính. Giữ nguyên thay đổi ngoài phạm vi của chủ dự án.
- Browser gửi chương có ảnh qua backend thật/MongoDB tạm: gói validated, một manifest, khai báo quyền riêng, EvidenceBatch pending; mở lại trang vẫn hiển thị đúng giấy phép đã lưu và khóa sửa. Biểu mẫu kiểm tra sáng/tối, 390/768/1024px và desktop.
- Bổ sung test snapshot/digest, thứ tự và khử trùng ảnh, giữ manifest lịch sử, xóa manifest khi bỏ hết ảnh và rollback khi MIME metadata không đúng định dạng đã chuẩn hóa.

Gói chương có ảnh đã được nối tới phát hành miễn phí và trình đọc công khai, giữ manifest/checksum theo revision; xem `author-published-images.md`. AUT-04/AUT-06 vẫn Một phần do còn bìa/banner và vòng đời media xuất bản đầy đủ.
