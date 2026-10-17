# Phát hành thông tin truyện sau phê duyệt

Checkpoint: 17/10/2026. Không đổi model/schema backend.

## Phạm vi

Author chủ động phát hành thông tin truyện đã duyệt từ trang quản lý. Chỉ metadata trở thành công khai; chương, audio, lịch phát hành và early access được xử lý riêng. Không tự duyệt hoặc tự tạo bằng chứng AI.

Thông tin cập nhật của truyện đang công khai cũng có thể được phát hành khi revision mới đã duyệt. Bản công khai cũ tiếp tục được đọc theo publishedRevisionId cho tới khi tác giả xác nhận phát hành bản mới. Bản nháp chưa duyệt không thay thế nội dung công khai.

## API và điều kiện

- `GET /api/author/stories/:storyId/release` trả target (storyId, revisionId, submissionId, version, title), checklist và ready từ dữ liệu thật.
- `POST /api/author/stories/:storyId/release` nhận đúng revisionId/submissionId/expectedVersion. Không nhận trạng thái duyệt hoặc dữ liệu metadata tùy ý từ trình duyệt.
- Kiểm tra chủ sở hữu, Author còn hoạt động, Story không bị khóa, đúng current/draft revision bất biến, submission approved, revision approved/immutable và package/rights/media digest toàn vẹn.
- EvidenceBatch phải khớp gói/revision/submission và đã tới available-for-human-review ở bước llm, hoặc failed có failedStage hợp lệ để quyết định thủ công. Dù bằng chứng đã xong hay thất bại, submission và revision vẫn bắt buộc được phê duyệt. Các trạng thái đang xử lý không đủ điều kiện.
- RightsDeclaration còn asserted, các thể loại snapshot còn active và không có bìa/banner chưa được hỗ trợ.
- Transaction khóa account, kiểm tra lại trạng thái/phiên bản, pin phiên bản submission và quyền, cập nhật publishedRevisionId rồi ghi publicationTransition/AuditEvent. Lỗi audit rollback cả published pointer và các pin. Gửi lặp cùng gói trả kết quả cũ, không đổi ngày phát hành hoặc tạo audit trùng.
- publishedAt của truyện giữ mốc công khai đầu tiên. Nội dung gửi và lịch sử xét duyệt không bị sửa.

## Giao diện và trường hợp rỗng

Workspace trả canReleaseMetadata cho đúng gói đã duyệt chưa phát hành. Nút **Phát hành thông tin truyện** mở hộp xác nhận, kiểm tra lại điều kiện và có liên kết xem gói. Lỗi stale/API giữ hộp thoại, không báo thành công. Sau khi lưu thành công, trang làm mới trạng thái và cung cấp liên kết truyện công khai.

Truyện có metadata công khai nhưng chưa có chương vẫn giữ bố cục trang độc giả. Nút đọc/nghe tạm khóa, không tạo URL chứa undefined; số trang hiển thị 0–0 và không gắn nhãn có bản đọc thử. Khi có chương, các liên kết hiện có vẫn trỏ đúng chương đầu tiên.

## Kiểm chứng và phần còn lại

- 17 test backend phát hành: approval/evidence gates, quyền, version, thể loại/quyền hết hiệu lực, digest sai, gửi đồng thời, rollback, sửa nháp tranh chấp và phát hành metadata cập nhật. 53 regression backend liên quan đã đạt.
- 71 test frontend liên quan bao phủ xác nhận thật, failed gate/stale/error, cờ workspace, editor/preview và trạng thái trang độc giả chưa có chương. Một kiểm thử editor được sửa để đợi DOM rich-text hoàn tất thay vì đọc trước hiệu ứng khởi tạo.
- Browser dùng MongoDB tạm: xác nhận phát hành, publishedRevisionId khớp gói và catalog trả đúng metadata với 0 chương. Đã kiểm tra modal ở 390/768/1024px và desktop, sáng/tối. Quyết định duyệt và terminal evidence trong fixture không phải API Moderator hoặc xử lý AI thật.

Phát hành chương miễn phí theo thứ tự và phục vụ ảnh minh họa đã được bổ sung; xem `author-chapter-release.md` và `author-published-images.md`. Lập lịch/due job và cấu hình early access cho bản nháp đã có; phát hành trả phí chưa hoàn thiện. Ngừng phát hành/công khai lại truyện được mô tả tại `author-story-unpublish.md`. Còn bìa/banner và tích hợp quyết định kiểm duyệt/bằng chứng. Các use case phát hành vẫn Một phần.
