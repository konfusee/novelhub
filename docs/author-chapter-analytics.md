# Thống kê theo chương của tác giả

`GET /api/author/analytics` giữ bộ lọc ngày 7/30/90 và truyện, bổ sung `chapterId` tùy chọn khi có `storyId`. Máy chủ kiểm tra truyện thuộc tác giả đang đăng nhập rồi đối chiếu chương trong chính truyện đó. Sai định dạng hoặc thiếu truyện trả 400; truyện/chương khác chủ sở hữu, sai truyện hoặc không còn khả dụng trả 404. Phản hồi private/no-store không lộ khóa định danh độc giả.

Danh sách chương chỉ gồm ID, tiêu đề và số thứ tự, lấy từ MongoDB theo truyện đã chọn; không gồm tombstone nháp đã xóa. Truy vấn sự kiện thêm đúng chapterId sau khi xác minh sở hữu. Lượt đọc theo ngày và độc giả phân biệt `(viewerType, viewerKey)` đều dùng cùng điều kiện truyện/chương/ngày Việt Nam. Không đổi schema, sự kiện nguồn, dữ liệu tài chính hoặc hạn đọc. Chương không có sự kiện trả chuỗi ngày với giá trị 0; không dựng dữ liệu mẫu.

Giao diện giữ shell, biểu đồ, KPI và trạng thái chưa có số liệu hỗ trợ. Bộ chọn chương dùng Select chung, chỉ mở khi đã chọn truyện. Bộ lọc truyện/chương lưu trong URL để mở từ nút thống kê ở từng chương và dùng Back/Forward. Đổi khoảng ngày giữ chương, đổi truyện xóa chương cũ. Khi chương không còn khả dụng, vẫn có thể chọn Tất cả chương để thoát bộ lọc lỗi. CSV ghi cả truyện/chương đã chọn và đúng dãy ngày đang hiển thị, tiếp tục bảo vệ ô văn bản có thể bị hiểu là công thức.

Giữ chân, âm thanh, nguồn/thiết bị độc giả và doanh thu phân bổ theo chương chưa có nguồn nghiệp vụ hoàn chỉnh, nên vẫn hiển thị chưa có dữ liệu. Tiến độ hoàn thành văn bản đã lưu được đo theo phạm vi bên dưới. UC-AUT-12 tiếp tục ở mức Một phần.

Kiểm thử tập trung bao gồm ownership, chương sai truyện, tham số nghiêm ngặt, số liệu và phân biệt độc giả, ngày Việt Nam, chương 0 lượt đọc, loại tombstone, link chương, đổi/xóa bộ lọc, phục hồi từ 404 và nội dung CSV. Kiểm chứng browser dùng API thật cùng MongoDB replica set tạm, không nạp sự kiện thử vào database nhóm. Ảnh kiểm chứng ngoài repository: WDP301/outputs/author-progress-01a13e25/chapter-analytics.

Kết quả: 3 test backend và 22 test frontend (analytics + workspace truyện) đạt; lint hai workspace, i18n, build và target formatting đạt. Browser đối chiếu năm sự kiện: chương 1 có 2 lượt đọc/2 độc giả, chương 2 có 3/3, tổng có 5/4; Back khôi phục bộ lọc. Đã kiểm tra sáng/tối ở 390/768/1024/1536 px, sửa nhãn KPI dài tràn thẻ điện thoại. Console không có warn/error trong luồng đã kiểm tra. Không tuyên bố toàn bộ frontend suite đã đạt.

## Định danh quay lại trong kỳ

Các liên kết phân tích từ thẻ sức khỏe và tab phân tích trong quản lý truyện giữ `storyId` của truyện đang mở. Liên kết thống kê ở từng chương tiếp tục giữ cả `storyId` và `chapterId`; không đưa tác giả về tổng số liệu toàn bộ truyện ngoài ý muốn.

