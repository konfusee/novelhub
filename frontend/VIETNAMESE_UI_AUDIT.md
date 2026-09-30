# Kế hoạch Việt hóa toàn bộ giao diện NovelHub

## Phạm vi quét

- 73 file JSX trong `src/components` và `src/pages`.
- Các file dữ liệu mock được JSX sử dụng cũng phải được kiểm tra.
- Việt hóa: nội dung hiển thị, nút, nhãn, tab, bộ lọc, placeholder, tooltip, ARIA, modal, toast, empty state, bảng, phân trang, breadcrumb, thông báo lỗi/thành công/xác nhận.
- Giữ nguyên dữ liệu động: tên truyện, tên tác giả, username và nội dung truyện/bình luận.

## Thứ tự thực hiện

| Batch | Khu vực | JSX | File có ứng viên tiếng Anh | Trạng thái |
|---|---|---:|---:|---|
| 1 | Hạ tầng ngôn ngữ + Header/Footer/Shell | 20 component dùng chung | 5 | Đang rà soát lần cuối |
| 2 | Guest + Auth | 7 | 7 | Đang thực hiện |
| 3 | Reader | 9 | 8 | Đang thực hiện |
| 4 | Author | 12 | 12 | Chưa hoàn tất |
| 5 | Moderator | 5 | 5 | Chưa hoàn tất |
| 6 | Admin | 6 | 6 | Chưa hoàn tất |
| 7 | System/Preview/Error | 5 | 3 | Chưa hoàn tất |

Số “ứng viên tiếng Anh” chỉ là chỉ báo quét tĩnh. Mỗi file vẫn phải được đọc đầy đủ vì chuỗi có thể nằm trong mảng, object dữ liệu, template string hoặc callback alert.

## Điều kiện đóng một batch

1. Đọc toàn bộ JSX trong batch và dữ liệu mock liên quan.
2. Không còn UI tiếng Anh, ngoại trừ dữ liệu động được phép giữ nguyên.
3. Không còn lựa chọn VI/EN hoặc trạng thái locale tiếng Anh.
4. Tooltip, ARIA, modal, toast, placeholder và trạng thái trống đã được Việt hóa.
5. Chạy `npm run i18n:check`, `npm run lint`, `npm run build`.
6. Chạy lại quét tĩnh và xem thủ công các route chính.
7. Commit riêng theo batch.

## Tiến độ đã hoàn thành

- Chỉ còn nguồn nội dung tiếng Việt; đã xóa `en.json` và LanguageSwitcher.
- Header/Footer/App Shell dùng tiếng Việt.
- Auth, Legal, Story Detail và phần lớn Guest Home/Search đã dùng nội dung tiếng Việt.
- Reader Library, Following, History, Notifications, Wallet, Audio Player và Guest Reader Preview đã được Việt hóa theo batch.
- Author Earnings và thiết lập giá chương đã dùng tiếng Việt.

## Vòng quét cuối

Sau khi hoàn thành Batch 1–7, chạy lại kiểm kê toàn bộ 73 JSX và mọi file `src/data/mock/*.js`. Chỉ đánh dấu hoàn tất khi không còn chuỗi giao diện tiếng Anh ngoài danh sách dữ liệu động được phép giữ nguyên.
