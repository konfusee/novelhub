# Lưu trữ và khôi phục chương nháp

Commit chức năng: `21e2edb`. Kiểm tra ngày 16/10/2026: 30 test backend và 13 test frontend liên quan đạt; lint hai workspace, build, i18n 1.175 khóa, icons và Prettier đạt. Chưa nghiệm thu toàn bộ UC-AUT-03.

Trang quản lý truyện có thao tác lưu trữ/khôi phục tại từng chương đủ điều kiện và bộ lọc **Đã lưu trữ**. Hộp thoại nêu tên chương và yêu cầu xác nhận. Chỉ báo thành công sau khi API lưu xong rồi tải lại workspace. Lỗi kết nối cho phép thử lại; 409 yêu cầu tác giả chủ động tải lại trạng thái. Không xóa bản ghi hoặc nội dung.

`POST /author/stories/:storyId/chapters/:chapterId/lifecycle` nhận đúng `{ action: 'archive' | 'restore', expectedVersion, expectedStoryVersion }`. Yêu cầu phiên đăng nhập, Origin hợp lệ, Author đang hoạt động, đúng chủ sở hữu và version truyện/chương hiện tại. Chương ngoài truyện hoặc truyện người khác trả 404; sai version/điều kiện trả 409; body sai hoặc thừa trường trả 400.

Chỉ áp dụng khi truyện là draft riêng tư, metadata revision editable, không khóa soạn thảo và không có gói validated/pending-review/decision-pending. Mọi chương của truyện phải là draft hoặc chương riêng tư đã được chính tác giả lưu trữ qua luồng này. Không chương nào được có dấu phát hành, published pointer, lịch phát hành hoặc cancelledAt. Revision hiện tại của chương phải thuộc đúng truyện, chương và tác giả, editable và chưa immutable. Không khôi phục nội dung lưu trữ bởi kiểm duyệt hay quy trình khác.

Transaction khóa quyền Author, kiểm tra lại điều kiện, đổi status chương, tăng version chương và truyện, ghi publicationTransition và audit append-only `chapter.draft-archived` hoặc `chapter.draft-restored`. Audit lỗi rollback cả hai document. Hai request cùng baseline chỉ một thành công. Không thay model/schema.

Giữ nguyên ID, title, orderKey, toàn bộ revisions, content, quyền và dữ liệu tài chính. Chương lưu trữ chỉ đọc, không xuất hiện trong kho nháp hoặc cây chương của editor; vẫn nằm trong workspace để xem và khôi phục. Sau khôi phục, chương trở lại kho nháp và cây editor với thứ tự cũ. Khôi phục không gửi duyệt/phát hành. Sắp xếp chương bị vô hiệu khi còn chương archived; khôi phục các chương trước khi sắp xếp. Truyện có các chương do tác giả lưu trữ vẫn có thể lưu trữ/khôi phục; phải khôi phục truyện cha trước khi khôi phục chương.

Kiểm thử bao phủ lưu/đọc lại, bảo toàn revisions/order/pointer, chặn sửa chương archived, quyền/Origin/body/version, audit rollback, cạnh tranh, phát hành/lịch/khóa/gói chờ duyệt và vòng lưu trữ/khôi phục truyện cha. Browser dùng MongoDB replica set tạm: thao tác bằng bàn phím, bộ lọc lưu trữ, lưu trữ và khôi phục rồi reload. Kiểm tra light/dark, 390/768/1024 px không tràn ngang; console không có warn/error trong lượt thử. Không ghi fixture vào database nhóm.

Phần còn lại: xóa chương, vòng đời nội dung đã phát hành và canonical rich-text AST có nghiệp vụ riêng. Không coi lưu trữ là xóa vĩnh viễn.
