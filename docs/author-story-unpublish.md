# Ngừng phát hành và công khai lại truyện

Checkpoint 17/10/2026. Giữ nguyên schema và giao diện quản lý hiện có.

Author sở hữu truyện đang công khai có thể ngừng phát hành tại tab thông tin. Hộp xác nhận bắt buộc lý do; thông tin đang sửa phải được lưu hoặc hoàn tác trước. API `POST /api/author/stories/:storyId/lifecycle` nhận `action: unpublish`, `expectedVersion`, `expectedPublishedRevisionId`, `reason` (1–1000 ký tự). Transaction kiểm tra lại Author, chủ sở hữu, trạng thái không bị khóa và đúng phiên bản; thay đổi trạng thái Story, tăng version và ghi audit `story.unpublished`. Lỗi audit rollback toàn bộ.

Catalog ẩn truyện và mọi chương khi parent không công khai. Published/current/draft pointers, ngày phát hành đầu, nội dung chương, bản duyệt, khai báo quyền và quyền mở khóa được giữ nguyên. Không tạo hoàn tiền hoặc sửa sổ cái. Lịch chương không tự hủy; scheduler chỉ phát hành khi truyện cha công khai và mọi điều kiện còn hợp lệ.

Nút phát hành lại dùng quy trình release hiện có, kiểm tra lại gói bất biến, phê duyệt, bằng chứng, quyền, thể loại và media. Chỉ khôi phục gói cũ nếu chính Author đã ngừng phát hành và không tồn tại bản nháp mới. Bản nháp mới phải được duyệt; không được bỏ qua để công khai lại bản cũ. Trạng thái ẩn do quản trị không được Author tự khôi phục. `publishedAt` giữ ngày công khai đầu; chương đã phát hành được hiển thị lại theo bindings cũ.

Kiểm chứng: 23 test backend release/withdrawal, 51 test chapter release liên quan; bao phủ đồng thời, stale, strict input, ownership, frozen/admin hide, private draft, quyền mở khóa và rollback. UI kiểm tra xác nhận, khóa thao tác lặp, giữ lý do khi lỗi, yêu cầu tải lại và ngăn submit lan sang form metadata. Browser chạy API thật trên MongoDB tạm, không dùng database chung; duyệt trong fixture chỉ là dữ liệu kiểm thử, chưa phải luồng quyết định Moderator/AI.

Còn bìa/banner, nghiệm thu vòng đời đầy đủ và phát hành trả phí. Các use case quản lý truyện/xuất bản vẫn hoàn thiện một phần.
