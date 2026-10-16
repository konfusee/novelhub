# Kế hoạch triển khai phần 2 Author và Admin liên quan

Ngày lập: 15/10/2026. Trạng thái: đang triển khai; P1 đã hoàn thiện phạm vi hồ sơ Author trên môi trường kiểm tra.

## Cập nhật ngày 16/10/2026

- P2/P4 nối chế độ soạn có định dạng `?mode=rich`: toolbar văn bản, AST lưu thật, undo/redo, preview và gộp xung đột giữ định dạng; nhân bản AST trong một transaction. Validator gửi duyệt chấp nhận text-only blocks-v2 và Guest/Reader đọc đúng định dạng từ bản đã xuất bản, giữ annotation qua nhiều inline. Không thay schema, không tự duyệt/phát hành. Xem `docs/author-rich-editor.md`; AUT-04 vẫn Một phần vì còn media.
- Theo phản hồi UI: thêm lối vào nhập PDF/Word/TXT/MD từ editor/quản lý truyện và chọn sẵn truyện; xóa nháp có xác nhận, version/audit, giữ lịch sử bằng tombstone; xem trước toàn bộ bản nháp theo giao diện đọc và thêm link xử lý từng checklist chưa đạt. Không thay schema. 41 test backend, 44 frontend, lint/build/i18n/icons và browser đạt; xem `docs/author-draft-actions.md`. Các UC rộng vẫn Một phần.
- P2 thêm hợp đồng API/AST `blocks-v2` cho định dạng văn bản: heading 2/3, quote, ngắt cảnh, bold/italic/underline. Không thay schema hay migrate dữ liệu; bảo vệ lưu đè mất định dạng và cập nhật số từ/trích đoạn trên dashboard, bản nháp, workspace. 31 test backend liên quan đạt; xem `docs/author-rich-text-contract.md`. AUT-04 vẫn Một phần: còn nối editor, preview, gộp xung đột có định dạng và luồng đọc/duyệt.
- P6 bổ sung đọc lịch sử khoản thanh toán và phiếu Paid theo đúng chủ/ví, không lộ ngân hàng/ghi chú Admin (`8e5e236`). Failed vẫn pending; thiếu/lệch dữ liệu không hiện phiếu. Lọc kỳ có xác nhận, làm mới và cursor pagination; sửa quay lại bộ lọc cũ (`6aea15e`). 16 test backend, 13 test frontend liên quan và browser đạt. Xem `docs/author-payout-history.md`. Chưa triển khai job/ghi kết quả Admin/email/đối soát đầy đủ.
- P6 bổ sung lịch sử ledger của ví thu nhập Author (`d0bb0cf`), lọc ngày/tuần/tháng, tăng/giảm và cursor pagination. Chỉ đọc ví đúng chủ; không thay schema hoặc nạp giao dịch thử vào DB nhóm. 6 test backend, 6 test frontend liên quan và browser đạt. Xem `docs/author-transactions.md`. Bằng chứng đã cập nhật workbook; còn đối soát, báo cáo doanh số và thực thi payout đầy đủ.
- P2 bổ sung so sánh/gộp bản nháp khi lưu gặp xung đột version (`88dccb8`). Giữ bản chưa lưu, đối chiếu MongoDB, xác nhận gộp và lưu riêng theo version mới; không tự ghi đè. 17 test frontend liên quan và browser hai thẻ đạt; xem `docs/author-editor-conflicts.md`. UC-AUT-04 vẫn Một phần; bằng chứng đã cập nhật workbook.
- P2 sửa thanh công cụ editor đang chèn HTML/Markdown chưa được luồng gửi duyệt hỗ trợ (`e4c9208`). Giữ bố cục, vô hiệu rõ công cụ chưa hỗ trợ; thao tác văn bản thuần vẫn lưu thật. 9 test editor, lint/build và browser đạt. Xem `docs/author-editor-toolbar.md`. Canonical rich-text AST/media còn thiếu, UC-AUT-04 vẫn Một phần.
- P2 bổ sung lưu trữ/khôi phục chương nháp riêng tư có xác nhận, version truyện/chương, audit và rollback (`21e2edb`). Giữ ID, thứ tự và nội dung; xem `docs/author-chapter-lifecycle.md`. Đã kiểm tra 30 test backend, 13 test UI và browser. Còn xóa chương, nội dung đã phát hành và AST/media; không đánh dấu toàn bộ quản lý chương hoàn thiện.
- P2 đã nối MongoDB cho danh sách truyện, tạo truyện/chương, metadata và thể loại versioned, editor và kho nháp. Đổi thể loại giữ snapshot công khai (`c268cba`); editor chặn ghi đè mất định dạng (`7b63155`); lưu trữ/khôi phục nháp riêng tư có audit (`6990fa2`). Đã thêm sắp xếp chương của truyện nháp riêng tư, kiểm tra version, audit và rollback trong transaction. Xem `docs/author-chapter-order.md`. Còn canonical rich-text AST và vòng đời nội dung đã phát hành; không coi toàn bộ P2 đã nghiệm thu.
- P3 đã lưu khai báo original/licensed theo gói thông tin truyện, xác nhận và ghi chú nguồn bất biến. Chương dùng khai báo của phiên bản truyện đã duyệt. Nhập PDF/DOC/DOCX/TXT/MD đã nối MongoDB, có kiểm tra/sửa/tách/gộp và lưu chương nháp trong transaction. Còn nhận diện cấu trúc ngoài mẫu Chương/Chapter liên tiếp, rich-text và upload ảnh. Xem `docs/author-document-import.md`.
- P4 đã có kiểm tra điều kiện, đóng băng exact revision, digest, audit, lịch sử/phản hồi theo chủ sở hữu và tạo bản sửa mới từ kết quả rejected/revision-requested. Gửi lại tạo gói mới; gói cũ không bị sửa. Commit: `4fb096e`, `041f6b3`, `2bb5f62`.
- Gói mới có trạng thái validated và EvidenceBatch pending. Chưa có worker xử lý bằng chứng AI trong luồng này; không tự tạo kết quả kiểm duyệt hoặc đưa gói vào trạng thái sẵn sàng quyết định.
- P6 đã có analytics lượt xem, số dư/gross allocation-credit, lịch sử biến động ví và đọc lịch sử/phiếu thanh toán thật. Còn chỉ số chưa có nguồn, báo cáo doanh số theo chương, đối soát và vận hành payout.
- Excel ghi 3 hoàn thiện, 14 một phần, 9 có nền tảng, 1 đã thay thế. AUT-14/16 chuyển Một phần; chưa nghiệm thu toàn bộ luồng chi trả. Công thức và cấu trúc hai sheet được giữ nguyên.
- Gợi ý tách chương đã hỗ trợ tiêu đề Chương/Chapter có số liên tiếp, giữ lời tựa và toàn bộ nội dung hiện tại; tác giả chủ động áp dụng rồi kiểm tra trước khi lưu. Còn nhận diện cấu trúc tài liệu ngoài mẫu này.
- Ưu tiên tiếp: canonical AST và media, tích hợp bằng chứng/kiểm duyệt, rồi phát hành và early access. Giữ nguyên schema backend theo yêu cầu.

