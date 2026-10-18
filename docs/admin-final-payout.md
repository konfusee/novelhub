# Đánh giá chi trả cuối cho Author đã đóng tài khoản

Kiểm chứng 18/10/2026. Phần tiếp theo của A-UC-01, giữ nguyên schema backend.

## Luồng thực tế

Trang `/admin/account-closures` có trong thanh điều hướng Admin và danh bạ tài khoản. Dữ liệu đọc MongoDB thật, phân trang 20 tài khoản chưa đóng tài chính. Phân biệt chưa tới kỳ, tới kỳ đánh giá cuối, và đã đánh giá nhưng còn khoản chờ trả. Nút đánh giá yêu cầu lý do và version hiện tại; lỗi giữ form và yêu cầu tải baseline mới.

`POST /api/admin/account-closures/:id/evaluate` dùng kỳ hiện tại theo 00:00 ngày 1 tại Việt Nam. Tài khoản phải đóng trước mốc này, chưa được đánh giá cuối, chưa đóng tài chính. Không nhận cutoff từ client. Tài khoản mới đóng trong tháng phải chờ kỳ tiếp theo.

Toàn bộ thu nhập chưa lập chi trả được ghi nợ qua ledger và tạo một withdrawal `system-monthly`/`forcedByDeletion`, ngưỡng 0 cùng dòng chi trả. Không yêu cầu đạt ngưỡng tháng thông thường. Snapshot ngân hàng lấy từ lúc đóng tài khoản; nếu thiếu, vẫn lập dòng với marker thiếu để Admin hiệu chỉnh. Khoản pending cũ không bị ghi nợ lại, không tự chuyển thành Paid. Nếu kỳ đã có withdrawal thì từ chối để kiểm tra, không ghi đè.

Account, wallet, ledger, withdrawal, payout row, notification/outbox và audit cùng transaction. Ghi đồng thời trên cùng version chỉ một yêu cầu thành công. Lỗi lưu outbox/audit hoàn tác giao dịch. Không thực hiện chuyển khoản ngân hàng. Chỉ đóng tài chính và bỏ email giữ lại ngay trong nhánh không còn số dư và không có khoản pending.

## Hiệu chỉnh ngân hàng

Admin xem tối đa 50 khoản pending của một tài khoản đã ẩn danh và nhập thông tin do hỗ trợ cung cấp. GET và POST riêng tư, chỉ Admin, không cache. POST yêu cầu version của cả withdrawal và payout row, lý do, đủ ba trường ngân hàng. Chỉ sửa `correctedBankDetailsSnapshot`, giữ snapshot ban đầu trên row/withdrawal. Lưu actor/thời điểm/lý do và digest audit. Không đổi số tiền, số dư hoặc trạng thái đã trả; lỗi audit rollback cả version lẫn bản sửa. UI đọc lại dữ liệu sau lưu và cập nhật version tài khoản trong hàng đợi.

## Kiểm chứng và giới hạn

11 kiểm thử backend mới cùng 14 kiểm thử đóng tài khoản/lịch sử payout đạt; 5 kiểm thử trang mới và 4 kiểm thử danh bạ đạt. Lint, Prettier, i18n và build đạt. Trình duyệt dùng MongoDB tạm: ba trạng thái đúng dữ liệu, biểu mẫu sửa ngân hàng đủ trường, sáng/tối không tràn trang ở 390/768/1024/1536, không có lỗi console. Giao dịch tài chính được kiểm thử bằng dữ liệu giả trong test, không ghi nhận chuyển tiền qua trình duyệt.

