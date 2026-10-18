# Kiểm duyệt thủ công khi AI tạm hoãn

Phạm vi người dùng đã chốt: media/AI để sau, không làm giảm mức hoàn thiện của phần văn bản. Luồng này không chạy provider, không đổi EvidenceBatch thành kết quả phân tích thành công/thất bại. `pending` vẫn là pending; lịch sử tiếp nhận/quyết định của con người được lưu riêng.

## Luồng thực

1. Author gửi gói qua API hiện có: revision immutable, khai báo quyền và digest gói được giữ nguyên.
2. Moderator vào `/moderator/claims?view=intake`, mở gói, đọc nội dung/khai báo quyền và nhập lý do/xác nhận để tiếp nhận thủ công. API chuyển validated → pending-review, lưu audit và ModerationHistory.
3. Moderator nhận claim có thời hạn từ policy. Hồ sơ metadata bị khóa chỉnh sửa để chờ duyệt vẫn được nhận nếu khớp revision hiện tại và Author còn quyền; không nhầm với khóa vì thu hồi quyền.
4. Từ mục Tôi đang giữ, mở đúng gói; chọn phê duyệt, từ chối hoặc yêu cầu chỉnh sửa, nhập phản hồi cụ thể (10–1000 ký tự), đánh dấu đã đọc và xác nhận trong modal.
5. Quyết định transaction kiểm tra quyền Moderator chưa từng là Author, trạng thái/claim còn hạn và đúng chủ, submission/revision/evidence ID/version, gói/rights digest, quyền Author còn hiệu lực. Approved kiểm tra thể loại metadata còn active. Lưu revision/status target, trả claim, lịch sử bất biến, audit và thông báo Author cùng transaction.
6. Author nhận thông báo dẫn tới `/author/submissions`. Yêu cầu sửa/từ chối tạo được revision editable mới bằng luồng Author hiện có. Phê duyệt không thay publishedRevisionId hay tự công khai metadata; Author phát hành riêng. Chương có lịch phát hành được chuyển scheduled/due để scheduler hiện có xử lý đúng điều kiện.

## Tính toàn vẹn

Read package dùng `loadSubmittedPackage`: gói đã đóng băng, nội dung/quyền/media digest phải khớp. Luồng này chỉ nhận gói không có media. Không sửa schema. Claim cũ/hết hạn hoặc bằng chứng đổi trả 409. Hai quyết định đồng thời chỉ một thành công; không ghi trùng thông báo/lịch sử. Audit lỗi rollback cả quyết định, trả claim và trạng thái target. Các revision từng công khai giữ nguyên tới khi phát hành bản approved mới.

Release vẫn chấp nhận gate AI terminal hiện có. Với AI pending, chỉ lịch sử `manual-review.decided` outcome approved có đúng submission/revision/package digest, evidence ID/version và correlation `manual-review-ai-deferred-v1` mới đáp ứng gate bằng chứng. Không bỏ kiểm tra approved/rights/category/parent/order/format khác. Nếu worker về sau đổi evidence version hoặc giữ lease, bằng chứng manual cũ không còn đủ điều kiện tự phát hành.

Giao diện sử dụng shell/primitives/tokens hiện có. Các đường dẫn `/moderator/submissions`, `/moderator/reviews` và chi tiết submission trỏ vào luồng thật (tiếp nhận, claim đang giữ, gói duyệt) để không báo kết quả mô phỏng. Màn tham khảo cũ chỉ còn trong UI preview; luồng media không thay đổi. Lỗi ghi giữ lý do và yêu cầu tải lại baseline; không báo thành công trước phản hồi hợp lệ. Lịch sử terminal đọc được khi Author đã tạo bản sửa mới. Browser visual/responsive còn cần nghiệm thu; hiện có component tests/build.

`/moderator/decisions` đọc lịch sử quyết định của chính Moderator từ `/api/moderator/manual-reviews/history`. Có lọc approved/rejected/revision-requested, phân trang 20 dòng, thời gian, feedback gốc và liên kết đúng submission. API private/no-store, không trả lịch sử của Moderator khác, không có sửa/xóa hoặc chạy lại phân tích. Bản ghi lịch sử vẫn còn khi gói nguồn không còn đủ điều kiện mở (ví dụ Author đã đóng tài khoản); lỗi truy cập gói không biến lịch sử thành dữ liệu mô phỏng.

## Kiểm tra

MongoDB replica set tạm kiểm chứng gửi → tiếp nhận → claim → approve → Author release, revision feedback → draft mới, tranh quyết định, expired/stale versions, quyền/Origin/xác nhận và audit rollback. Các test phát hành truyện/chương hiện có chạy hồi quy. Frontend kiểm tra payload đầy đủ các version, xác nhận thủ công, đọc đúng gói, chuyển trạng thái server và lỗi claim. Không gửi ngân hàng/email hay gọi AI thật.