## Tiến độ ngày 15/10/2026

- Nền test và hợp đồng Author: `8e7b41f`. Test fixtures tách biệt database nhóm; phần category/policy của P0 tiếp tục trong P2/P5.
- Đã triển khai và kiểm tra P1: gửi/xem đơn, Admin danh sách/duyệt/từ chối, lý do, gửi lại, grant Author, epoch, audit và notification record: `383a79a`.
- Excel đã đánh dấu hoàn thiện AUT-01, A-UC-06, A-UC-07; A-UC-02 và A-UC-04 mới hoàn thiện một phần. Xem `docs/author-access-validation.md`.
- Theo yêu cầu bổ sung: sửa log Windows, email chỉ đọc, dọn placeholder và thay phiên đăng nhập mock bằng API thật. Chi tiết session: `docs/account-sessions.md`.
- Chặng tiếp theo là P2: story/chapter/draft. Các chặng P2–P8 chưa được coi là hoàn thiện từ các thay đổi P1.

## Mục tiêu và phạm vi

Xây dựng luồng thật từ Reader xin quyền Author → Admin duyệt → Author tạo truyện/chương → gửi kiểm duyệt → chỉnh sửa/gửi lại → phát hành → xem thống kê/thu nhập → Admin quản lý Author và payout.

Phạm vi theo yêu cầu mới gồm 16 dòng Author và phần liên quan Author của 11 dòng Admin trong workbook của chủ dự án. Đây là 27 dòng nguồn, không phải 27 chức năng độc lập: yêu cầu rút thủ công đã được thay thế bởi payout hằng tháng. Bảng dưới dùng nhãn **Excel AUT/ADM** để phân biệt ID Excel với canonical ID trong `docs/source/use-case-list.md`; giữ mapping theo tên, không tự đổi ID chung.

