8. Kiểm tra bảng KET_QUA: cột ThanhTich lưu thời gian, XepHang lưu thứ hạng, GhiChu lưu tên lượt và ghi chú.

Định dạng thời gian
- 00:45.32 = 45.32 giây
- 1:02.50 = 62.5 giây
- 45.32 = 45.32 giây
Thời gian cần nhất quán cùng cách nhập trong một lượt. Nếu thời gian bằng nhau, hệ thống báo lỗi để trọng tài xác nhận thứ hạng thủ công.

Lưu ý
- Thứ hạng tự động chỉ được tính khi các dòng có thời gian hợp lệ trong batch không có thứ hạng thủ công; các dòng chưa có thời gian không ngăn việc xếp hạng những đội đã hoàn thành.
- Mã đội phải tồn tại trong DOI_THI_DAU. Nếu danh sách đội chưa được đồng bộ, chạy đồng bộ hoặc nhập kế hoạch an toàn trước.
- Đây là bản mã nguồn đã kiểm tra cú pháp và mô phỏng logic cục bộ. Chưa có kết nối thực tế đến Google Sheets của công ty trong môi trường tạo ZIP. Bắt buộc kiểm thử trên bản sao trước khi dùng production.
