# Bộ dữ liệu mẫu Coins và mở khóa chương

Script dành cho development/test. Không chạy với `NODE_ENV=production`.

## Bộ dữ liệu

- 1 Admin demo và 1 tác giả demo, mật khẩu ngẫu nhiên lưu cục bộ.
- 3 Reader: đủ xu, thiếu xu và ví rỗng.
- 2 thể loại có tiền tố `[DEMO COINS]`.
- 2 truyện, tổng 7 chương: miễn phí, đang đọc sớm có phí, đọc sớm đã hết hạn.
- Bản xuất bản `blocks-v2`, hồ sơ xuất bản và xác nhận nội dung hư cấu tương ứng.
- 3 gói nạp: 10.000, 20.000 và 50.000 VND, đổi xu 1:1.
- Ví Reader và ví doanh thu tác giả; số xu ban đầu được ghi bằng ledger `adjustment`
  có nhãn demo. Không tạo giao dịch ngân hàng, không tạo đơn nạp đã thanh toán.
- Không cấp sẵn quyền mua chương, không giả lập doanh thu vào ví nền tảng.

Các trạng thái xuất bản là fixture demo trực tiếp, không phải quyết định kiểm duyệt
hay kết quả AI thực tế. Script không gọi SePay, OpenAI hoặc gửi email.

## Chạy xem trước

Từ thư mục gốc project:

```powershell
npm run db:seed-coins-demo --workspace=backend
```

Chế độ mặc định chỉ hiển thị kế hoạch, không kết nối hay ghi database.

## Chọn database rồi nạp

**Database demo riêng:** dùng cùng MongoDB server trong `backend/.env`, nhưng dữ liệu
được ghi vào database `novelhub_coins_demo`:

```powershell
npm run db:seed-coins-demo --workspace=backend -- --database novelhub_coins_demo --apply
```

Để app nhìn thấy database riêng này, cấu hình `MONGODB_URI` của app trỏ tới database
đó rồi khởi động lại backend. Script không tự sửa `.env` hoặc cấu hình ngân hàng.

**Database đang dùng:** chỉ dùng sau khi đã quyết định thêm demo vào dữ liệu hiện tại:

```powershell
npm run db:seed-coins-demo --workspace=backend -- --current-db --apply
```

Script tạo collections/indexes cần thiết theo model, không drop indexes/collections.
Nó thêm dữ liệu trong một transaction và từ chối nếu ID/email demo bị trùng dữ liệu
khác. Cần MongoDB replica set và quyền ghi trên database đã chọn.

## Thông tin đăng nhập và đường dẫn truyện

Sau khi nạp, terminal in đường dẫn hai file trong `backend/.tmp/`:

- `novelhub-coins-demo-v1-<database>.credentials.json`: email và mật khẩu demo.
- `novelhub-coins-demo-v1-<database>.manifest.json`: ID, đường dẫn truyện/chương,
  bản xuất bản, giá và thời hạn đọc sớm.

Thư mục `.tmp` đã bị Git bỏ qua. Không đưa file mật khẩu vào commit hoặc gửi nó cho
người khác. Các tài khoản demo được xác minh email sẵn để có thể đăng nhập.

| Email                            | Vai trò / tình huống                 |
| -------------------------------- | ------------------------------------ |
| `reader.coins-demo@example.test` | Reader đủ xu, tối thiểu 5.000 xu     |
| `poor.coins-demo@example.test`   | Reader ít hơn giá chương cơ bản 1 xu |
| `empty.coins-demo@example.test`  | Reader có ví 0 xu                    |
| `author.coins-demo@example.test` | Tác giả sở hữu hai truyện demo       |
| `admin.coins-demo@example.test`  | Quản trị demo                        |

Giá và thời gian đọc sớm được chọn trong giới hạn chính sách hiện có. Nếu chưa có
chính sách đang hiệu lực, script tạo một chính sách mặc định cho bộ demo. Nó không
sửa chính sách đang hoạt động. Nếu chính sách không cho phép tạo tình huống này,
script báo lỗi và rollback.

## Chạy lại

Chạy lại cùng lệnh không tạo thêm bản sao, không reset mật khẩu, không nạp bù xu đã
tiêu và không kéo dài thời hạn chương. Bộ dữ liệu được nhận diện bằng ID cố định
và sự kiện audit `demo.coins.seeded`. Nếu cần kiểm thử sau khi chương đã hết hạn,
hãy tạo chương mới qua luồng tác giả; script không tự sửa bản xuất bản cũ.

## Kiểm thử

```powershell
npm test --workspace=backend -- test/coins-demo-seed.test.js
```

Test dùng MongoDB tạm của bộ kiểm thử, không dùng database trong `.env`. Test kiểm
tra nội dung đọc được/bị khóa, dữ liệu đối chiếu giá, khả năng đăng nhập, tính chạy
lại không đổi số dư và việc giữ nguyên dữ liệu đã có.
