HOI THAO LIWAYWAY FINAL V6 — HOTFIX IMPORT PLAN 2026-10-15

Đã sửa theo lỗi phản hồi khi nhập kế hoạch Excel:
1. API importTournamentPlan chấp nhận các trạng thái chờ trong kế hoạch: “Chờ đội thắng/thua”, “Chờ BCH xác nhận nhóm”, “Chờ nhập thứ tự về đích”, đồng thời vẫn từ chối trạng thái không nằm trong danh sách cho phép.
2. Đọc đúng các cột DoiA_MaDoi, DoiB_MaDoi và Bang_Luot của sheet TRAN_DAU.
3. Giao diện đọc thêm sheet MON_THI_DAU và gửi danh sách môn cho API. API chỉ bổ sung mã môn chưa có, không sửa/ghi đè cấu hình môn đã tồn tại. Việc này xử lý lỗi “Không tồn tại mã môn MARATHON cho giải thưởng” khi mã môn bị thiếu trên Google Sheets.
4. Trận/giải thưởng đã tồn tại không bị xóa hoặc ghi đè. Mã đội vẫn phải khớp mã MaDoi thực tế trong DOI_THI_DAU; không tự tạo đội từ file kế hoạch.

CẬP NHẬT:
- Thay Code.gs và admin.html trong Apps Script project bằng hai file trong thư mục hoithao_upgrade.
- Giữ index.html hiện tại nếu không thay đổi phần đăng ký; ZIP kèm bản index hiện tại.
- Deploy phiên bản thử nghiệm mới, chạy trước trên bản sao Google Sheets.
- Mở Admin > Bốc thăm & bảng thi đấu > chọn lại Excel > Xem trước kế hoạch > Nhập kế hoạch an toàn.

KIỂM TRA ĐÃ LÀM:
- node --check Code.gs (đổi đuôi tạm sang .js): đạt.
- node --check script inline admin.html: đạt.
- Chưa thực thi Apps Script trực tiếp trên Google Sheets của công ty; cần chạy thử trên bản sao trước khi chuyển production.
