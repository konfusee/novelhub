const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );

export function renderOtpEmail({ otp, expiresInMinutes, purpose }) {
  if (!/^\d{6}$/.test(otp)) throw new Error('OTP email requires six digits');
  if (!Number.isFinite(expiresInMinutes) || expiresInMinutes <= 0)
    throw new Error('OTP email requires a valid expiry');
  const recovery = purpose === 'password-reset';
  const title = recovery ? 'Đặt lại mật khẩu' : 'Xác minh bảo mật';
  const description = recovery
    ? 'Bạn vừa yêu cầu đặt lại mật khẩu NovelHub. Dùng mã bên dưới để tiếp tục.'
    : 'Dùng mã bên dưới để hoàn tất yêu cầu xác minh trên NovelHub.';
  const expiry = escapeHtml(expiresInMinutes);
  return {
    text: `${title} · NovelHub\n\n${description}\n\nMã xác thực của bạn:\n${otp}\n\nMã có hiệu lực trong ${expiresInMinutes} phút và chỉ dùng một lần.\nSao chép 6 chữ số ở trên, quay lại NovelHub và dán vào ô mã xác minh.\nKhông chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không yêu cầu xác minh, hãy bỏ qua email này.`,
    html: `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · NovelHub</title></head>
<body style="margin:0;padding:0;background-color:#f8f5ee;color:#172334;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Mã xác minh NovelHub của bạn có hiệu lực trong ${expiry} phút.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f5ee;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fffdfa;border:1px solid #ded6ca;border-radius:24px;">
        <tr><td style="padding:28px 24px 24px;border-bottom:1px solid #eee8de;">
          <span style="font-size:24px;font-weight:700;letter-spacing:-1px;">Novel<span style="color:#2d7d6b;">Hub</span></span>
          <p style="margin:8px 0 0;font-size:12px;color:#6b7483;">Đọc · Nghe · Sáng tác · Kết nối</p>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:2px;color:#2d7d6b;">BẢO MẬT TÀI KHOẢN</p>
          <h1 style="margin:0 0 14px;font-size:28px;line-height:36px;letter-spacing:-1px;">${title}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:24px;color:#6b7483;">${description}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edf4ef;border:1px solid #c9ded5;border-radius:16px;">
            <tr><td align="center" style="padding:22px 12px;">
              <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#456257;">MÃ XÁC MINH CỦA BẠN</p>
              <div style="font-size:40px;line-height:52px;font-weight:700;color:#215e50;font-family:Consolas,'Courier New',monospace;"><span dir="ltr" style="white-space:nowrap;user-select:all;-webkit-user-select:all;">${otp}</span></div>
              <p style="margin:12px 0 0;font-size:13px;line-height:20px;color:#456257;">Có hiệu lực trong <strong>${expiry} phút</strong> · Dùng một lần</p>
            </td></tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;line-height:21px;color:#6b7483;text-align:center;">Nhấp đúp vào mã trên máy tính hoặc nhấn giữ trên điện thoại, rồi chọn <strong style="color:#172334;">Sao chép</strong>.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr><td style="padding-top:20px;border-top:1px solid #eee8de;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Tiếp tục trên NovelHub</p>
              <p style="margin:0;font-size:14px;line-height:23px;color:#6b7483;">Quay lại cửa sổ đang xác minh và dán mã vào ô nhập. Trên máy tính, dùng <strong>Ctrl + V</strong> hoặc <strong>⌘ + V</strong>.</p>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;padding:14px 16px;background-color:#fff3e7;border-radius:12px;font-size:13px;line-height:21px;color:#795b43;">Không chia sẻ mã với bất kỳ ai. NovelHub sẽ không yêu cầu bạn gửi mã qua tin nhắn hay điện thoại.</p>
        </td></tr>
        <tr><td style="padding:20px 24px;border-top:1px solid #eee8de;font-size:12px;line-height:20px;color:#6b7483;">Nếu bạn không yêu cầu xác minh, hãy bỏ qua email này.<br>Đây là email tự động từ NovelHub.</td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#6b7483;">NovelHub · Những câu chuyện làm ngày mai thêm tử tế.</p>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
