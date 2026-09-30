HOI THAO 3 - V2

1. Thay Code.gs, index.html, admin.html vào project.
2. Deploy Web App version mới.
3. Chạy setupAdmin() một lần nếu chưa thiết lập Admin.
4. Lấy mật khẩu từ Execution log.
5. Có thể chạy testRouting() trong Apps Script để kiểm tra routing cơ bản.

Lưu ý:
- Không chạy trực tiếp doPost() bằng nút Run. Nếu chạy, hệ thống trả lỗi hướng dẫn thay vì TypeError.
- Frontend đăng ký gửi action=register.
- POST action lạ sẽ bị từ chối, không rơi nhầm vào luồng đăng ký.
- QR xác nhận trỏ về trang index.html hiện tại với ?code=..., sau đó trang gọi API verify.
