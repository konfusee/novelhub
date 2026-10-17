# Tra cứu audit Admin liên quan Author

Ngày kiểm chứng: 18/10/2026. Phạm vi được xác nhận gồm Admin A-UC-01–11 và Author UC-AUT-07–11 theo mã Excel; các mã Author trong tài liệu nguồn có mapping khác. Media và AI Author vẫn tạm hoãn.

## A-UC-04: nhật ký thực

Trang `/admin/audit-logs` thay màn tiện ích bằng tra cứu AuditEvent từ MongoDB. Bộ lọc khớp chính xác action, targetType, targetId, actorId, result và khoảng ngày; ngày giao diện tính theo giờ Việt Nam, gồm toàn bộ ngày kết thúc. Phân trang giữ bộ lọc trong URL, giới hạn 50 bản ghi/trang, sắp xếp occurredAt và ID giảm dần để ổn định khi cùng thời gian.

`GET /api/admin/audit-events` yêu cầu phiên Admin. Sai bộ lọc trả 400, chưa đăng nhập 401, các vai trò khác 403. Không trả correlationId, dataDigest hoặc idempotencyScope. Response private/no-store và Vary Cookie; không có endpoint sửa/xóa audit. Không đổi schema hoặc ghi thêm bản ghi khi đọc. Mỗi truy vấn được giới hạn thời gian 5 giây.

Hiển thị thời gian đến giây, chủ thể hệ thống/tài khoản, hành động, đối tượng, kết quả và lý do như văn bản được escape. Có trạng thái loading/error/retry/empty và phân trang; không fallback dữ liệu mẫu. Đây là tra cứu các audit đã được nghiệp vụ ghi, không tạo lịch sử giả cho thao tác cũ chưa có audit.

## Kiểm chứng

- Hai kiểm thử backend trên MongoDB tạm: đọc nhiều loại đối tượng, bộ lọc kết hợp, cùng timestamp/phân trang, ngày, không hiểu action như regex, không lộ metadata nội bộ, quyền và body query sai.
- Hai kiểm thử frontend: dữ liệu thực từ transport, escape lý do, phân trang, reset trang khi lọc, ngày Việt Nam, lỗi/empty/retry và URL ngày sai không làm crash.
- Lint, i18n 1.719 khóa, build và Prettier đạt.
- Browser tài khoản Admin tạm: đọc ba loại audit, lọc chapter còn đúng một bản ghi MongoDB. Sáng/tối tại 390/768/1024/1536px không tràn ngang; console không warn/error. Không sử dụng database nhóm.

## Các nhóm vẫn phải triển khai

Không đánh dấu toàn bộ phạm vi mới hoàn thiện chỉ từ việc tra cứu audit. Còn vòng đời tài khoản A-UC-01/02; quản trị nội dung A-UC-03; tích hợp policy với giao dịch A-UC-05; báo cáo/thống kê/chi trả/job A-UC-08–11; cùng quyền, early access và vòng kiểm duyệt/gửi lại Author UC-AUT-07–11. A-UC-06/07 và Author UC-AUT-02–05 giữ kết quả nghiệm thu trước đó trong phạm vi đã thống nhất.
