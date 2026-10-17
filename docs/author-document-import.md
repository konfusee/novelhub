# Nhập tài liệu thành chương nháp

Phạm vi bổ sung theo yêu cầu ngày 16/10/2026: PDF có lớp văn bản, Word `.doc`/`.docx`, TXT và Markdown `.md`. Tái sử dụng schema hiện có.

Commit backend: `cd213f8`. Commit frontend: `7794eb0`. Kiểm tra toàn bộ: 215 backend test và 87 frontend test đạt; lint, i18n 1.142 khóa, build frontend, Prettier và diff check đạt.

Gợi ý tách chương: `59a06ee`. Lượt kiểm tra bổ sung đạt 19 test liên quan, lint/build và i18n 1.145 khóa. Không thay schema hoặc parser backend trong lượt bổ sung này.

## Luồng tác giả

Chọn hoặc kéo thả một tệp, kiểm tra văn bản trích xuất, sửa tiêu đề/nội dung, đặt con trỏ để tách chương hoặc gộp hai chương liền nhau. Nút gợi ý tách theo tiêu đề nhận diện các dòng Chương/Chapter có số Ả Rập hoặc La Mã hợp lệ, liên tiếp và có phần nội dung riêng. Giữ nguyên phần mở đầu, ký tự và chỉnh sửa hiện tại; không tự tách khi vừa tải tệp. Số lặp/đảo thứ tự, mục lục chỉ có số trang, tiêu đề mơ hồ hoặc quá 100 phần không được áp dụng. Chọn truyện do mình sở hữu rồi lưu những chương được đánh dấu. Truyện mới được tạo qua màn hình tạo truyện ở thẻ riêng; quay lại tải lại danh sách, nội dung xem trước được giữ.

Trang ban đầu không chứa tệp, chương, truyện đích hoặc số liệu mẫu. Số từ tính từ nội dung đang sửa. Chỉ thông báo thành công sau khi API xác nhận. Lỗi lưu giữ nội dung xem trước. Sau khi chuyển trang, hủy hoặc hết hạn phiên nhập, cần chọn lại tệp.

## Hợp đồng API

- `GET /author/imports/targets`: truyện của Author hiện tại, loại truyện khóa, đang gửi/duyệt hoặc đã lưu trữ. Trả ID, tiêu đề và version thật.
- `POST /author/imports/preview?format=pdf|doc|docx|txt|md`: body nhị phân `application/octet-stream`, tối đa 10 MB. Trả văn bản, định dạng, số trang PDF nếu có, receipt ký HMAC hết hạn sau 15 phút. Receipt gắn tài khoản, authorization epoch, credential version và checksum nguồn. Khởi động lại backend làm receipt cũ hết hiệu lực.
- `POST /author/imports`: `{ receipt, storyId, expectedVersion, chapters: [{ title, paragraphs }] }`. Tối đa 100 chương, 200.000 ký tự tổng nội dung, 20.000 ký tự mỗi đoạn. Body JSON riêng tối đa 2 MB; giới hạn các API khác được giữ.

API yêu cầu phiên đăng nhập, vai trò Author và Origin hợp lệ cho request ghi. Server kiểm tra lại quyền/ownership, trạng thái truyện và version trong transaction. Tạo Chapter, ContentRevision `blocks-v1`, audit cùng cập nhật version truyện trong một lần commit. Lỗi bất kỳ rollback toàn bộ. Gửi lại cùng receipt/nội dung trả các chương đã tạo; nội dung hoặc truyện đích khác trả 409. Không tự gửi duyệt hoặc xuất bản.

## Xử lý tệp và dữ liệu

Màn nhập và editor dùng chung bộ chia đoạn theo giới hạn 20.000 đơn vị UTF-16 của `blocks-v1`. Ranh giới tách không cắt đôi cụm ký tự: emoji nhiều thành phần, cờ và dấu tiếng Việt kết hợp được giữ cùng nhau. Giữ khoảng trắng đầu/cuối đoạn và tại ranh giới các đoạn khi mở lại rồi lưu tiếp. Xuống dòng CRLF được chuẩn hóa thành LF. Nội dung quá 1.000 đoạn hoặc có Unicode lỗi được báo rõ và giữ nguyên trong màn soạn, không gửi yêu cầu lưu không hợp lệ. Backend kiểm tra lại Unicode và giữ khoảng trắng của đoạn đã nhận; không thay model/schema.

