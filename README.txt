HOI THAO LIWAYWAY 2026 - V5 UPGRADE

Bo nay lay backend/quan tri day du cua V4 (coban) lam nen va nang cap:
- Khong dong bo doi/VDV nang ngay trong request dang ky cong nhan.
- Frontend co timeout, retry, xu ly response khong phai JSON va thong bao Failed to fetch ro rang.
- Loading overlay va loading theo tung nut admin.
- Admin tai du lieu ban dau theo batch, khong goi hang loat request tuan tu.
- Tu dong xu ly session Admin het han.
- Cache nhan vien V4 va nut lam moi du lieu.
- Backend giu nguyen cac chuc nang quan ly mon, doi, VDV, bang dau, ket qua, deadline, mat khau.
- Them doGet action health va doOptions de chan loi kho hieu khi kiem tra API.

LUU Y:
1. Thay Code.gs, index.html, admin.html trong Apps Script/GitHub theo dung bo nay.
2. Deploy lai Web App -> Execute as Me -> Who has access: Anyone.
3. Lay URL /exec moi neu deployment tao URL moi va cap nhat trong ca index.html/admin.html.
4. Chay setupAdmin() va setupSystem() mot lan trong Apps Script neu day la deployment moi.
5. Sau khi dang ky, du lieu dang ky duoc luu ngay. Viec dong bo doi/VDV duoc lam tu Admin bang nut "Dong bo du lieu".


NÂNG CẤP BỔ SUNG (bản chỉnh sửa):
1. Cổng đăng ký yêu cầu xác minh CCCD/CMND khớp cột CCCD ở cột F (index 5) của tab DSCNV. Mã truy cập được lưu trong sessionStorage và cache Apps Script trong 4 giờ.
2. CCCD trong kết quả tìm kiếm/giao diện chỉ hiển thị dạng che thông tin và 3 số cuối. API getEmployees không trả danh sách nếu chưa có access token.
3. Admin > Cài đặt có chức năng đọc Excel .xlsx/.xls/.csv, xem trước rồi nhập danh sách đăng ký. File cần có các tiêu đề cột được mô tả trong giao diện. Nên thử file nhỏ trước.
4. Tạo bảng thi đấu có bốc thăm ngẫu nhiên Fisher–Yates. Nếu thể thức có “bảng/vòng bảng” hoặc cấu hình nhiều bảng/đội mỗi bảng, hệ thống lập lịch vòng tròn trong từng bảng; nếu không, dùng nhánh loại trực tiếp.

CẬP NHẬT TRIỂN KHAI:
- Sao lưu Google Sheet trước khi chạy bản mới.
- Thay nội dung Code.gs và 2 file HTML tương ứng trong Apps Script/GitHub Pages.
- Deploy lại Apps Script Web App (Execute as: Me; Who has access: Anyone) và cập nhật URL /exec ở cả index.html và admin.html nếu URL deployment thay đổi.
- Chạy setupAdmin() chỉ khi cần tạo lại mật khẩu Admin; mật khẩu được ghi trong Execution log. Nếu hệ thống đã có mật khẩu Admin, không chạy lại trừ khi muốn đổi/reset.
- Lưu ý: chức năng nhập Excel nhập các dòng hợp lệ vào DSDK; cần đối chiếu tiêu đề/cột thực tế của file Excel trước khi nhập chính thức.

BỔ SUNG GIAO DIỆN BỐC THĂM + EXCEL MẪU:
- Admin > Bảng thi đấu: chọn môn Đội nhóm rồi bấm nút "BỐC THĂM NGẪU NHIÊN". Hệ thống sẽ xáo trộn danh sách đội và tạo lịch theo cấu hình môn. Bốc thăm lại sẽ thay thế lịch cũ của môn đó.
- Admin > Cài đặt: bấm "Tải Excel mẫu đăng ký" để tải file mẫu trực tiếp; trong ZIP cũng kèm file Mau_Import_Dang_Ky_Hoi_Thao.xlsx.
- Xóa các dòng ví dụ trong Excel trước khi nhập dữ liệu thật. Nên thử ít dòng trước.
