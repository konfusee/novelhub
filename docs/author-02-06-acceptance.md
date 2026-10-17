# Nghiệm thu UC-AUT-02 đến UC-AUT-06

Ngày kiểm tra: 18/10/2026. Theo yêu cầu chủ dự án, media không tính vào mức độ hoàn thiện. Các hạng mục media được để cuối; AI Author và worker bằng chứng AI tiếp tục tạm hoãn. Không thay schema backend.

## Phạm vi hoàn thiện

| Use case | Phạm vi đã triển khai và kiểm tra | Kết quả theo phạm vi hiện tại |
| --- | --- | --- |
| UC-AUT-02 | Tạo, đọc, sửa tên/mô tả/thể loại; metadata có version; bảo vệ quyền sở hữu, lưu trữ/khôi phục; bản nháp không thay bản công khai | Hoàn thiện ngoài media |
| UC-AUT-03 | Tạo và lưu chương chưa viết xong; sửa, đọc lại, nhân bản, sắp xếp nháp, lưu trữ/khôi phục, xóa nháp giữ lịch sử; xử lý xung đột phiên bản | Hoàn thiện ngoài media |
| UC-AUT-04 | Cấu trúc văn bản và giới hạn được kiểm tra; rich-text heading/paragraph/quote/scene-break và bold/italic/underline; phản hồi checklist trước gửi, liên kết sửa lỗi; không lưu đè mất định dạng | Hoàn thiện ngoài media |
| UC-AUT-05 | PDF có text, DOC/DOCX/TXT/MD qua parser thật; xem lại/sửa/tách/gộp/chọn chương rồi lưu nháp; quyền, receipt, version, rollback, replay, hủy và giới hạn worker | Hoàn thiện ngoài media |
| UC-AUT-06 | Toàn bộ quản lý multimedia thuộc media | Tạm hoãn, không tính vào tỷ lệ |

Đối chiếu `docs/source/use-case-list.md` và FR-AUTHOR-02–11 trong `docs/source/novelhub_requirements_spec.md`. Bìa/banner, ảnh/audio và vòng đời media không còn là điều kiện ngăn hoàn thiện các use case văn bản. Không coi UC-AUT-06 đã triển khai xong. Giữ nguyên các yêu cầu nguồn để theo dõi phần tạm hoãn.

Giữ bố cục Word/PDF, nhập rich-text từ tài liệu và OCR không thuộc yêu cầu trích xuất thành bản nháp văn bản có thể sửa của UC-AUT-05. Không đánh đồng các tính năng mở rộng này với lỗi của luồng nhập hiện có. Phê duyệt/phát hành, early access và tài chính có use case riêng; không dùng chúng để hạ mức độ của CRUD chương/nháp hoặc kiểm tra định dạng.

## Kết quả chạy thực tế

- Backend: 92 kiểm thử đạt trong 9 file: workspace truyện, vòng đời truyện, thứ tự chương, vòng đời chương, nháp, định dạng, submissions, import và extraction. Dùng MongoDB replica set tạm, không ghi fixture vào database nhóm.
- Frontend: 141 kiểm thử đạt trong 14 file của các trang tạo/quản lý truyện, editor, sắp xếp/vòng đời/xung đột chương, rich editor/DOM, nháp, checklist gửi và nhập tài liệu/chia đoạn.
- Lint các file sửa, i18n 1.695 khóa, build và Prettier đạt.
- Bằng chứng browser đã có trong các tài liệu vòng đời, rich editor và nhập tài liệu: lưu/đọc lại MongoDB, xung đột, preview và responsive sáng/tối. Lượt browser gần nhất kiểm tra nhập hai chương thật, bỏ qua ví dụ mã, 390/768/1024/1536px và console không lỗi. Lượt nghiệm thu này chạy lại kiểm thử tự động; không tuyên bố đã chạy lại toàn bộ browser flow.

## Bổ sung khi nghiệm thu

Luồng nhập chỉ báo thành công khi response trả đúng truyện, đúng số chương đã chọn và các ID chương không rỗng/trùng. Phản hồi thiếu hoặc không nhất quán giữ nguyên bản thảo đang xem và hướng dẫn kiểm tra kho nháp trước khi thử lại. Receipt/idempotency hiện có trên máy chủ được giữ nguyên.
