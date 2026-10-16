# Xem lại gói đã gửi của tác giả

Checkpoint: 17/10/2026. Không thay đổi model/schema backend.

Lịch sử gửi duyệt có liên kết **Xem gói đã gửi** tới `/author/submissions/:submissionId/preview`. Trang này đọc đúng revision bất biến của submission, không dùng draftRevisionId/currentRevisionId. Tác giả có thể xem lại nội dung và khai báo của vòng gửi cũ sau khi đã tạo/sửa bản nháp mới.

## API và kiểm tra toàn vẹn

- `GET /api/author/submissions/:submissionId/package`: chỉ Author sở hữu submission và truyện. Trả metadata truyện hoặc AST chương, quyền đã khai báo, manifest, số revision, ngày và trạng thái gói.
- Server kiểm tra revision/story/chapter/author, immutableAt, liên kết RightsDeclaration và quyền truyện cha, mediaDigest, rightsDigest và packageDigest. Gói thiếu hoặc sai dữ liệu trả lỗi, không lấy bản nháp mới hay dữ liệu mẫu thay thế. Các hàm digest dùng chung với bên gửi duyệt để giữ cùng hợp đồng v1/v2/v3.
- `GET /api/author/submissions/:submissionId/media/:mediaId/content`: chỉ ảnh nằm trong manifest của đúng gói. Kiểm tra lại quyền chủ sở hữu và bytes theo SHA-256/dung lượng trong manifest. Tệp bị thay bằng ảnh khác vẫn bị từ chối kể cả metadata thư viện đã đổi để khớp ảnh mới.
- Dữ liệu và ảnh là riêng tư, `Cache-Control: private, no-store`, ảnh dùng phiên đăng nhập và không lộ objectKey. Thiếu tệp hiển thị trạng thái không sẵn sàng; không thay ảnh khác. Đọc gói không ghi view/progress/unlock hoặc quyết định kiểm duyệt.
- Gói chương văn bản cũ kế thừa RightsDeclaration của truyện; chương có ảnh dùng khai báo riêng và liên kết quyền truyện cha đã đóng băng. Tiêu đề truyện của chương lấy từ revision cha gắn với khai báo đó.

## Giao diện và phạm vi

Tái sử dụng AuthorLayout, Card, Badge, ButtonLink và DraftReadingCanvas với cỡ chữ/giãn dòng/độ rộng đọc hiện có. Ảnh trong gói dùng endpoint ràng buộc submission; preview nháp và editor vẫn dùng endpoint ảnh riêng hiện tại. Trạng thái loading/lỗi/không tìm thấy có thông báo và thử lại cùng gói. Không có thao tác chỉnh sửa trực tiếp gói bất biến.

Đây là bản xem riêng cho Author, không cấp quyền xem cho Author khác, Reader, Moderator hoặc Admin. Việc xem không mở bỏ điều kiện bằng chứng AI, không cung cấp API quyết định Moderator và không phát hành ảnh công khai. Kết quả phản hồi trong kiểm thử là fixture trên database tạm.

## Kiểm chứng

- 53 test backend liên quan: đọc đúng gói truyện/chương v1/v2/v3, quyền sở hữu/role, gói lỗi, ảnh sai gói/mất tệp/bị thay bytes và giữ nội dung cũ sau vòng sửa.
- 51 test frontend liên quan: xem gói và ảnh đúng endpoint, giữ định dạng/escaped text, lỗi và thử lại đúng gói, cùng regression editor/nháp/preview/gửi duyệt.
- Lint, i18n, icon và build đạt. Browser trên MongoDB tạm xác nhận gói cũ có ảnh trong khi nháp mới đã bỏ ảnh; kiểm tra 390/768/1024px và desktop, sáng/tối, không tràn ngang trong các màn hình đã kiểm tra.

AUT-06/AUT-09 vẫn Một phần vì còn bằng chứng, quyết định kiểm duyệt và ảnh trong luồng phát hành công khai.
