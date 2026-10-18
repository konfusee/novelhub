# Mở khóa đọc sớm và phân bổ doanh thu

`GET /api/reader/stories/:storyId/chapters/:chapterId/unlock` trả quyền đọc hiện có, đúng published revision, giá, hạn đọc sớm và số dư reader-coins. `POST` cùng đường dẫn yêu cầu `publishedRevisionId`, `expectedPriceCoins`, `idempotencyKey`; không nhận số tiền phân bổ từ trình duyệt. Chỉ tài khoản active được gọi. Không đổi model/schema.

Máy chủ kiểm tra truyện/chương công khai, tác giả active, đúng revision approved/immutable thuộc truyện/chương/tác giả, snapshot policy thiết lập giá/thời hạn, giá chưa đổi, thời gian đọc sớm và số dư. Truyện/chương và tài khoản được khóa trong transaction để phối hợp với unpublish/đóng tài khoản. Không thu phí nếu đã hết cửa sổ đọc sớm hoặc đã có entitlement còn hạn cho đúng phiên bản.

Transaction ghi cùng lúc:

1. UnlockRequest và entitlement gắn đúng publishedRevisionId, price/access policy snapshot, hạn bằng endsAt của đọc sớm.
2. Trừ reader-coins; cộng author-earnings và system-earnings.
3. Ba ledger append-only cùng scope thao tác, RevenueAllocation và audit.

Tỷ lệ là AuthorRevenueRate có hiệu lực gần nhất; nếu không có thì dùng authorSharePercent của policy effective hiện hành. Bỏ qua rate/policy tương lai. Tính Author bằng số nguyên BigInt và floor; platform nhận phần dư, luôn bảo toàn tổng xu. Giữ snapshot tỷ lệ thương lượng/policy trong allocation; thay rate sau đó không sửa giao dịch cũ. System wallet dùng định danh dành riêng `000000000000000000000001`, không dùng ví Admin. Zero-share vẫn có leg 0 để bút toán đủ ba phía. CAS balanceVersion, unique request/entitlement và khóa tài khoản ngăn thu phí lặp, kể cả request khác key cùng mua chương. Audit lỗi rollback tất cả. Retry khởi tạo ví có giới hạn khi hai giao dịch đầu tiên tranh cùng platform wallet.

Trang đọc giữ nguyên canvas, cài đặt và paragraph rendering. Chỉ lỗi `chapter_locked` mới hiện vùng mua đọc sớm: tải quote thật, tới ví nếu thiếu xu, xác nhận trừ xu trong modal và tải lại văn bản sau API thành công. Không hiển thị nội dung bị khóa, tự trừ xu khi mount hoặc báo thành công cục bộ. Lỗi giữ modal và yêu cầu tải lại quote trước khi thử tiếp. Không hoàn xu theo yêu cầu hiện hành.

Giới hạn do schema hiện tại: entitlement unique theo account/chapter. Nếu có entitlement khác phiên bản/đã thu hồi, API trả xung đột và không thu thêm; chưa có luồng chuyển quyền mua cũ sang revision mới. Không mua chương của chính mình; Author dùng xem trước. Giao diện chưa xác minh trực quan browser ở nhóm này; ghi nhận component tests/build. Ngân hàng/live deployment, media và AI không được giả định đã hoạt động.