Nguồn nghiệp vụ: `docs/decision-log.md`, `docs/requirements-baseline.md`; danh mục tham chiếu: `docs/source/use-case-list.md`. Bản rà soát workspace đã ghi rõ các xung đột ID và diagram. Yêu cầu mở rộng phần 2 của chủ dự án thay thế phân công cũ về phạm vi công việc; quyền actor và các quy tắc tiền/nội dung vẫn giữ theo quyết định V1.

## Hiện trạng lúc lập kế hoạch (15/10/2026)

- Có auth, session, middleware kiểm tra quyền, API gửi/xem đơn Author.
- Có model nội dung, identity/governance, audit/notification, finance và statistics; chưa có API/service nghiệp vụ phần 2 hoàn chỉnh.
- Các trang Author/Admin chủ yếu dùng mock. Không đánh dấu Done chỉ vì có giao diện hoặc model.
- `backend/src/app.js` hiện đăng ký health và auth; có sẵn `HttpError`, `withTransaction`, `requireAuth`, `requireRole` để tái sử dụng.
- Header guest đang có thay đổi chưa commit; không đưa vào commit phần 2 nếu chưa chủ động tách phạm vi.

## Cách tổ chức code đề xuất

Giữ React/Express/Mongoose hiện tại. Tái sử dụng model và API client; không tạo auth store, ledger, shell hoặc bộ UI thứ hai.

```text
backend/src/modules/
  author-access/       # đơn xin quyền và quyết định Admin
  publishing/          # story, chapter, draft, validation, revision, release
  media/               # ảnh, metadata, adapter storage
  imports/             # PDF transient -> editable draft
  author-reporting/    # query thống kê/thu nhập, dùng nguồn chung
backend/src/routes/
  author.routes.js
  admin-author.routes.js
backend/test/
  author-access.test.js
  publishing/          # API, service, concurrency, release
  media.test.js
  imports.test.js
frontend/src/api/
  author.js
  admin-author.js
```

Các tên thư mục mới là đề xuất, chưa tồn tại. Route chỉ nhận request/validate/chuyển đổi response; service giữ nghiệp vụ; model giữ ràng buộc dữ liệu. `publishing/service.js` là public boundary cho các module khác. Identity, policy, notifications/audit và finance tiếp tục có một service sở hữu dữ liệu; mở rộng/tạo service tại chủ sở hữu hiện có nếu cần, không cho mọi module tự ghi model của nhau.

