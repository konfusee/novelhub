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

Parser chạy trong worker riêng, tối đa hai worker đồng thời, giới hạn heap 128 MB và thời gian 15 giây. Hủy request hoặc hết giờ chấm dứt worker. Tệp nguồn xử lý trong bộ nhớ; không ghi tệp tạm, object storage, URL/path hoặc MediaAsset. Bộ đệm request được xóa sau khi xử lý; worker bị đóng trên cả nhánh thành công và thất bại.

Chỉ nội dung đã kiểm tra được lưu thành revision cùng checksum/audit tối thiểu. PDF dùng ContentImport `text-layer-pdf` hiện có. DOC/DOCX/TXT/MD ghi định dạng trong AuditEvent `text-import.<format>`; không gắn nhãn các định dạng này là PDF và không mở rộng enum/model.

PDF tối đa 100 trang; trang không có lớp văn bản bị từ chối, không OCR. TXT/MD nhận UTF-8 hoặc UTF-16 có BOM. Markdown được chuyển thành văn bản bằng lexer; không render HTML, không thực thi script, không tải liên kết hoặc ảnh. Markdown có HTML/ảnh bị từ chối rõ ràng. Word nhập nội dung chính, chú thích cuối trang/cuối tài liệu và hộp văn bản; không giữ header/footer, bình luận, ảnh hoặc định dạng chữ. Tác giả cần kiểm tra nội dung trước khi lưu và thực hiện khai báo quyền trong quy trình gửi duyệt hiện có.

Giới hạn còn lại: gợi ý tách chỉ hỗ trợ mẫu Chương/Chapter đánh số liên tiếp; chưa hiểu tiêu đề tự do, cấu trúc tùy ý hoặc bố cục tài liệu. Chưa giữ rich-text/bố cục và chưa có OCR. Không coi toàn bộ UC-AUT-05 đã nghiệm thu.

Parser tham chiếu: [unpdf](https://github.com/unjs/unpdf), [word-extractor](https://github.com/morungos/node-word-extractor), [Marked](https://github.com/markedjs/marked). Dependencies được khóa phiên bản trong package-lock.

## Kiểm chứng ngày 16/10/2026

- Kiểm thử parser dùng PDF/DOCX tự tạo, TXT/UTF-16/MD; từ chối tệp hỏng, sai mã hóa, PDF không có text, Markdown HTML/ảnh, quá dài, hủy và timeout.
- Fixture DOC công khai của word-extractor đã trích xuất được 188 ký tự bằng parser thật, không lưu fixture vào repository.
- API trên MongoDB replica set tạm kiểm tra lưu PDF/TXT, revision nháp, audit, provenance, ownership, CSRF, receipt giả, version stale, khóa nội dung, rollback và hai request đồng thời.
- UI kiểm tra upload File thật tới transport, tách/gộp nội dung, chọn truyện DB và giữ nội dung khi lưu lỗi.
- Browser đã nhập Markdown qua bộ chọn tệp, lưu thành nháp và mở danh sách thấy đúng nội dung/23 từ/liên kết editor. Light/dark, 390/768/1024 px không tràn ngang; không có warn/error console. Không nạp dữ liệu thử vào database nhóm.
- Bổ sung gợi ý tách chương: 19 kiểm thử liên quan đạt, bao gồm giữ nguyên từng ký tự, lời tựa, nội dung đã sửa, số La Mã/Ả Rập và từ chối trường hợp mơ hồ. Browser đã tạo phần mở đầu cùng hai chương và lưu đủ ba phần trên MongoDB tạm; 390/768/1024 px không tràn ngang, không có lỗi/cảnh báo console.