Parser chạy trong worker riêng, tối đa hai worker đồng thời, giới hạn heap 128 MB và thời gian 15 giây. Hủy request hoặc hết giờ chấm dứt worker. Tệp nguồn xử lý trong bộ nhớ; không ghi tệp tạm, object storage, URL/path hoặc MediaAsset. Bộ đệm request được xóa sau khi xử lý; worker bị đóng trên cả nhánh thành công và thất bại.

Chỉ nội dung đã kiểm tra được lưu thành revision cùng checksum/audit tối thiểu. PDF dùng ContentImport `text-layer-pdf` hiện có. DOC/DOCX/TXT/MD ghi định dạng trong AuditEvent `text-import.<format>`; không gắn nhãn các định dạng này là PDF và không mở rộng enum/model.

PDF tối đa 100 trang; trang không có lớp văn bản bị từ chối, không OCR. TXT/MD nhận UTF-8 hoặc UTF-16 có BOM. Markdown được chuyển thành văn bản bằng lexer; không render HTML, không thực thi script, không tải liên kết hoặc ảnh. Markdown có HTML/ảnh bị từ chối rõ ràng. Word nhập nội dung chính, chú thích cuối trang/cuối tài liệu và hộp văn bản; không giữ header/footer, bình luận, ảnh hoặc định dạng chữ. Tác giả cần kiểm tra nội dung trước khi lưu và thực hiện khai báo quyền trong quy trình gửi duyệt hiện có.

Giới hạn còn lại: gợi ý tách chỉ hỗ trợ mẫu Chương/Chapter đánh số liên tiếp; chưa hiểu tiêu đề tự do, cấu trúc tùy ý hoặc bố cục tài liệu. Chưa giữ rich-text/bố cục và chưa có OCR. Không coi toàn bộ UC-AUT-05 đã nghiệm thu.