API bên dưới là hợp đồng đề xuất dưới `/api`, cần chốt ở PR đầu. Dùng error shape hiện tại `{ error: { code, message, details? } }`. Đề xuất list response `{ items, page, pageSize, total }`, limit có trần; cập nhật dùng `expectedVersion`/revision và trả `409` khi stale. Chọn cơ chế version cụ thể sau khi kiểm tra model guards hiện hữu.

## Lộ trình và điều kiện hoàn thành

Mỗi chặng làm đủ backend, test và nối màn hình tương ứng. Không để toàn bộ frontend tới cuối.

| Chặng | Phạm vi | Kết quả demo và điều kiện hoàn thành |
|---|---|---|
| P0 | Hợp đồng, fixture, traceability | Mapping Excel↔repo; tài khoản Reader/Author/Admin/Moderator phục vụ dev/test; category/policy fixture hợp lệ; API/error/version hợp đồng; chạy được test DB replica set. |
| P1 | Author access và nền Admin | Reader gửi đơn → Admin duyệt/từ chối → quyền thay đổi an toàn, refresh session và UI thấy trạng thái thật; xem lý do và gửi lại sau từ chối. |
| P2 | Truyện, chương, bản nháp và editor | Author tạo truyện/chương, lưu nội dung, reload vẫn còn; không đọc/sửa được draft của Author khác; stale save trả lỗi. |
| P3 | Ảnh, quyền nội dung, PDF | Upload ảnh thật và gắn draft; khai báo quyền; PDF text-layer ra draft chỉnh sửa được, không giữ source PDF. |
| P4 | Gửi duyệt, feedback, gửi lại | Exact revision frozen; phần 3 nhận submission; Author xem feedback, sửa/gửi vòng mới; bản live cũ vẫn giữ. |
| P5 | Release, early access, lifecycle | Publish now/schedule sau duyệt; release đúng thứ tự; hết hạn thành free; đình chỉ/thu hồi/xóa không để content phát hành sai. |
| P6 | Analytics, earning, history | Author xem số liệu thật và phân trang/lọc theo kỳ; đối chiếu nguồn event/ledger; trạng thái rỗng/lỗi rõ ràng. |
| P7 | Admin policy, audit và payout | Policy/rate có hiệu lực đúng; bảng tháng, Paid/Failed, bank correction và slip có audit; job chống chạy lặp. |
| P8 | System test và tài liệu nộp | Luồng tổng có Expected/Actual/Pass/Fail; diagram/SRS/SDS đồng bộ với chức năng thực tế; không còn nút thành công giả trong phạm vi đã hoàn thành. |

P0 → P1 → P2 → P3 → P4 → P5 là đường ưu tiên. Có thể chuẩn bị hợp đồng analytics/finance ở P0 nhưng chỉ tích hợp thật khi nguồn phần 4/5 sẵn sàng. Không cần chờ AI provider để làm P2/P3; dùng adapter giả trong test P4, không dùng để tự duyệt hoặc công bố hoàn thành tích hợp thật.

### P0 Chuẩn bị trước khi viết feature

- [ ] Ghi mapping 16 Author/11 Admin theo tên; giữ canonical IDs và đánh dấu yêu cầu đã superseded.
- [ ] Đọc model, guard và index liên quan trước khi thêm trường; ghi rõ field nào là draft, review hay published.
- [ ] Chốt AST document version, metadata snapshot, public service và danh sách API của P1/P2.
- [ ] Seed dev idempotent: Reader, Author, Admin, Moderator, ít nhất hai Author để test ownership; không cấp role qua API đăng ký công khai. Dùng dữ liệu dev riêng, không tự chạy seed trên DB nhóm.
- [ ] Có category/policy hợp lệ cho story; fixture test phải tạo qua service/model đúng invariant, không gán ID giả cho entity thiếu.
- [ ] Giải quyết MongoDB test binary/replica set để test nghiệp vụ chạy được. Lỗi tải binary là hạn chế môi trường, không được ghi Pass.
- [ ] Tách commit header guest đang chờ khỏi commit tính năng.

