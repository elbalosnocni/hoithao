HOI THAO - V4

Nâng cấp:
- Admin quản lý môn thi đấu bằng Sheet MON_THI_DAU + giao diện Admin.
- Có thể thêm/sửa/khóa/xóa môn; cấu hình hình thức, min/max người, nội dung, thể thức, số bảng.
- Không xóa vật lý môn đã có đăng ký; hệ thống chuyển sang Khóa để bảo toàn dữ liệu.
- DSKD/DSDK cũ được giữ nguyên.
- Sau mỗi đăng ký thành công, backend tự đồng bộ DOI_THI_DAU và VAN_DONG_VIEN.
- Admin có thể đồng bộ thủ công DSDK → đội/VĐV.
- Sinh bảng loại trực tiếp cho môn đội nhóm và tự đẩy đội thắng sang vòng tiếp theo.
- Môn cá nhân có danh sách kết quả trong KET_QUA.
- Có quản lý hạn đăng ký, đổi mật khẩu, dashboard, đội, VĐV, bảng đấu, kết quả.

DEPLOY:
1. Mở Apps Script project và thay Code.gs bằng file mới.
2. Thay index.html và admin.html.
3. Chạy setupAdmin() một lần. Xem Execution log để lấy mật khẩu Admin.
4. Deploy > New deployment > Web app; Execute as Me; Who has access: Anyone.
5. Cập nhật đúng WEB_APP_URL trong index.html/admin.html nếu deployment URL thay đổi.
6. Mở admin.html, đăng nhập, kiểm tra MON_THI_DAU và deadline.
7. Nếu project cũ đã có DSDK, chạy Admin > Cài đặt > Kiểm tra/tạo Sheet hệ thống hoặc nút Đồng bộ.

LƯU Ý:
- Bản V4 không còn dùng GAME_LIMITS hard-code.
- Mã môn là khóa ổn định; không đổi mã sau khi đã có dữ liệu nếu không cần thiết.
- Nút "Tạo lại bảng" xóa các trận cũ của môn rồi sinh lại, chỉ dùng trước khi bắt đầu/khóa kết quả.
- Luật trận hòa hiện yêu cầu nhập kết quả không hòa; nếu môn có tie-break riêng có thể mở rộng sau.
