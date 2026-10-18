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

Chưa có lịch chạy tự động ngày 1, ghi kết quả Paid/Failed, giao email outbox hoặc đóng tài chính sau khi khoản pending cuối được ghi Paid. Vì vậy A-UC-01 vẫn Một phần. Không đánh dấu khoản chờ trả là hoàn tất hoặc báo email đã gửi.
