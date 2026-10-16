# So sánh và gộp khi bản nháp thay đổi

Commit chức năng: `88dccb8`. Khi PUT chương trả 409 `stale_content`, editor giữ nguyên title/body chưa lưu, chặn ghi lại bằng version cũ qua cả nút Lưu và Ctrl/Cmd+S. Tạm chặn thêm chương và gửi duyệt để tránh điều hướng với bản chưa lưu; tác giả vẫn có thể sửa văn bản hoặc xem trước.

Nút **So sánh với bản mới** tải lại chương qua GET theo đúng storyId/chapterId. Hộp thoại hiển thị title/body đầy đủ của bản đã lưu ở cột chỉ đọc và bản muốn giữ ở cột chỉnh sửa. Tác giả chủ động gộp, xác nhận đã đối chiếu rồi đưa bản gộp về editor. Mỗi lần sửa bản gộp hoặc tải lại bản đã lưu đều bỏ xác nhận cũ. Hủy gộp giữ nguyên bản trên editor trước khi mở hộp thoại; phần chỉnh sửa riêng trong hộp thoại bị bỏ.

Áp dụng không gửi PUT: editor chỉ nhận nội dung gộp và version vừa đọc, vẫn báo chưa lưu. Tác giả bấm Lưu riêng để tạo revision mới bằng API hiện có. Nếu có cập nhật khác trong thời gian so sánh, server tiếp tục chặn bằng version và yêu cầu so sánh lại. Không tự chọn bản thắng, ghi đè âm thầm hoặc bỏ kiểm tra phiên bản.

Lỗi GET, nội dung chưa hỗ trợ, response sai chapter/story hoặc chương không còn editable không cho áp dụng. Lỗi tải lại giữ nội dung đang gộp trong state để thử lại; hủy luôn có sẵn. Không thay schema, API, quyền, shell hoặc dependencies. Chỉ hỗ trợ editor paragraph hiện tại, không đánh dấu canonical rich-text AST hoàn thiện.

Kiểm tra 16/10/2026: 17 test frontend liên quan đạt, bao phủ đọc đủ nội dung, sửa/gộp có xác nhận, không ghi khi áp dụng, version sau refresh, loading/error/locked/wrong chapter/unsupported/missing, giữ bản local khi stale, chặn lưu lại và lưu riêng bằng baseline mới. Lint frontend, i18n 1.204 khóa, build, Prettier và diff check đạt.

Browser sử dụng MongoDB replica set tạm: hai thẻ cùng chương, thẻ thứ hai lưu trước, thẻ thứ nhất gặp 409, mở so sánh thấy hai thay đổi khác nhau, hủy giữ bản local, gộp cả hai thay đổi, áp dụng chưa lưu, lưu riêng rồi reload đọc đủ nội dung từ MongoDB. Kiểm tra light/dark và 390/768/1024 px không tràn ngang; thao tác bằng bàn phím. Lượt console sau reload cuối không có warn/error. Không ghi fixture vào database nhóm.

UC-AUT-04 tiếp tục ở mức Một phần. Bằng chứng commit này được ghi tại đây và kế hoạch; workbook chưa ghi thêm commit vì có file khóa Excel đang mở tại thời điểm chốt chức năng.