### P1 Đơn Author và quản trị quyền

Mapping: Excel AUT-01, ADM-06/07 và lát cắt ADM-02/04.

Tái sử dụng `GET/POST /auth/author-application`; không tạo thêm endpoint submit đơn thứ hai.

API mới đề xuất:

- `GET /admin/author-applications?status=&page=&pageSize=` và `GET /admin/author-applications/:id`.
- `POST /admin/author-applications/:id/decision` với approve/reject, reason và expectedVersion.

Transaction quyết định gồm application, role assignment/authorization epoch và audit/outbox cần thiết. Cần thiết kế service nhận cùng session; không gọi SMTP trong transaction. Quyền cũ bị thay đổi phải làm mới session theo cơ chế hiện có, không chỉ sửa menu.

UI: nối `AuthorApplyPage`, mở rộng `UsersManagementPage`/`AuthorAgreementPage` để review, không tạo bản sao shell Admin.

Test: Reader gửi đơn; guest bị chặn; applicant không xem đơn người khác; chỉ Admin quyết định; hai quyết định đồng thời chỉ một thắng; reject có reason; reapply được; approve cấp đúng Author, không mất Reader; role lịch sử không bị xóa. Kiểm tra tài khoản từng Author không thành Moderator.

### P2 Story và chapter draft

Mapping: Excel AUT-02/03/04, category của ADM-03.

API đề xuất:

- `GET/POST /author/stories`, `GET/PATCH /author/stories/:storyId`.
- `GET/POST /author/stories/:storyId/chapters`.
- `GET /author/chapters/:chapterId`, `PUT /author/chapters/:chapterId/draft`.
- `POST /author/chapters/:chapterId/validate`.
- `PATCH /author/stories/:storyId/chapter-order` khi có yêu cầu sắp thứ tự.

Không đưa delete chapter/published story vào CRUD tổng quát; đặc tả archive/unpublish và khả năng bỏ draft trước khi mở endpoint. Sắp thứ tự phải giữ unique orderKey và first-release invariant, không đánh lại thứ tự nội dung đã phát hành tùy tiện.

Lưu story + revision/pointer trong transaction khi ghi nhiều document. Chặn Mass Assignment: server lấy authorAccountId từ session, không nhận status/approved/publishedRevisionId/authorAccountId tùy ý từ body. Validation AST phải thật ở server vì trường content hiện là Mixed.

UI: `CreateStoryPage`, `AuthorDashboardPage`, `StoryManagerPage`, `DraftsPage`, `ChapterEditorPage`; thay timer và mock đúng phạm vi đã nối API. Autosave báo saving/saved/error, giữ nội dung khi lỗi, có xử lý conflict khi version thay đổi.

Test: hai Author cách ly; Reader/Admin không tự nhận quyền Author; category không hợp lệ; AST không hợp lệ; version cũ; lưu song song; reload; draft không lộ qua public API. Form lỗi không làm mất dữ liệu.

### P3 Media quyền nội dung và PDF

Mapping: Excel AUT-05/06/07.

API đề xuất: `GET/POST /author/media`, `POST /author/imports/pdf`, `GET /author/imports/:id`, `PUT /author/stories/:storyId/rights-draft`.

Storage dùng local adapter cho dev và object-storage adapter khi cấu hình thật; vị trí dữ liệu local nằm ngoài thư mục public. File serving có kiểm tra quyền với media chưa public; tên file và MIME không đủ chứng minh file hợp lệ. Chốt giới hạn upload, kích thước ảnh, số trang/PDF và timeout như tham số kỹ thuật trước khi code, không đoán thành business rule.

PDF chỉ trích xuất text; success/fail/cancel/timeout đều dọn binary và file tạm. Lưu metadata tối thiểu và draft; không lưu URL/path/object key của PDF. Trích xuất lỗi không hiển thị thông báo thành công. Ảnh đã gắn submitted revision cần snapshot/tombstone, không xóa record lịch sử; alt text có thể nhập nhưng không bắt buộc.

