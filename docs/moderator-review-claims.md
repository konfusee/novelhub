# Claim hồ sơ theo policy

API `/api/moderator/review-claims` yêu cầu Moderator active, chưa từng là Author. Không thay đổi schema; không gọi media/AI hoặc tự tạo bằng chứng phân tích.

- `GET ?view=available|mine&page=1`: tối đa 20 hồ sơ `pending-review`, xếp theo thời điểm gửi. Nhóm available gồm hồ sơ chưa ai giữ hoặc claim hết hạn; mine chỉ có claim còn hạn của người đang đăng nhập. Hết hạn tự trở lại kết quả hàng đợi mà không cần job quét ghi lại toàn bộ database.
- `POST /:id`: nhận claim với `expectedVersion`, `expectedClaimVersion`. Kiểm tra quyền Moderator, tài khoản/quyền Author còn hiệu lực, truyện không đóng băng, đúng gói revision immutable/submitted và trạng thái pending-review. Policy effective gần nhất tại thời điểm nhận quyết định `claimExpiresAt`.
- `POST /:id/release`: chỉ chủ claim còn hạn mới trả claim, với đúng cả hai phiên bản. Thao tác ghi lịch sử và tăng claimVersion, giúp loại các baseline cũ.

Gửi lại chính xác acquisition vừa thành công trả kết quả cũ và không gia hạn. Claim còn hạn không thể bị người khác chiếm; claim quá hạn có thể nhận lại bằng baseline mới, lưu chủ/hạn cũ trong claimReleaseHistory. Thay policy không sửa hạn đã cấp. Policy thiếu, thời hạn không dương hoặc tràn Date đều bị từ chối. Audit ghi policy ID/version và digest gồm deadline/thời hạn sử dụng. Quyền, CAS, claim và audit commit cùng transaction; audit lỗi rollback claim. Khóa tài khoản Author phối hợp với luồng thu hồi quyền/đóng tài khoản hiện có.

Màn hình `/moderator/claims` từ sidebar cho phép nhận/trả hồ sơ, xem deadline và hai nhóm có thể nhận/tôi đang giữ. Bộ lọc/phân trang theo URL, dùng đúng version máy chủ; xung đột giữ lỗi và yêu cầu tải lại, không cập nhật giả thành công. Không đổi shell hoặc các trang review hiện có.

Đây là tích hợp thời hạn policy và quản lý claim, chưa phải toàn bộ luồng Moderator. Không chuyển hồ sơ validated thành pending-review, không vượt gate bằng chứng, không tự quyết định approved/rejected. Kiểm tra claim trong endpoint quyết định thực vẫn cần nối khi triển khai luồng quyết định. Media/AI hoãn theo phạm vi đã thống nhất; không giả định worker AI đã chạy. Chưa xác nhận trực quan browser cho nhóm UI này do kết nối bản xem thử ở turn trước bị timeout; chỉ ghi nhận kiểm tra component/build.

Kiểm thử dùng MongoDB tạm cho deadline/policy tương lai, retry không gia hạn, tranh chấp, takeover sau expiry, fencing chủ cũ, trả claim, quyền, truyện đóng băng, policy không hợp lệ, trạng thái không đủ điều kiện và rollback audit.
