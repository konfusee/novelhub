# Sequence mua quyền đọc chương — đầy đủ model

Đối chiếu source NovelHub ngày 04/11/2026. File chính: [chapter-unlock-models-complete.drawio](chapter-unlock-models-complete.drawio).

## Cách đọc

Trang 01 là luồng tổng quan có các model tài chính. Bắt đầu báo giá ở 08, xác thực ở 02; khi POST mua thì theo 03 → 04 → 06 (mở rộng phần Wallet ở 05). Sau thành công, trang 07 lấy lại nội dung. Trang 09 là phụ lục catalog dùng chung.

`ref` diễn giải chi tiết **cùng lời gọi**, không phải gọi lại hay trừ xu thêm. Các `break` kết thúc sơ đồ con hiện tại; lỗi làm transaction mua abort, nhưng `free`/`owned` là kết quả bình thường và commit các kiểm tra. Thanh xanh là activation, không phải ký hiệu transaction.

Ba lifeline readerWallet, authorWallet, platformWallet ở trang 05 là ba document/nhóm truy vấn logic của **cùng model Wallet và collection wallets**. Chúng không phải ba model hoặc ba database khác nhau. Mọi lệnh cập nhật số dư đều trỏ tới Wallet và ghi rõ purpose, owner, điều kiện và số xu cộng/trừ.

## Các trang

- **01 — Mua quyền đọc — tổng quan có model**: [Xem PNG](unlock-detail-01.png). Luồng chính: các mũi tên ghi dữ liệu trỏ trực tiếp tới từng model. Backend gộp các module; xem trang 02–09 để mở rộng.
- **02 — Xác thực trước mỗi API mua / báo giá**: [Xem PNG](unlock-detail-02.png). requireAuth() trong reader-unlocks.routes.js gọi resolveSession(); đây là phiên đăng nhập, khác session MongoDB của transaction.
- **03 — Kiểm tra trong transaction trước khi mua**: [Xem PNG](unlock-detail-03.png). Đoạn đầu purchaseReaderChapter() + ownerWrite() + lockUnlockTarget(); transaction đã bắt đầu. Các lệnh ghi version cũng được rollback khi lỗi.
- **04 — Tính phân chia doanh thu và snapshots**: [Xem PNG](unlock-detail-04.png). getUnlockRevenueSplit() trong unlock-revenue.js. Chỉ đọc chính sách và tính toán; chưa trừ hay cộng Wallet.
- **05 — Trừ và cộng xu — ba ví, cùng model Wallet**: [Xem PNG](unlock-detail-05.png). transferUnlockCoins() + creditEarningsWallet() trong unlock-wallets.js. Ba lifeline bên phải là ba document logic của cùng collection wallets.
- **06 — Lưu yêu cầu, quyền đọc và lịch sử giao dịch**: [Xem PNG](unlock-detail-06.png). executePaidUnlock() trong unlock-purchase.js. Mỗi model có lifeline riêng; ref 05 giải thích phần Wallet nằm giữa quá trình lưu.
- **07 — Lấy lại nội dung sau khi mua**: [Xem PNG](unlock-detail-07.png). ChapterSegment tăng attempt rồi GET catalog. Trình bày cả model nội dung, bình luận và lượt đọc thực sự được route gọi.
- **08 — Báo giá trước khi người đọc bấm mua**: [Xem PNG](unlock-detail-08.png). getReaderUnlockQuote() trong reader-unlocks.js. Read-only đối với dữ liệu tiền; xác thực dùng trang 02.
- **09 — Phụ lục truy vấn catalog thực tế**: [Xem PNG](unlock-detail-09.png). queryPublishedStories({ids:[storyId], pageSize:1}) dùng Story.aggregate(). Các $lookup chạy trong MongoDB; đây không phải các lệnh Account.findOne() riêng.

## Đối chiếu với source

