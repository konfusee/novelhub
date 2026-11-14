# Frontend local với API deploy qua Cloudflare

API nhóm: `https://novelhub-api.maylink.net`.
Frontend local: `http://localhost:5173`.

## Chạy trên máy thành viên

Tạo `frontend/.env.local` (Git bỏ qua) với:

```dotenv
VITE_API_BASE_URL=/api
DEV_API_TARGET=https://novelhub-api.maylink.net
```

Tại thư mục gốc:

```powershell
npm run dev --workspace frontend -- --strictPort
```

Không cần chạy backend local khi dùng API deploy. Vite chuyển yêu cầu `/api/...`
đến đúng đường dẫn `/api/...` trên server. Target không có hậu tố `/api` để tránh
lặp đường dẫn. Giữ request của trình duyệt cùng origin giúp cookie phiên hoạt
động với `SameSite=Lax`; không cần thay chính sách cookie trên server.

Đổi file env hoặc config thì khởi động lại frontend. Nếu cổng 5173 đã có một
frontend chạy, dùng terminal của tiến trình đó để dừng/chạy lại thay vì mở thêm.
`DEV_API_TARGET` chỉ dùng ở Vite dev/preview; không được nhúng làm biến client.
`--strictPort` giữ đúng cổng 5173. Nếu cổng đang bận, lệnh sẽ báo lỗi thay vì tự
chuyển sang 5174; origin khác cổng có thể bị cấu hình CORS/CSRF của API từ chối.
Vite preview cũng dùng cùng proxy. Khi deploy frontend dạng static, máy chủ
frontend phải có reverse proxy `/api` tương ứng; Vite dev proxy không phải
cấu hình production hosting.

Muốn trở lại backend local, sửa riêng `.env.local`:

```dotenv
VITE_API_BASE_URL=/api
DEV_API_TARGET=http://localhost:4000
```

Nếu không khai báo target, config vẫn mặc định `http://localhost:4000`, nên không
buộc các thành viên khác chuyển backend. Tên biến client hiện dùng là
`VITE_API_BASE_URL`; `VITE_API_URL` của service Axios cũ không cấu hình client này.

## Kiểm tra kết nối

- `GET http://localhost:5173/api/ready` phải trả `200`, database `connected`.
- `GET http://localhost:5173/api/catalog/stories` phải trả dữ liệu từ API deploy.
- Đăng nhập và tải lại trang để kiểm tra cookie còn hiệu lực. `401` ở
  `/api/auth/me` trước đăng nhập là kết quả bình thường.
- CORS/CSRF trên backend phải tiếp tục cho phép `http://localhost:5173`, đồng thời
  giữ các origin khác mà nhóm đang sử dụng. Không bật wildcard thay cho danh sách.

## SePay: thao tác trên máy chạy backend của nhóm

Cloudflare Tunnel chuyển traffic tới backend ở máy thành viên khác. File
`backend/.env` trên máy frontend không thay đổi cấu hình backend đó.

Người chạy backend cần kiểm tra và bổ sung các giá trị thật sau tại môi trường
backend của họ; không gửi key qua chat hoặc commit lên Git:

```dotenv
TOPUP_BANK_BIN=<BIN ngân hàng, 6 chữ số>
TOPUP_BANK_NAME=<tên gateway đúng như giao dịch SePay>
TOPUP_BANK_ACCOUNT_NUMBER=<tài khoản nhận liên kết SePay>
TOPUP_BANK_ACCOUNT_NAME=<chủ tài khoản>
SEPAY_WEBHOOK_API_KEY=<key bí mật trùng cấu hình webhook SePay, tối thiểu 32 ký tự>
```

Khởi động lại backend để nạp env. Trong SePay, cấu hình:

- URL: `https://novelhub-api.maylink.net/api/webhooks/sepay`.
- Method: `POST`.
- Authentication: API Key; cùng key trên backend (`Authorization: Apikey <key>`).
- Chọn tài khoản nhận đúng; bảo đảm bộ lọc mã nhận được mã `NHxxxxxxxx` của đơn.

Với code hiện tại, khi thiếu key, webhook trả `503`; có key nhưng request không
gửi key hoặc gửi sai sẽ trả `401`. Kiểm tra không-key bằng payload rỗng không tạo
giao dịch. Để xác nhận toàn bộ nạp xu, sau cấu hình cần một đơn nạp hợp lệ và
webhook thật của SePay; không gửi payload giả hợp lệ vào database nhóm để thử.

Backend và Cloudflare Tunnel trên máy thành viên đó phải hoạt động thì API mới
truy cập được. URL public này thay cho ngrok đối với webhook, nhưng vẫn phụ thuộc
máy đang chạy Tunnel/backend. Giữ `PAYOUT_WORKER_ENABLED=false` ở backend phát
triển thông thường; chỉ backend được nhóm chọn thực hiện giả lập chi trả mới bật.

## Kết quả kiểm tra 2026-11-13

Frontend local đã proxy thành công tới API deploy: readiness `200`, catalog `200`.
Đăng nhập bằng tài khoản thử nghiệm và tải lại trang vẫn giữ phiên. Webhook trên
API deploy ban đầu trả `503`, nhưng lần kiểm tra cuối đã trả `401` khi không gửi
key: backend đã bật kiểm tra API key. Chưa xác minh key trong dashboard SePay có
trùng với backend, hoặc thực hiện chuyển khoản thật để kiểm tra QR và cộng xu.
