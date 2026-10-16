# Gửi duyệt và tạo bản sửa của Author

Checkpoint: 16/10/2026. Không thay đổi model/schema backend.

## API đã triển khai

| Endpoint | Hành vi |
| --- | --- |
| GET /author/submissions?page=1 | 10 gói/trang theo chủ sở hữu; trạng thái, phiên bản, bằng chứng, phản hồi và lịch sử đã lưu. |
| GET /author/submissions/prepare?storyId=…&chapterId=… | Kiểm tra đúng bản nháp, phiên bản và điều kiện gửi. Bỏ chapterId để kiểm tra thông tin truyện. |
| POST /author/submissions | Gửi storyId, chapterId nếu có, revisionId và expectedVersion lấy từ prepare. Gói truyện bắt buộc có rights; gói chương không nhận rights mới. |
| POST /author/submissions/:id/revise | Gửi expectedVersion của submission để tạo bản nháp sửa từ kết quả rejected hoặc revision-requested. |

Mọi API yêu cầu Author đang hoạt động và chỉ đọc/ghi nội dung thuộc tài khoản. Request ghi dùng kiểm tra Origin hiện có. Giao dịch kiểm tra lại role, authorizationEpoch và credentialVersion, không chỉ dựa vào menu frontend.

## Gói gửi bất biến

- Server xác thực story-v1 hoặc blocks-v1, đoạn văn thuần, thể loại đang hoạt động, trạng thái chỉnh sửa và quyền truyện cha. Gói chứa media chưa có adapter đóng băng bị chặn rõ ràng.
- Rights của truyện gồm basis original/licensed, asserted=true và sourceLicenceNote tùy chọn. Khi gửi, facts được khóa cùng revision và digest. Chương chỉ dùng khai báo bất biến của phiên bản truyện đã duyệt.
- Một transaction lưu revision đóng băng, RightsDeclaration nếu cần, PublicationSubmission, EvidenceBatch, audit và ModerationHistory. Lỗi ghi cuối giao dịch rollback toàn bộ.
- Gửi lại cùng revision và cùng quyền trả lại gói đã có; không nhân đôi gói/quyền/lô bằng chứng. Khai báo quyền khác với gói cũ bị từ chối. Hai yêu cầu đồng thời được tuần tự hóa theo Author.
- Gói mới ở validated, lô bằng chứng ở pending. Đây là trạng thái chờ xử lý, không phải đã duyệt, đã phân công kiểm duyệt viên hay đã công khai. PublishedRevisionId đang phục vụ độc giả được giữ nguyên.

## Phản hồi và bản sửa

- Kết quả xét duyệt được đọc từ database; phần này chưa cung cấp API quyết định của Moderator. Các kết quả trong test được tạo bằng fixture trên MongoDB tạm.
- Chỉ kết quả rejected/revision-requested của đúng gói hiện tại mới mở vòng sửa. Kết quả cũ, phiên bản stale, nội dung đã chuyển vòng, truyện archived hoặc quyền Author hết hiệu lực bị chặn.
- Tạo ContentRevision editable mới, parentRevisionId trỏ revision đã xét. Nội dung, chữ ký quyền, digest và lịch sử của gói cũ không bị sửa hoặc tái sử dụng làm chữ ký cho bản mới.
- Gửi lại dùng quy trình prepare/submit và tạo gói, bằng chứng cùng khai báo quyền mới cho truyện. Gửi lặp thao tác tạo bản sửa ngay sau thành công trả cùng revision; không tạo thêm bản sao.
- Editor lưu bản nháp thành công trước khi mở đúng storyId/chapterId gửi duyệt. Lỗi lưu hoặc gửi giữ dữ liệu nhập; không hiển thị thành công giả.

## Giới hạn còn lại

Chưa hoàn thiện canonical rich-text AST, gói media, PDF import, worker embedding/comparison/LLM, quyết định kiểm duyệt, phát hành theo thứ tự, lịch phát hành và early access. Không có bước tự duyệt hoặc tự phát hành để thay các phần còn thiếu.

Kiểm thử bao gồm quyền sở hữu, stale version, gửi đồng thời, rollback, quyền bất biến, snapshot công khai, tạo bản sửa và gửi vòng mới. Lượt kiểm tra trình duyệt trước khi pause đã gửi thật trên MongoDB tạm và thấy gói/lịch sử pending; không ghi dữ liệu thử vào MongoDB đang dùng.
