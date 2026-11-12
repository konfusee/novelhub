# Đối chiếu Full.zip — Coins & Payouts

Nguồn: Full.zip (README, TASKS và các review Account, Author, Discovery, Staff,
Kongming), baseline main 1cc2c99. Review là ảnh chụp code lúc đó, không chứng minh
cấu hình hoặc trạng thái database hiện tại. Đối chiếu dưới đây bao gồm thay đổi local.

## Quyết định nghiệp vụ mới của người phụ trách

Ngày 11/11/2026: hệ thống tự lập danh sách và tự giả lập thanh toán; admin chỉ xem
thống kê, số liệu và danh sách. Quyết định này thay thế yêu cầu admin nhập bằng chứng
chuyển khoản thật trong T08/A-UC-13.1. Cần cập nhật SRS, sequence diagram và screen
design tương ứng, không mô tả tính năng giả lập là tích hợp chuyển tiền thật.

Mốc chốt giữ theo tài liệu: 00:00 ngày 1, Asia/Ho_Chi_Minh, sau khi kết thúc tháng.
Ví dụ kỳ xử lý 2026-12 chốt doanh thu trước 01/12; đây không phải thao tác admin
nhấn vào ngày 30/11. Backend phải chạy để thực thi; khi khởi động lại có chạy bù.

Luồng: xét số dư trước mốc chốt → so ngưỡng chính sách (mặc định 100.000 xu) →
chốt ngân hàng nhận → tạo khoản chi và trích xu trong transaction → worker tự giả
lập → ghi kết quả, audit hệ thống, thông báo → admin/author xem kết quả. Thiếu
ngân hàng lúc xét thường thì chưa tạo khoản chi; khoản chi cuối của tài khoản đã
xóa có thể ở trạng thái chờ/giả lập thất bại. Không tạo thông tin ngân hàng thay họ.

Kết quả thành công giả lập có nhãn rõ ràng, mã SIM-AUTO, không gọi API chuyển tiền.
Không trích xu lần nữa khi thanh toán; chạy lại không tạo thêm khoản hay kết quả.

## Tình trạng theo review

| Mục | Đối chiếu code local |
| --- | --- |
| T04 số dư header 450 xu | Đã bỏ số dư giả; header giữ liên kết ví. |
| T06d trang giao dịch mẫu | Đã thay bằng trang đọc dữ liệu thật. |
| T07 tự lập kỳ, tác giả mất role, tài khoản đã xóa | Đã có worker, cutoff, chạy bù, unique account-period và bản ghi kỳ. Có test các trường hợp chính. |
| T08 ghi nhận chuyển khoản thật | Thay bằng tự giả lập theo yêu cầu mới. API admin ghi kết quả/lập kỳ bị chặn; giao diện không còn nút này. |
| T10a môi trường SePay | Code QR/webhook có sẵn. Cần kiểm chứng vận hành bằng backend public, đúng gateway/key và giao dịch thử; review env cũ không đủ kết luận env hiện tại thiếu. |
| T11 mất quyền sau tái xuất bản | Đã kiểm tra quyền theo chương trong thời hạn còn hiệu lực; giữ revision gốc làm bằng chứng mua. Đây là cách sửa khác đề xuất di chuyển revision trong review. |
| T12 trạng thái khóa theo người đọc | Đã đưa entitlement vào danh sách chương, thư viện và điều hướng backend. |
| T14 API ngân hàng thiếu audit | Sau khi merge main: giữ việc xóa API/controller/service MVC cũ; chỉ còn API ngân hàng có audit. Endpoint cũ trả 404. |
| T27 thống kê đăng ký/mở khóa | Có số lượng tổng theo khoảng ngày. Chưa đủ phân nhóm trạng thái, truyện/chương/tác giả và biểu đồ như tài liệu. |
| T28 giao dịch và đối soát | Có danh sách, bộ lọc, tìm ví, cộng đúng tiền nhận hoặc đóng không cộng, lý do/audit/chống lặp. Chưa có màn hình chi tiết giao dịch độc lập. |
| T29b thu nhập/lịch sử/report | Có báo cáo tác giả và admin, tìm/lọc/xuất CSV, lịch sử payouts. Chưa đủ toàn bộ bộ lọc và chiều phân tích trong UC-AUT-13/14/18 và A-UC-08. |

## Những chỗ còn cần hoàn thiện

- Reader: phân trang lịch sử ví, mô tả gói/chương thay ID; hiển thị đơn đang chờ
  và chuyển khoản cần đối soát, khôi phục QR để tránh người đọc chuyển lần nữa.
- Report: tổng nạp đã khớp, phần nền tảng, số dư theo loại ví, bộ lọc thời gian/
  policy và nhóm thống kê; không xem các card tổng hiện tại là đủ toàn bộ SRS.
- Payouts: giao diện đã có danh sách kỳ và kết quả mới nhất; lịch sử mọi lần xử lý
  kèm actor chưa có màn hình chi tiết riêng. Kết quả cũ chưa phân loại phải giữ nguyên.
- Các mục auth, moderation, media, profile thuộc phần khác: không tự sửa hoặc bật
  worker AI chỉ vì nội dung trong review yêu cầu.

Các kiểm thử nghiệp vụ dùng MongoDB tạm, không chạy seed hay giả lập chi trả trực
tiếp trên database dùng chung để chứng minh hoàn tất.

## Cập nhật hoàn thiện sau đối chiếu

Đã bổ sung phân trang/lọc và số dư sau bút toán cho reader và author, mô tả nguồn giao dịch, mở lại đơn nạp/QR, cảnh báo tiền cần đối soát, báo cáo tài chính theo kỳ/đối tượng/chính sách, xuất toàn bộ nhóm CSV, và lịch sử xử lý từng payout theo quyền xem. Chi tiết phạm vi, công thức và API nằm trong [tài liệu hiện hành](coins-payouts-completion.md). Các dòng thiếu ở phần đối chiếu ban đầu là ghi nhận trước bản bổ sung này, không phải chứng nhận đã đủ mọi use case trong toàn bộ SRS.
