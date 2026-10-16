# Sắp xếp chương nháp riêng tư

Commit chức năng: `ba8a64a`. Hồi quy liên quan đạt 19 test backend và 12 test frontend; lint hai workspace, i18n 1.160 khóa, build và Prettier đạt. Kiểm tra UI chạy riêng bằng worker thread sau một lượt fork worker bị timeout khởi động trên máy phát triển.

Trang quản lý truyện có nút **Sắp xếp chương**. Hộp thoại hiển thị toàn bộ chương theo thứ tự tăng dần, độc lập với tìm kiếm, bộ lọc và phân trang của bảng. Tác giả dùng nút lên/xuống rồi chọn lưu; hủy không gửi request. Chỉ báo thành công sau khi API xác nhận và tải lại workspace từ MongoDB.

## Điều kiện và API

`POST /author/stories/:storyId/chapters/reorder` nhận `{ expectedVersion, chapters: [{ id, expectedVersion }] }`. Danh sách phải chứa đầy đủ, không trùng ID, từ 2 đến 1.000 chương của truyện. Các chương được đánh lại số 1..N theo thứ tự đã gửi.

Yêu cầu Author đang hoạt động, đúng chủ sở hữu, phiên đăng nhập và Origin hợp lệ. Chỉ áp dụng cho truyện draft riêng tư, chưa từng phát hành, không khóa soạn thảo, không có gói validated/pending-review/decision-pending. Revision thông tin truyện và mọi revision chương hiện tại phải editable, chưa đóng băng. Chương phải ở draft, chưa có dấu phát hành hoặc published revision. Workspace trả `story.canReorder` và version từng chương; server kiểm tra lại toàn bộ điều kiện trong transaction.

Sai phiên bản truyện/chương, thiếu/thừa chương hoặc điều kiện khóa trả 409. ID trùng/body sai trả 400; sai chủ sở hữu 404; thiếu quyền/Origin hợp lệ bị từ chối. Thêm chương ở thẻ khác trong lúc hộp thoại đang mở cũng làm danh sách cũ bị từ chối. UI giữ thứ tự dự kiến; tác giả chủ động chọn **Bỏ thay đổi và tải lại** khi có xung đột.

## Lưu dữ liệu

Transaction khóa quyền Author, cập nhật thứ tự theo hai batch có kiểm tra version, tăng version truyện và ghi audit append-only `story.chapters-reordered`. Batch đầu dùng khóa tạm ngoài cả khoảng khóa hiện tại lẫn số 1..N để đổi chỗ an toàn với unique index `(storyId, orderKey)`; batch sau gán thứ tự cuối cùng. Khóa tạm không được commit riêng. Audit giữ danh sách ID trước/sau và digest; audit lỗi làm rollback mọi thứ tự/version.

Không thay đổi ID chương, nội dung, revision, quyền, published pointer hoặc dữ liệu thống kê. Không tạo revision mới và không tự gửi duyệt/phát hành. Gửi thứ tự hiện tại với version đúng không tăng version hoặc tạo thêm audit. Hai request cạnh tranh cùng version chỉ một request đổi thứ tự thành công. Không thay model/schema.

## Kiểm chứng ngày 16/10/2026

Kiểm thử MongoDB replica set tạm bao phủ đổi chỗ trên unique index, nội dung/revision nguyên vẹn, no-op, quyền/Origin, danh sách trùng/thiếu/stale, chương mới thêm, khóa/trạng thái/phát hành, revision bất biến, gói chờ duyệt, rollback audit và cập nhật đồng thời. UI kiểm tra xem trước/lưu/hủy, giữ danh sách khi lỗi và tải lại có chủ đích khi xung đột.

Browser đã đổi vị trí bằng bàn phím, lưu rồi reload thấy đúng thứ tự từ MongoDB. Kiểm tra light/dark, 390/768/1024 px; hộp thoại nằm trong viewport và không tràn ngang. Bằng chứng được chụp sau khi tải lại. Dữ liệu thử chỉ nằm trong database tạm.

Phạm vi còn lại của quản lý chương: lưu trữ/xóa/khôi phục chương và thứ tự của nội dung đã phát hành cần nghiệp vụ riêng. UC-AUT-03 vẫn ở mức Một phần.
