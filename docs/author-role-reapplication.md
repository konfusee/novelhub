# Xin cấp lại quyền Author sau thu hồi

Kiểm chứng ngày 18/10/2026, thuộc vòng cấp/thu hồi của A-UC-02. Media và AI tiếp tục tạm hoãn.

`GET /auth/author-application` giữ nguyên đơn và quyết định lịch sử, bổ sung `access.activeAuthor` và `access.canApply` từ quyền đang hoạt động và điều kiện tài khoản thực. Không suy luận quyền Author hiện tại chỉ từ trạng thái approved của đơn cũ.

Trang đăng ký hiển thị biểu mẫu gửi đơn mới khi đơn cũ approved nhưng API xác nhận không còn quyền Author và tài khoản đủ điều kiện xin lại. Vẫn phải xác nhận thỏa thuận; chỉ thông báo pending sau khi POST thành công. Response thiếu metadata mới không tự biến đơn approved thành đơn có thể xin lại. Không thay bố cục hoặc schema.

Admin xét đơn mới theo transaction/version và kiểm tra vai trò hiện có như trước. Quyền mới là một RoleAssignment mới; giữ vai trò revoked và đơn đã duyệt cũ. Các phiên đăng nhập trước khi thu hồi/cấp lại không tự sống lại. everAuthor vẫn được giữ. Truyện cũ đã đóng băng do thu hồi quyền không tự mở lại, chương/gói đã hủy không tự phát hành hoặc quay lại hàng đợi.

## Kiểm tra

- 13 test author-access và 12 test author-role-revocation đạt qua các lượt kiểm tra tập trung trên MongoDB tạm. Test vòng mới đi qua nộp đơn → duyệt → thu hồi → phiên mới → đọc điều kiện xin lại → nộp đơn mới → duyệt, rồi đối chiếu lịch sử, role active/revoked và trạng thái đóng băng.
- 3 test frontend kiểm tra form xin lại, điều kiện thỏa thuận, gửi đơn pending và không mở form từ approval thiếu xác nhận máy chủ.
- Lint, i18n 1.729 khóa, build và Prettier đạt.
- Browser với tài khoản cựu Author trong MongoDB tạm đọc đúng thông báo quyền không còn hiệu lực và biểu mẫu mới. Sáng/tối 390/768/1024/1536px không tràn ngang, console không warn/error. Không gửi thỏa thuận qua browser; luồng nộp/duyệt được kiểm tra bằng API integration và component tests.

Không đánh dấu toàn bộ Admin A-UC-01–11 hoặc Author UC-AUT-07–11 hoàn thiện từ riêng bước này. Các nghiệp vụ đóng tài khoản/tài chính và vòng quyết định kiểm duyệt vẫn là công việc riêng.