| Phần | File nguồn |
|---|---|
| UI mua và tải lại | `frontend/src/components/reader/ChapterUnlock.jsx`, `ChapterSegment.jsx` |
| Router mua/báo giá | `backend/src/routes/reader-unlocks.routes.js` |
| Auth | `backend/src/middleware/auth.js`, `backend/src/auth/session.js` |
| Transaction | `backend/src/modules/reading/owner-write.js`, `backend/src/db/connection.js` |
| Kiểm tra/điều phối | `backend/src/modules/reader-unlocks.js` |
| Chia doanh thu | `backend/src/modules/unlock-revenue.js` |
| Cập nhật Wallet | `backend/src/modules/unlock-wallets.js` |
| Lưu quyền và lịch sử | `backend/src/modules/unlock-purchase.js` |
| Kiểm tra quyền khi đọc | `backend/src/modules/reading/access.js` |
| Nội dung/prev/next/bình luận/view | `backend/src/routes/catalog.routes.js`, `backend/src/modules/reading/chapters.js`, `views.js` |
| Catalog aggregate | `backend/src/modules/catalog-query.js` |

## Các điểm nghiệp vụ phải hiểu đúng

- `Wallet` cập nhật số dư. `LedgerEntry` ghi lịch sử và `RevenueAllocation` ghi phân bổ; hai model sau không cộng/trừ xu lần nữa.
- Reader bị trừ bằng cập nhật có điều kiện `availableBalance >= priceCoins`, không chỉ dựa vào canAfford trên giao diện.
- Ví tác giả và nền tảng được upsert trước. Nếu phần nhận bằng 0, code không tăng số dư và không tạo ledger 0 xu.
- `PLATFORM_OWNER_ID` là chủ sở hữu hệ thống, không phải tài khoản admin.
- Chỉ commit sau khi đã ghi cả quyền đọc, ledger, phân bổ, yêu cầu và audit. Lỗi ở bất cứ bước nào rollback cả ghi version và thay đổi tiền trong transaction.
- `UnlockRequest.status = committed` không phải lệnh commit MongoDB.
- Gửi lại requestKey hoặc dùng key mới cho chương đã có quyền hợp lệ không thu thêm xu. Một key cũ gắn payload khác bị từ chối.
- Quyền đọc sớm gắn publishedRevisionId và thời hạn. Khi đọc sớm kết thúc, chương trở thành miễn phí theo quy tắc truy cập.
- Ví dụ 70/30 là minh họa, không cố định trong code; ưu tiên thỏa thuận tác giả đang có hiệu lực rồi tới chính sách chung.
- Session đăng nhập và ghi lastSeenAt thuộc auth, chạy ngoài transaction mua. Không có RoleAssignment trong requireAuth của route mua; không thêm model đó chỉ vì account có role.
- Các `$lookup` catalog chạy trong MongoDB aggregate. Hình 09 vẽ collection theo model tương ứng; không giả lập các hàm Mongoose gọi nối tiếp trong source.
- Lấy lại nội dung là một HTTP request riêng sau commit; lỗi tải nội dung không tự hoàn tiền. Lỗi ghi view không làm hỏng việc đọc.

## Phạm vi

Bộ hình bao gồm báo giá, xác thực request mua, transaction mua, cập nhật ba ví, ghi dữ liệu và GET nội dung sau khi mua. Truy vấn catalog và các model phụ được mở rộng ở phụ lục. Không bao gồm luồng đăng nhập tạo Session mới, thanh toán nạp xu/SePay, Payouts, API tải từng ảnh và lưu tiến độ ReadingProgress; đó là các tương tác riêng.

18 loại model/collection được đối chiếu: Session, Account, Story, Chapter, ContentRevision, UnlockRequest, UnlockEntitlement, PolicyVersion, AuthorRevenueRate, Wallet, LedgerEntry, RevenueAllocation, AuditEvent, Category, Rating, StatisticsEvent, Follow, Comment.

Các trang được giữ dưới dạng native draw.io cells: sửa chữ, chuyển các participant và chỉnh mũi tên được. Model/lifeline/activation được nhóm; mũi tên thông thường gắn vào các điểm trên lifeline để theo nhóm khi kéo.
