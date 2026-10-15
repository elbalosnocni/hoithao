HOTFIX V7.1 — sửa lỗi số cột khi tải bảng theo lượt

Nguyên nhân:
Sheet KET_QUA có 10 cột theo RESULT_HEADERS, nhưng ba nhánh tạo dòng kết quả (danh sách VĐV cá nhân và danh sách đội cho Jumbo/LHG) lại tạo mảng 11 phần tử. Khi gọi setValues với range 10 cột, Google Sheets báo: “The number of columns in the data does not match the number of columns in the range. The data has 11 but the range has 10.”

Đã sửa:
- generateIndividualEntries_: tạo đúng 10 giá trị.
- prepareResultEntries_: cả nhánh cá nhân và nhánh đội tạo đúng 10 giá trị.
- Không xóa dòng hoặc kết quả hiện có; chỉ sửa cấu trúc các dòng mới được tạo.
- Giữ nguyên giao diện Jumbo/LHG và logic kéo co.

Cập nhật:
1. Sao lưu Apps Script và Google Sheets.
2. Thay Code.gs bằng Code.gs trong gói này.
3. Deploy phiên bản Web App mới.
4. Kiểm thử trên bản sao: Admin > Bảng đấu > chọn Jumbo hoặc LHG. Kiểm tra tải bảng theo lượt, lưu theo lô và đối chiếu sheet KET_QUA.

Kiểm tra cú pháp: Node.js syntax check passed cho Code.gs và các script trong admin.html.
Chưa xác nhận tích hợp trực tiếp trên Google Sheets của công ty; cần chạy thử trên bản sao trước khi triển khai thật.