API bổ sung returningReaders và returnRate: một định danh (viewerType, viewerKey) quay lại khi có view ở ít nhất hai ngày Việt Nam khác nhau trong cùng bộ lọc. Nhiều chương trong cùng ngày không tạo thêm ngày; thay đổi bộ lọc chương tính lại cả tử và mẫu số. Khi mẫu số bằng 0, rate là null; khi có độc giả nhưng chưa ai quay lại, rate là 0. Không trả khóa độc giả và không thay đổi sự kiện nguồn.

Card thay thế vùng biểu đồ giữ chân chưa có dữ liệu bằng tỷ lệ quay lại có định nghĩa, số định danh quay lại/tổng và giá trị làm tròn một chữ số. CSV ghi cùng chỉ số. Giữ chân theo cohort, âm thanh và nguồn độc giả vẫn chưa được triển khai. 4 test backend và 7 test UI analytics đạt; browser dùng ba sự kiện qua hai ngày để đối chiếu 1/2 định danh và 50%. Không tuyên bố toàn bộ frontend suite đã đạt.

## Tiến độ chương hoàn thành

API trả `completionProgress: { total, completed, rate }` từ ReadingProgress thật, không thay schema hoặc ghi dữ liệu khi xem báo cáo. Mẫu số gồm các bản ghi tiến độ `mode=text`, position từ 0 đến 1, lastReadAt từ đầu ngày Việt Nam đầu tiên của kỳ đến thời điểm xem, thuộc truyện/chương của Author. Chương bị đánh dấu xóa hoặc không khớp truyện bị loại. Mỗi bản ghi là một cặp tài khoản/chương ở chế độ văn bản theo unique index hiện có.

Tử số là các tiến độ đạt position=1 và có completedAt hợp lệ trong kỳ, không ở tương lai. Không có mẫu số thì rate=null; có tiến độ nhưng chưa hoàn thành thì rate=0. UI và CSV nêu rõ đây là trạng thái tiến độ hiện tại, có thể thay đổi khi đọc lại; không phải lịch sử phiên, tỷ lệ hoàn thành của mọi lượt xem, khách hoặc âm thanh. Không trả accountId hoặc chi tiết tiến độ riêng của độc giả.

5 kiểm thử backend analytics đã qua các lượt tập trung; 10 kiểm thử UI analytics đạt, gồm CSV, làm tròn, 0%, không có dữ liệu và phản hồi sai. Browser dùng MongoDB tạm xác minh 1/3=33,3%, lọc chương còn 0/1=0%; sáng/tối 390/768/1024/1536px không tràn ngang, console không có warn/error. AI của Author vẫn ngoài phạm vi. Còn cohort retention, nguồn/thiết bị và âm thanh; UC rộng chưa nghiệm thu.

## Phân loại định danh độc giả

`audience: { accounts, guestDevices }` được tính trong cùng aggregate định danh duy nhất hiện có: tài khoản/thiết bị xuất hiện nhiều ngày hoặc chương vẫn chỉ tính một lần trong bộ lọc. Hai loại định danh được đếm riêng, không ghép hoặc suy đoán cùng một con người. Không tăng số truy vấn, không đọc hồ sơ cá nhân, không trả viewerKey/accountId; không đổi schema hay ghi lại sự kiện nguồn.

Card và CSV hiển thị số lượng/tỷ trọng tài khoản và thiết bị khách. Khi không có độc giả, không chia cho 0; tổng không khớp hoặc dữ liệu sai thì không vẽ tỷ trọng. Đây không phải thống kê hệ điều hành, nhân khẩu học hoặc số người thực tế. Backend kiểm thử dữ liệu lặp qua ngày và loại guest; 12 kiểm thử UI analytics đạt, có CSV và dữ liệu rỗng/sai. Các nguồn/thiết bị chi tiết chưa có dữ liệu vẫn ngoài phạm vi đã hoàn thiện.
