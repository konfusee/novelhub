# Lịch sử biến động ví thu nhập Author

Commit chức năng: `d0bb0cf`. Trang Doanh thu giữ các card/biểu đồ hiện có và bổ sung bảng **Biến động ví thu nhập** đọc trực tiếp ledger MongoDB. Bảng dùng kỳ ngày/tuần/tháng đang chọn của trang, bộ lọc tất cả/tăng/giảm và phân trang 20 bản ghi. Không có dữ liệu thì hiển thị rỗng; lỗi có thử lại, không dùng mock fallback. Test frontend nằm trong `frontend/test/pages/author`.

## API và nguồn dữ liệu

`GET /author/transactions?period=month&direction=all&limit=20&cursor=...` yêu cầu phiên đăng nhập và Author đang hoạt động. `period` nhận day/week/month; direction nhận all/credit/debit; limit từ 1 đến 50; body/query không nhận ownerId hoặc walletId. Các tham số lạ, cursor lỗi hoặc cursor khác bộ lọc trả 400.

Server tự tìm ví `ownerType: account`, `ownerId` từ phiên, `purpose: author-earnings`. Không đọc ví reader-coins hay ví tài khoản khác. Không tạo ví khi chưa có. Chỉ trả ID bản ghi, loại, chiều, số xu, đơn vị và thời gian; không trả actor, reason quản trị, source IDs hoặc khóa idempotency.

Kỳ dùng lịch Việt Nam, tuần bắt đầu thứ Hai, tháng bắt đầu ngày 1; không lấy bản ghi tương lai. Hàm tính kỳ được dùng chung với biểu đồ thu nhập. Sắp xếp giảm dần theo occurredAt và _id. Cursor giữ cặp ngày/ID và bộ lọc; trang sau lấy các bản ghi cũ hơn cặp đó, tránh lặp khi xuất hiện bản ghi mới ở đầu danh sách. Đây không phải snapshot cố định của cả kỳ. Đổi kỳ/chiều biến động đưa UI về trang đầu; quay lại dùng chuỗi cursor đã duyệt.

Số xu giữ nguyên amount/direction đã ghi nhận, không suy doanh thu từ nạp xu, không tính lại số dư, không ghi ledger hoặc cập nhật ví. `withdrawal-debit` được mô tả là trừ ví để thanh toán, không tự coi là ngân hàng đã thanh toán thành công. Thời gian trong bảng hiển thị Asia/Ho_Chi_Minh. Không thay model/schema hoặc tạo finance engine khác.

## Kiểm chứng ngày 16/10/2026

- 6 test backend liên quan đạt: ví đúng chủ, tách reader/Author khác, DTO, không đổi ledger/số dư, cursor với timestamp trùng, bản ghi mới giữa hai trang, lịch Việt Nam, tương lai, zero/chiều, quyền/strict query, cursor lỗi và trường hợp chưa có ví; gồm hồi quy tổng thu nhập.
- 6 test frontend liên quan đạt: số xu có dấu, giờ Việt Nam, next/previous cursor, đổi kỳ/chiều về đầu, empty/error/retry, response lỗi và hồi quy trang thu nhập.
- Lint hai workspace, i18n 1.228 khóa, build frontend, icons, Prettier và diff check đạt.
- Browser dùng MongoDB replica set tạm có 21 bản ghi thử: trang đầu 20, trang sau 1, quay lại, lọc khoản giảm, đổi kỳ và reload đều đọc đúng API. Kiểm tra light/dark, 390/768/1024 px không tràn ngang toàn trang; bảng rộng cuộn trong card. Console cuối không warn/error. Fixture giao dịch không được nạp vào database nhóm.

Đây là phần lịch sử ledger của P6. Đọc trạng thái/phiếu payout đã được bổ sung trong `8e5e236`, xem `author-payout-history.md`; sửa reset cursor khi quay về bộ lọc cũ trong `6aea15e`. Còn đối soát, doanh số theo chương và thực thi payout đầy đủ. Tiến độ use case rộng tiếp tục Một phần; bằng chứng đã đồng bộ workbook.
