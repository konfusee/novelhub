# Báo cáo tài chính Admin

`/admin/transactions` dùng `/api/admin/finance-report`, thay khung trống bằng dữ liệu MongoDB thật. API chỉ đọc, requireAuth/Admin, private/no-store; không trả email, số tài khoản ngân hàng hoặc transfer reference. Không thay model/schema và không sửa các ledger đã ghi.

## Quy tắc số liệu

- Báo cáo chạy các truy vấn tuần tự trong snapshot transaction để số dư, ledger và nghĩa vụ chi trả nhất quán trong cùng lần đọc.
- Tháng dùng mốc đầu tháng 00:00 Việt Nam (UTC+7), đầu kỳ inclusive/cuối kỳ exclusive; hỗ trợ toàn thời gian.
- Xu nạp chỉ tính topup-credit vào reader-coins. Xu mở khóa chỉ tính unlock-debit. Phân bổ Author/hệ thống chỉ tính allocation-credit vào đúng loại ví. Top-up và điều chỉnh không được tính thành doanh thu hệ thống.
- Số dư hệ thống cộng ví ownerType system/purpose system-earnings hiện tại, không giả định luôn bằng 30% mọi dòng thu. Tỷ lệ thương lượng thực được phản ánh qua các bút toán đã lưu.
- Khoản Paid tính theo occurredAt của PayoutResultEntry Paid, lấy số xu từ WithdrawalRequest; không dùng trạng thái pending để giả Paid. Failed là số lần ghi nhận thất bại, có thể nhiều lần cho một khoản.
- Số dư hệ thống, nghĩa vụ pending và số receipt cần đối soát là hiện trạng toàn bộ; các số phát sinh theo kỳ chỉ dùng tháng đã chọn. Bộ lọc loại bút toán/loại ví chỉ lọc bảng ledger, không đổi scope của các thẻ tổng hợp. Giao diện giải thích rõ khác biệt này.
- Mỗi dòng là một bút toán, không phải một lượt mua. Hiển thị mã bút toán, nguồn nghiệp vụ, loại/chủ ví, chiều và số xu. Phân trang 20 dòng, không có thao tác sửa/xóa tài chính tại trang báo cáo.
- Tổng hoặc số dư không còn là số nguyên an toàn bị từ chối; frontend kiểm tra số liệu bắt buộc, không hiện NaN/giá trị fallback hoặc số mẫu.

## Kiểm tra

MongoDB tạm kiểm tra ranh giới tháng UTC+7, phân biệt phân bổ và điều chỉnh, Paid/pending, bộ lọc/scope, quyền Admin, query không hợp lệ, empty/zero và không lộ dữ liệu ngân hàng. Component tests kiểm tra render số liệu, liên kết đối soát, đổi tháng/reset page và response số không hợp lệ. Lint/content/build áp dụng cho nhóm thay đổi. Chưa nghiệm thu trực quan browser; không đánh dấu toàn bộ nhóm báo cáo/job/chi trả Admin hoàn thiện chỉ từ trang này.
