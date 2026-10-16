# Lưu trữ và khôi phục bản nháp riêng tư

Checkpoint 16/10/2026 — `6990fa2`. Phạm vi này chưa bao gồm ngừng phát hành hoặc lưu trữ truyện đã công khai.

## Hợp đồng API

`POST /author/stories/:storyId/lifecycle` nhận `{ action: "archive" | "restore", expectedVersion }` và trả `{ story: { id, status, version } }`. Request ghi yêu cầu Author đang hoạt động, đúng chủ sở hữu và Origin hợp lệ. Workspace cung cấp canArchive/canRestore; server kiểm tra lại điều kiện trong transaction, không tin cờ của frontend.

- Archive: truyện ở draft, không bị khóa, có revision thông tin editable và chưa đóng băng. Truyện/chương chưa từng phát hành, không có published pointer/thời điểm phát hành và không có gói validated/pending-review/decision-pending.
- Restore: truyện archived, vẫn đáp ứng điều kiện riêng tư và có dấu chuyển trạng thái author-draft-archived của đúng Author. Không khôi phục lưu trữ do quản trị viên hay bỏ qua khóa authoringFrozen.
- Sai phiên bản/trạng thái trả 409; khác chủ sở hữu trả 404; thiếu quyền trả 403; action hoặc body ngoài hợp đồng trả 400.

## Lưu dữ liệu và giao diện

Transaction kiểm tra lại role/epoch/credential của Author, cập nhật trạng thái và publicationTransition, rồi ghi audit append-only. Audit lỗi làm rollback; hai request cùng expectedVersion chỉ một request thay đổi trạng thái.

Không xóa Story, Chapter, ContentRevision, quyền hay lịch sử xét duyệt. Truyện archived được giữ trong danh sách quản lý, tạm ẩn khỏi kho nháp và khóa soạn/tạo chương. Restore đưa về draft; không tạo publishedRevisionId hoặc tự công khai.

Trang thông tin truyện có bước xác nhận nêu đúng tên truyện và giải thích giữ dữ liệu. Khi có metadata chưa lưu, thao tác vòng đời bị khóa. Các trường thông tin bị khóa lúc request đang chạy; xung đột không giả thành công và không xóa dữ liệu nhập.

## Kiểm chứng

Kiểm thử gồm archive/restore, nội dung và revision không bị xóa, kho nháp, ownership/role/Origin, version và request đồng thời, gói chờ duyệt, dấu phát hành, khóa Author và rollback audit. Browser trên MongoDB tạm đã lưu trữ, reload thấy archived, khôi phục và thấy nguyên chương 6 từ. Light/dark và 390/768/1024 px không tràn ngang; không có cảnh báo/lỗi console.

Các quy trình truyện đã phát hành, early access, quyền mua và ngừng phát hành vẫn cần triển khai, nghiệm thu riêng. Không thay đổi model/schema backend trong checkpoint này.