Đã nối scheduler vào backend: kiểm tra mỗi 60 giây và khi khởi động, chỉ lấy tài khoản đã đóng trước cutoff ngày 1 tại Việt Nam và chưa được đánh giá cuối. Backend chạy lại sau gián đoạn sẽ xử lý bù. Giao dịch hệ thống dùng audit `actorType: system`; không mượn phiên Admin. Hai worker hoặc thao tác Admin cùng xử lý một tài khoản vẫn chỉ ghi nợ/lập khoản một lần. Một tài khoản lỗi không chặn các tài khoản khác; shutdown chờ tác vụ đang chạy hoàn tất trước khi ngắt MongoDB. Hai kiểm thử scheduler bổ sung đạt, tổng 13 kiểm thử chuyên biệt.

## Ghi kết quả và đóng tài chính

Admin ghi kết quả chuyển tiền thực hiện bên ngoài NovelHub qua `/admin/account-closures/:id/payouts/:withdrawalId/results`. Paid cần xác nhận đối chiếu, đủ ngân hàng, lý do và version của withdrawal/row. Mỗi thao tác có entry key riêng; lặp cùng key/nội dung trả kết quả cũ, đổi nội dung bị 409. Paid chỉ ghi một lần kể cả hai yêu cầu đồng thời khác key. Failed giữ pending và cho phép Paid ở lần sau. Không ghi nợ ví lần nữa. Dữ liệu cũ có Paid nhưng withdrawal vẫn pending bị chặn để kiểm tra, không tự sửa ngân hàng hoặc ghi Paid thêm.

Khi đã đánh giá cuối, số dư thu nhập bằng 0 và mọi withdrawal đã Paid, cùng giao dịch đặt `financiallyClosedAt` và bỏ `retainedPayoutEmail`. Snapshot ngân hàng và lịch sử kết quả/audit được giữ riêng tư. Kết quả, notification và outbox được ghi cùng transaction; lỗi lưu audit rollback toàn bộ.

## Email outbox

Backend chạy worker email tài chính khi có SMTP, kiểm tra mỗi 15 giây và khi khởi động. Mỗi event có một outbox intent; ghi attempt/claim trước khi gọi provider. Lỗi provider retry tối đa 3 lần với backoff 1/2 phút rồi đánh dấu failed. Lease hết hạn được tiếp quản; completion muộn không ghi đè claim mới. Shutdown chờ lượt đang chạy. Không cấu hình SMTP thì giữ pending, không dùng console giả làm email đã gửi.

Email gửi sau khi đóng tài chính sử dụng địa chỉ nhận tạm trong payload của notification, không trả trường này qua các API quản trị kết quả/notification UI. Worker xóa địa chỉ tạm khi giao thành công hoặc thất bại cuối cùng; thông tin đó không được giữ trong lịch sử delivery attempt. Email cũ đang pending được giữ đủ địa chỉ trước khi xóa contact trên Account. Gửi SMTP là at-least-once: khi provider chấp nhận nhưng worker mất lease trước completion, lần tiếp quản có thể gửi lại; kết quả tiền không bị nhân đôi. Lỗi giao email không rollback Paid hay đóng tài chính.

## Nghiệm thu A-UC-01

Phạm vi quản lý tài khoản Author ngoài media/AI đã hoàn thiện: danh bạ, suspend/restore, đóng/ẩn danh, bảo toàn nghĩa vụ, đánh giá cuối tự động, hiệu chỉnh ngân hàng, Paid/Failed, đóng tài chính và email outbox. Nhóm quyết toán/email/đóng tài khoản có 50 kiểm thử backend đạt trong các lượt targeted; 11 kiểm thử trang/danh bạ frontend đạt. Lint, Prettier, i18n và production build đạt. Không có TypeScript/typecheck trong dự án. Không tuyên bố toàn bộ suite frontend đạt.

Trình duyệt xác nhận biểu mẫu Paid bắt buộc acknowledgement, lý do và giữ bố cục sáng/tối ở 390/768/1024/1536. Không submit Paid hoặc thực hiện chuyển khoản qua trình duyệt. SMTP trong test là provider giả; chưa kiểm tra đường gửi SMTP thực tế của môi trường triển khai.
