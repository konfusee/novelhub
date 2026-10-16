# Frontend tests

Đặt toàn bộ unit/component test tại `frontend/test`, tách khỏi mã ứng dụng trong `frontend/src`. Giữ cấu trúc thư mục tương ứng để tìm test theo chức năng:

```text
src/pages/author/ChapterEditorPage.jsx
test/pages/author/ChapterEditorPage.test.jsx

src/components/account/AccountSessions.jsx
test/components/account/AccountSessions.test.jsx
```

Import component và mock module từ đường dẫn thật dưới `src`. Vitest chỉ nhận `test/**/*.{test,spec}.{js,jsx}`; không đặt file test mới trong `src`.

Chạy từ root `novelhub`:

```powershell
npm test -w frontend
npm test -w frontend -- test/pages/author/ChapterEditorPage.test.jsx
```

Backend đã có thư mục riêng `backend/test`, giữ nguyên cấu trúc đó.
