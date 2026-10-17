# Gửi duyệt và tạo bản sửa của Author

Checkpoint: 17/10/2026. Không thay đổi model/schema backend.

## API đã triển khai

| Endpoint | Hành vi |
| --- | --- |
| GET /author/submissions?page=1 | 10 gói/trang theo chủ sở hữu; trạng thái, phiên bản, bằng chứng, phản hồi và lịch sử đã lưu. |
| GET /author/submissions/prepare?storyId=…&chapterId=… | Kiểm tra đúng bản nháp, phiên bản và điều kiện gửi. Bỏ chapterId để kiểm tra thông tin truyện. |
| POST /author/submissions | Gửi storyId, chapterId nếu có, revisionId và expectedVersion từ prepare. Gói truyện cần rights; chương văn bản kế thừa quyền truyện; chương có ảnh cần rights và imageManifestDigest. |
| POST /author/submissions/:id/revise | Gửi expectedVersion của submission để tạo bản nháp sửa từ kết quả rejected hoặc revision-requested. |
| GET /author/submissions/:id/package | Đọc gói bất biến của đúng chủ, kiểm tra digest và trả nội dung/quyền của lần gửi đó. |
| GET /author/submissions/:id/media/:mediaId/content | Đọc ảnh riêng đúng manifest gói, đối chiếu checksum/dung lượng, không thay bằng ảnh thư viện mới. |

Mọi API yêu cầu Author đang hoạt động và chỉ đọc/ghi nội dung thuộc tài khoản. Request ghi dùng kiểm tra Origin hiện có. Giao dịch kiểm tra lại role, authorizationEpoch và credentialVersion, không chỉ dựa vào menu frontend.

## Gói gửi bất biến

- Server xác thực story-v1 và blocks-v1/v2/v3, thể loại, trạng thái chỉnh sửa và quyền truyện cha. Rich-text giữ AST; chương có ảnh kiểm tra bytes/metadata/manifest theo revision. Ảnh bìa/banner chưa hỗ trợ vẫn bị chặn.
- Rights gồm basis original/licensed, asserted=true và sourceLicenceNote. Truyện và chương có ảnh tạo khai báo riêng bất biến theo revision; chương văn bản kế thừa quyền truyện. Chương có ảnh cần digest chính xác và ghi chú bắt buộc nếu licensed. Xem `author-chapter-images.md`.
- Một transaction lưu revision đóng băng, RightsDeclaration nếu cần, PublicationSubmission, EvidenceBatch, audit và ModerationHistory. Lỗi ghi cuối giao dịch rollback toàn bộ.
- Gửi lại cùng revision và cùng quyền trả lại gói đã có; không nhân đôi gói/quyền/lô bằng chứng. Khai báo quyền khác với gói cũ bị từ chối. Hai yêu cầu đồng thời được tuần tự hóa theo Author.
- Gói mới ở validated, lô bằng chứng ở pending. Đây là trạng thái chờ xử lý, không phải đã duyệt, đã phân công kiểm duyệt viên hay đã công khai. PublishedRevisionId đang phục vụ độc giả được giữ nguyên.

## Phản hồi và bản sửa

- Kết quả xét duyệt được đọc từ database; phần này chưa cung cấp API quyết định của Moderator. Các kết quả trong test được tạo bằng fixture trên MongoDB tạm.
- Chỉ kết quả rejected/revision-requested của đúng gói hiện tại mới mở vòng sửa. Kết quả cũ, phiên bản stale, nội dung đã chuyển vòng, truyện archived hoặc quyền Author hết hiệu lực bị chặn.
- Tạo ContentRevision editable mới, parentRevisionId trỏ revision đã xét. Nội dung, chữ ký quyền, digest và lịch sử của gói cũ không bị sửa hoặc tái sử dụng làm chữ ký cho bản mới.
- Gửi lại dùng quy trình prepare/submit và tạo gói, bằng chứng cùng khai báo quyền mới cho truyện. Gửi lặp thao tác tạo bản sửa ngay sau thành công trả cùng revision; không tạo thêm bản sao.
- Editor lưu bản nháp thành công trước khi mở đúng storyId/chapterId gửi duyệt. Lỗi lưu hoặc gửi giữ dữ liệu nhập; không hiển thị thành công giả.
- Lịch sử có liên kết xem đúng gói cũ, không mở nhầm bản nháp đang sửa. Nội dung, khai báo quyền và ảnh được đọc theo submission; xem `author-submitted-package.md`.

## Giới hạn còn lại

Theo yêu cầu ngày 17/10/2026, worker bằng chứng AI (embedding/comparison/LLM) của **UC-AUT-09 trong bảng tiến độ** được tạm hoãn, không tính vào phạm vi cần hoàn thiện hiện tại. Đây là phần chưa triển khai, không được ghi nhận là đã hoàn thành. Bảng tiến độ dùng mã nội bộ; mục gửi kiểm duyệt tương ứng UC-AUT-10 trong tài liệu use case gốc.

Phần còn lại trong phạm vi là quyết định kiểm duyệt và nghiệm thu luồng gửi tổng thể. Các lô bằng chứng hiện có vẫn phản ánh trạng thái thật; không giả lập kết quả AI, tự duyệt hoặc bỏ qua kiểm tra phát hành. Ảnh minh họa đã duyệt, phát hành chương miễn phí theo thứ tự/lịch đã có trong các tài liệu chức năng liên quan. Phát hành trả phí và bìa/banner vẫn là hạng mục riêng. Nhập tài liệu thành chương nháp đã có trong `author-document-import.md`.

Kiểm thử bao gồm quyền sở hữu, stale version, gửi đồng thời, rollback, quyền bất biến, snapshot công khai, tạo bản sửa và gửi vòng mới. Lượt kiểm tra trình duyệt trước khi pause đã gửi thật trên MongoDB tạm và thấy gói/lịch sử pending; không ghi dữ liệu thử vào MongoDB đang dùng.