UI: `MediaLibraryPage`, `ImportPdfPage`, ảnh trong editor, bìa và rights ở story/submission.

Test: giả MIME, vượt giới hạn, Author khác, media thiếu/unavailable, scan PDF, parser lỗi, cleanup tất cả nhánh, draft import kiểm tra/sửa lại được.

### P4 Submission feedback resubmission

Mapping: Excel AUT-09/10/11; không đổi quyền quyết định của Moderator.

API đề xuất: `POST /author/stories/:id/submissions`, `POST /author/chapters/:id/submissions`, `GET /author/submissions`, `GET /author/submissions/:id`.

Ranh giới tích hợp:

- Phần 2: validate và freeze revision/rights/media, digest, requestedReleaseAt; giữ lineage; cung cấp nội dung chính xác đã gửi.
- Phần 3: mở submission, embedding → similarity → LLM, claim/evidence, quyết định approve/reject/request revision.
- `moderation.openSubmission(...)` và `publishing.applyDecision(...)` phải truyền cùng transaction session khi nghiệp vụ cần atomic; provider call thực hiện ngoài transaction qua công việc đã lưu bền vững.
- Tái gửi request không tạo hai review cycles cho cùng revision/idempotency key; thay nội dung là revision/cycle mới.
- Notification/email dùng outbox; không rollback quyết định đã commit vì SMTP lỗi.

UI: `SubmissionReviewPage`, feedback trên dashboard và đường mở lại editor; phân biệt đang phân tích/chờ Moderator/rejected/request revision/approved với trạng thái phát hành.

Test: thiếu rights; chỉnh revision frozen; thay media sau gửi; gửi trùng; stale decision; retry/AI fail không tự approve; reject/request revision đều được gửi vòng mới; public vẫn trả revision cũ.

### P5 Phát hành và vòng đời tài khoản

Mapping: Excel AUT-08/10 và ADM-01/02/03/04 liên quan Author.

API đề xuất: `POST /author/chapters/:id/release`, `PUT /author/chapters/:id/release-schedule`, các action story unpublish/archive được đặc tả riêng. Early access nằm trong cấu hình nội dung với policy hiệu lực.

Public boundary: `publishing.getChapter(...)`, `publishing.applyDecision(..., { session })`, lifecycle hooks khi suspended/revoked/deleted; chữ ký cụ thể chốt ở P0/P4 với consumer.

Job runner dùng claim/lease và idempotency bền vững; chạy nhiều process hoặc restart không release hai lần. Thời điểm đánh giá lấy từ server; test dùng clock tiêm được. Approved không có lịch thì chờ Author; lịch đã qua thì due; chỉ release khi parent hiển thị và first-release order hợp lệ. endsAt xuất phát từ thời điểm phát hành thực tế và duration đã chốt; xác nhận semantics này với field/decision contract trước khi đóng API.

Suspended: chặn thao tác và ẩn theo policy; revoke: giữ live earning nhưng frozen, hủy unreleased; deleted: unpublish, hủy unreleased và dừng unlock/earning mới, giữ lịch sử. Restore/unpublish không tự ý hoàn tiền. Admin direct republish chỉ cho exception former Author, có audit.

Test clock/order/concurrency: N+1 due trước N; N được duyệt trễ; không lịch; N unpublish sau lần đầu; expire early access; stale role trong session; revoke/delete chạy đua release; published pointer không chuyển sang draft.

### P6 Thống kê và thu nhập Author

Mapping: Excel AUT-12/13/14/16 và ADM-08/09.

API query đề xuất: `GET /author/analytics`, `/author/earnings`, `/author/transactions`, `/author/payouts`, `/author/payouts/:id` với filter story/chapter/period và pagination phù hợp.