Parser tham chiếu: [unpdf](https://github.com/unjs/unpdf), [word-extractor](https://github.com/morungos/node-word-extractor), [Marked](https://github.com/markedjs/marked). Dependencies được khóa phiên bản trong package-lock.

## Bổ sung ngày 18/10/2026: tiêu đề Markdown

Parser MD tiếp tục trả văn bản thuần như trước và bổ sung `headings` (level/title) từ các heading gốc của lexer. Không lấy heading nằm trong code hoặc blockquote; chú thích YAML đầu tệp không dùng làm mốc chương. Metadata chỉ dùng gợi ý, không đổi schema, receipt hoặc quy trình lưu revision/quyền sở hữu.

Khi tác giả bấm gợi ý, màn nhập tìm lại tiêu đề duy nhất trong **văn bản hiện tại đã chỉnh sửa**, chọn cấp nông nhất có ít nhất hai tiêu đề. Tên sách/lời tựa được giữ thành phần mở đầu; tiêu đề cấp sâu hơn giữ trong nội dung chương. Tiêu đề trùng, thay tên không còn đối chiếu được, cấu trúc không rõ hoặc vượt 100 phần không được tách tự động; tác giả vẫn tách/gộp tại con trỏ. Gợi ý Chương/Chapter đánh số liên tiếp tiếp tục hoạt động.

Không thêm Markdown rendering hoặc rich-text import: giữ nguyên văn bản sau trích xuất, không hứa giữ ký hiệu/định dạng nguồn mà parser đã chuyển đổi. HTML/ảnh chưa hỗ trợ vẫn bị từ chối; không tải tài nguyên ngoài và không dùng AI. Gói gửi tới API vẫn là các chương đã được Author xem lại và xác nhận.

27 kiểm thử backend parser/import và 36 kiểm thử frontend liên quan đạt. Browser tải tệp MD thật, gợi ý phần mở đầu + Bến đầu + Chân trời, không tách heading trong code, lưu ba chương nháp rồi đọc lại từ MongoDB tạm. Sáng/tối 390/768/1024/1536px không tràn ngang. Còn nhập rich text và các cấu trúc tài liệu phức tạp khác; UC rộng vẫn Một phần.

### Sửa ranh giới khối Markdown ngày 18/10/2026

Parser bổ sung `numberedHeadings` từ các đoạn văn gốc, giúp frontend đối chiếu Chương/Chapter đánh số và từ chối gợi ý khi gặp tiêu đề chỉ nằm trong mã, trích dẫn, bảng hoặc danh sách Markdown. Những khối này vẫn giữ trong văn bản trích xuất. Metadata chỉ phục vụ gợi ý, không lưu thêm trường hay thay schema; bản thảo đánh số thông thường tiếp tục được tách sau thao tác của tác giả.

Lượt kiểm tra bổ sung: 33 backend và 41 frontend test liên quan đạt; lint, build, i18n và Prettier đạt. Browser kiểm tra ví dụ mã không bị tách, sau đó nhập bản thảo đánh số thật, lưu hai chương và mở lại danh sách từ MongoDB tạm. Sáng/tối tại 390/768/1024/1536px không tràn ngang; không có cảnh báo/lỗi console. Media được để cuối theo yêu cầu; không triển khai AI Author.

Khối mã (fenced hoặc thụt lề), danh sách và bảng được kết thúc bằng ngắt đoạn khi chuyển thành văn bản. Tiêu đề ngay sau khối không còn dính vào ký tự cuối, giúp đối chiếu metadata và tách chương đúng. Không đổi giao diện, schema hoặc cơ chế lưu bản nháp.

22 kiểm thử parser và 10 kiểm thử API nhập đạt; kiểm thử tích hợp tải Markdown thật qua preview, lưu hai chương vào MongoDB tạm rồi đọc lại qua API editor để đối chiếu nội dung. Lint và Prettier của các file sửa đạt. Đây là kiểm chứng parser/API, không phải nghiệm thu toàn bộ UC hay kiểm tra browser mới.

### Hủy nhập và giải phóng lượt phân tích ngày 18/10/2026

Buffer nguồn được xóa cả khi yêu cầu đã hủy trước khi tạo worker hoặc bị từ chối do đủ hai lượt phân tích. Kiểm thử xác nhận hủy hai worker trả lại đủ hai lượt cho yêu cầu tiếp theo, đồng thời xóa buffer của cả yêu cầu đang chạy và yêu cầu bị từ chối. Không thay giới hạn đồng thời, thời gian chờ, API hay schema.

35 kiểm thử parser/API nhập đạt; lint và Prettier của các file sửa đạt. Đây là bổ sung xử lý vòng đời parser, không thay UI hoặc triển khai media/AI.

## Kiểm chứng ngày 16/10/2026

- Kiểm thử parser dùng PDF/DOCX tự tạo, TXT/UTF-16/MD; từ chối tệp hỏng, sai mã hóa, PDF không có text, Markdown HTML/ảnh, quá dài, hủy và timeout.
- Fixture DOC công khai của word-extractor đã trích xuất được 188 ký tự bằng parser thật, không lưu fixture vào repository.
- API trên MongoDB replica set tạm kiểm tra lưu PDF/TXT, revision nháp, audit, provenance, ownership, CSRF, receipt giả, version stale, khóa nội dung, rollback và hai request đồng thời.
- UI kiểm tra upload File thật tới transport, tách/gộp nội dung, chọn truyện DB và giữ nội dung khi lưu lỗi.
- Browser đã nhập Markdown qua bộ chọn tệp, lưu thành nháp và mở danh sách thấy đúng nội dung/23 từ/liên kết editor. Light/dark, 390/768/1024 px không tràn ngang; không có warn/error console. Không nạp dữ liệu thử vào database nhóm.
- Bổ sung gợi ý tách chương: 19 kiểm thử liên quan đạt, bao gồm giữ nguyên từng ký tự, lời tựa, nội dung đã sửa, số La Mã/Ả Rập và từ chối trường hợp mơ hồ. Browser đã tạo phần mở đầu cùng hai chương và lưu đủ ba phần trên MongoDB tạm; 390/768/1024 px không tràn ngang, không có lỗi/cảnh báo console.
- Kiểm tra bản thảo dài: MongoDB tạm giữ đúng emoji, dấu tiếng Việt và khoảng trắng qua nhập, đọc editor và lưu revision mới. Browser đã lưu bản vượt 20.000 ký tự, reload và đối chiếu đầy đủ nội dung sau khi loại dấu phân cách đoạn do editor chèn; giữ nguyên emoji gia đình/dấu kết hợp và không có ký tự thay thế U+FFFD. Không có warn/error console.
- Lượt hồi quy bản thảo dài: 27 test backend (nhập, nội dung, định dạng, gửi duyệt) và 30 test frontend liên quan đạt. Kiểm tra frontend chạy tuần tự để tránh timeout khi chạy cùng lint/build trên máy phát triển. Lint hai workspace, i18n 1.148 khóa, build và diff check đạt. Các giới hạn 20.000 ký tự mỗi đoạn/1.000 đoạn mỗi chương được giữ nguyên.
