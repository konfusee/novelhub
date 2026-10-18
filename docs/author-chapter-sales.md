# Doanh số theo chương của Author

Trang thu nhập giữ nguyên bố cục chỉ số/biểu đồ/bảng/thỏa thuận/lịch sử. Bảng doanh số dùng `sales` từ `/author/earnings`, không còn mảng trống cố định. Chỉ truy vấn ví author-earnings của Author đăng nhập; không nhận ownerId từ client, không thay schema.

Mỗi dòng nhóm theo chương và effectivePriceCoins tại giao dịch. Phải liên kết được bút toán allocation-credit → UnlockRequest committed → entitlement đúng account/chapter/price → revision thuộc đúng Author/truyện/chương. Hỗ trợ cả source trực tiếp UnlockRequest và source RevenueAllocation. Xu thực nhận cộng từ ledger, không tính lại theo tỷ lệ thỏa thuận hiện tại. Tên chương lấy từ revision đã mua; tên truyện là nhãn hiện tại của truyện thuộc Author.

Người mua toàn kỳ là số tài khoản khác nhau, không cộng số người mua từng chương (một người có thể mua nhiều chương). Người mua từng dòng cũng distinct; không trả danh tính Reader trong báo cáo. Cửa sổ day/week/month dùng lịch Việt Nam và cùng thời điểm với biểu đồ hiện có. Bảng trả tối đa 100 nhóm theo xu thực nhận, có cờ rõ khi còn nhiều hơn; số người mua toàn kỳ và tổng linkedCoins tính trên toàn bộ kết quả, không giới hạn 100 dòng.

Nếu có allocation-credit cũ thiếu liên kết mua hàng, biểu đồ/tổng thu nhập vẫn giữ khoản đã ghi; `salesCoverageIncomplete` bật và tổng buyers là null. Giao diện hiển thị chỉ phần xác minh được và dấu gạch cho tổng người mua, không giả định người mua bằng 0. Nếu thật sự không có khoản trong kỳ, trả sales rỗng/buyers 0. Chỉ số đăng ký trả phí không có nguồn vẫn giữ trạng thái chưa có dữ liệu; không tạo số mẫu. Báo cáo không thay số dư/chi trả, không dùng USD.

Kiểm thử MongoDB tạm bao gồm hai người mua nhiều chương, phân bổ khác nhau cùng giá, distinct buyers, source RevenueAllocation, kỳ không có giao dịch và credits legacy chưa đủ liên kết. Hồi quy thu nhập/thỏa thuận cũ; component tests kiểm tra hiển thị số xu thực nhận và cảnh báo độ phủ. Không gọi ngân hàng, media hoặc AI.