Nguồn stats từ phần 4; earning/transaction/slip từ phần 5. Không cộng tiền dựa trên mock, không suy doanh thu từ top-up, không tạo ledger phụ. API thiếu nguồn phải trả trạng thái unavailable/chưa tích hợp rõ; chỉ dùng fixture trong test/dev và không ghi đã hoàn thành.

UI: `AuthorAnalyticsPage`, `AuthorEarningsPage`, dashboard và Admin reports. Test đối chiếu tổng/kỳ, timezone, zero/empty, duplicate event, ownership, quyền xem ngân hàng khi Author active/deleted.

### P7 Policy audit và payout Admin

Mapping: Excel ADM-01 đến ADM-05 và ADM-08 đến ADM-11 theo lát cắt Author; P1 đã làm ADM-06/07.

API đề xuất dưới `/admin`: author policy/rate, Author lifecycle actions, author audit, author reports, payout list/detail, append payout result, bank correction. Không thay endpoint tài chính đang được phần 5 xây; khi đã có thì dùng endpoint đó và chỉ nối UI.

Payout ngày 1 lúc 00:00 Asia/Ho_Chi_Minh; threshold/policy snapshot, complete bank details và suspension; idempotent theo Author/period. Không tạo endpoint Author yêu cầu rút thủ công. Failed giữ pending; Paid tạo slip; sửa bank qua Admin không ghi đè snapshot đánh giá. Xóa Author cần final payout và financial closure đúng contract.

Muốn hoàn thiện chặng này phải có ledger/allocation/payout service chuẩn phần 5 và audit/outbox phần 1. Nếu các service chưa được đồng đội làm, phần 2 có thể triển khai phần được giao mở rộng tại module chủ sở hữu sau khi đối chiếu branch; không fork một finance engine khác. Approval scope công việc đã có từ chủ dự án, nhưng thay đổi contract vẫn cần thông báo phối hợp trước merge.

Test: cùng kỳ chạy lại, ngưỡng đúng bằng threshold, thiếu bank, suspension, rate làm tròn, final payout account deletion, Failed rồi Paid, correction không sửa snapshot, quyền truy cập và audit không thiếu.

### P8 Nghiệm thu và tài liệu

- [ ] Demo Reader xin Author → Admin duyệt → tạo truyện/chương → gửi → Moderator yêu cầu sửa → gửi lại → approve → publish/schedule → Reader đọc published revision.
- [ ] Demo early access qua hợp đồng unlock phần 5, expiry thành free; Author thấy analytics/earning đúng nguồn.
- [ ] Demo payout theo clock test, Failed/correction/Paid và slip; không gọi chuyển khoản thật trong test.
- [ ] Demo revoke/suspend/delete không rò draft, không phát hành cancelled và giữ lịch sử.
- [ ] Ghi system test có Actual result từ lần chạy thật, không điền trước Pass.
- [ ] Đồng bộ Author UC diagram, swimlane, screen flow; bổ sung package/service dependency và sequence submit/release/payout; cập nhật SRS/SDS/tracking.
- [ ] Kiểm tra mobile/tablet/desktop, light/dark, keyboard, loading/empty/error và reload cho màn hình đã sửa.

## Bắt đầu code bằng PR nào

**PR 1 — Nền kiểm thử và hợp đồng Author.** Đây là việc đầu tiên, chưa gom cả feature vào một PR.

1. Tạo mapping use case và hợp đồng P1/P2; thống nhất tên service với auth/moderation/finance hiện tại.
2. Mở rộng seed dev/test cho các role và category/policy; không chạm dữ liệu dùng chung.
3. Tạo route/service khung cần thiết, register router theo app factory; tái sử dụng middleware/error/transaction.
4. Có test ownership/authentication đầu tiên trên fixture; làm test DB chạy được.

**PR 2 — Author application decision.** Hoàn tất P1 và demo cấp quyền thật.

**PR 3 — Create/list/edit story.** Nối `CreateStoryPage` và dashboard: tạo → reload → mở lại, không setTimeout thành công giả. Sau đó PR chapter draft/editor để hoàn tất P2.

Đừng bắt đầu bằng trang analytics hoặc payout: dữ liệu và nghiệp vụ nguồn chưa có. Mỗi PR giữ phạm vi review được, có một luồng demo rõ và test ý nghĩa; chia thêm PR nếu đụng nhiều service.

## Kiểm tra trước khi đánh dấu Done

### Quy ước commit theo yêu cầu chủ dự án

- Mỗi chức năng hoặc phần công việc hoàn thiện tạo commit riêng, ngay sau khi kiểm tra phù hợp đạt; không gom nhiều chức năng không liên quan vào một commit cuối đợt.
- Dùng Conventional Commits: `type(scope): mô tả ngắn`, với type phù hợp như `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Ví dụ: `feat(author-access): add admin application decisions`, `feat(publishing): persist chapter drafts`, `fix(publishing): reject stale draft updates`.
- Một chức năng có thể gồm backend, frontend và test trong cùng commit nếu chúng tạo thành một thay đổi nhất quán. Phần chuẩn bị độc lập có thể commit riêng khi đã hoàn thiện; không gọi một stub/mock là chức năng hoàn tất.
- Stage chính xác các file thuộc phần đang làm; kiểm tra staged diff trước commit. Không dùng `git add .` để gom file ngoài phạm vi, secrets, tài liệu cá nhân hoặc thay đổi đang có của chủ dự án.
- Nếu thay đổi lớn, chia theo các phần chạy được và review được; tránh commit làm hỏng ứng dụng hoặc chỉ chứa nửa migration cần thiết.
- Ghi kết quả kiểm tra và hạn chế thực tế trong commit body khi cần. Báo hash cùng phần đã hoàn thiện cho chủ dự án sau mỗi chặng.
- Chủ dự án đã yêu cầu tự commit từng phần hoàn thiện; không cần hỏi lại cho commit local đúng phạm vi. Push/merge chỉ thực hiện khi được yêu cầu hoặc đã có ủy quyền tương ứng.

Chạy từ root `novelhub`:

```powershell
npm run lint
npm test -w backend -- <test-file-cua-chang>
npm test -w frontend -- <test-file-lien-quan>
npm run build -w frontend
npm run i18n:check -w frontend
npm run icons:check -w frontend
```

`<...>` là placeholder phải thay tên thật, không copy nguyên. Chạy format check cho file đã đổi; khi merge chặng chạy toàn bộ test và `npm run format:check`, phân biệt lỗi file ngoài phạm vi với lỗi mới. Không bỏ qua DB test chỉ để CI xanh.

Một task chỉ Done khi API lưu/đọc thật, UI phản ánh kết quả thật, quyền/version/error được kiểm tra, test đạt và mapping/tài liệu thay đổi đã cập nhật. Mốc demo và công sức sẽ ước lượng lại sau PR 1; chưa có deadline nên không gán lịch cố định thiếu căn cứ.

- P2/AUT-06: thư viện ảnh dùng metadata MongoDB và bytes thật trên máy chủ; upload PNG/JPEG/WebP, kiểm tra nội dung, ảnh riêng theo chủ sở hữu, phân trang/thống kê, xóa có version và kiểm tra tham chiếu. Không đổi schema và giữ bố cục frontend. 6 test backend, 5 test UI và browser responsive/sáng/tối đạt. Xem docs/author-media-library.md. Chưa gắn media vào AST/gói xuất bản, AUT-06 vẫn Một phần.

- P2/AUT-06: sắp xếp ảnh hàng loạt theo truyện lưu thật, xác nhận danh sách lọc, tối đa 100 ảnh, kiểm tra quyền/version/tham chiếu/truyện bị khóa và rollback cả nhóm. 9 test backend, 7 test UI, browser gán và reload đạt; vẫn chưa tự gắn media vào gói xuất bản.
