HOI THAO LIWAYWAY 2026 - FINAL V6
=================================

THANH PHAN
- Code.gs: backend Google Apps Script
- admin.html: giao dien quan tri; import ke hoach, ket qua theo lo, in phieu trong tai, xuat Excel tong ket
- index.html: cong dang ky (giu giao dien/chuc nang co san)
- Mau_Import_Dang_Ky_Hoi_Thao.xlsx: mau nhap dang ky hien co
- Ke_hoach_thi_dau_Liwayway_2026_FINAL.xlsx: workbook du lieu ke hoach, tran dau, VDV va giai thuong

CAC SUA DOI CHINH
1. Sua ghi ket qua tran: ghi dung H:N; giu CreatedAt cot M va cap nhat UpdatedAt cot N.
2. Chan tao lai bang neu da ton tai tran; khong xoa tran cu. Chan sua ket qua da chot de tranh sai nhanh.
3. API importTournamentPlan: validate MaMon, MaTran, DoiA/DoiB, vong, trang thai; chi them tran moi. Tran trung ma/lich khac/ma doi khong hop le se bao loi theo dong. Giai thuong duoc nhap them qua sheet GIAI_THUONG, khong ghi de ma giai cu.
4. KECO: diem hiep chi hop le 2-0 hoac 2-1, khong chap nhan hoa. Neu MaTran theo ma ke hoach KECO-M01...M16, he thong chuyen doi vao nhanh tiep theo va dua doi thua ban ket vao tran tranh ba neu cac tran dich ton tai.
5. MARATHON: neu nhap thanh tich dang so giay/phut:giay va de trong xep hang, he thong tu xep theo thoi gian tang dan tach theo gioi tinh. Neu hai thanh tich bang nhau, he thong bao loi de trong tai xac nhan thu hang; neu nhap xep hang thu cong, kiem tra trung hang theo gioi tinh.
6. JUMBO/LHG: neu nhap thanh tich so va de trong xep hang, he thong xep tang dan theo nhom/luot. Nhap ten nhom/luot vao GhiChu de tinh rieng tung nhom; neu khong co nhom thi xep chung. Khong cho luu ty so doi khang cho hai mon nay; dung tab Ket qua de nhap thanh tich.
7. Tao dong ket qua con thieu khong xoa dong/kq cu; luu theo lo tra loi tung dong loi.
8. In phieu trong tai tren trinh duyet; xuat XLSX gom Tong_quan, Tran_dau, Ket_qua, Giai_thuong.
9. Co co che kiem thu ban sao Google Sheets: createTestCopy(), getSpreadsheetMode(), runSandboxSelfTests(), useProductionSpreadsheet().

QUY TRINH BAT BUOC KIEM THU TREN BAN SAO
---------------------------------------
A. Sao luu file Google Sheets hien tai thu cong truoc khi thay code.
B. Cap nhat Code.gs trong Apps Script va admin.html tren GitHub Pages. Dung deployment test Web App rieng neu co the.
C. Trong Apps Script, chay createTestCopy() mot lan va cap quyen. Ham nay tao ban sao cua file dang ky, chuyen SPORTS_TEST_MODE=true; cac API doc/ghi cua he thong se su dung ban sao nay. Ham tra ve URL ban sao.
D. Chay runSandboxSelfTests() trong Apps Script. Ket qua mong doi: allPassed=true; kiem tra header, ma tran/ket qua trung, trang thai va ghi ket qua dung cot H:N. Neu false, khong trien khai san xuat; doc checks[].detail de sua.
E. Mo Admin, dang nhap va xac nhan banner CHẾ ĐỘ KIỂM THỬ. Thu cac thao tac: tai danh sach, import 1-2 tran co ma doi dung, thu dong ma tran trung, thu ma doi sai, luu ket qua keo co 2-0 va 2-1, thu ty so hoa, thu xep hang Marathon, xuat Excel, in phieu trong tai. Kiem tra ban sao Google Sheets.
F. Khi test dat, chay useProductionSpreadsheet() de chuyen lai file goc; goi getSpreadsheetMode() de xac nhan mode=PRODUCTION va dung spreadsheetId. Sau do moi deploy/doi Web App san xuat va cap nhat URL /exec neu URL thay doi.
G. Khong chay setupAdmin() neu khong can reset mat khau; ham nay tao mat khau moi.

QUAN TRONG VE MA DOI
--------------------
API khong tu dong tao doi gia. Ma DoiA_MaDoi/DoiB_MaDoi trong TRAN_DAU phai trung chinh xac voi MaDoi trong DOI_THI_DAU tren Google Sheets. O tran cho doi thang tu vong truoc, duoc de trong ca DoiA va DoiB; khong duoc chi de trong mot ben. Cac ma ke hoach nhu KECO-01 trong workbook co the khac ma he thong sinh tu DSDK. Truoc khi import, dong bo doi/VDV, lay MaDoi thuc te va thay ma trong TRAN_DAU. API se tu choi dong neu ma doi khong ton tai/khong thuoc dung MaMon.

GIOI HAN KIEM THU
-----------------
Da kiem tra cu phap JavaScript bang Node.js cho Code.gs va script trong admin.html. Khong the truy cap/chay Apps Script va Google Sheets cua cong ty tu moi truong dong goi nay; vi vay runSandboxSelfTests() va checklist tren la buoc kiem thu thuc te bat buoc truoc khi chuyen sang san xuat. Khong coi ban nay da duoc kiem thu truc tiep tren Google Sheets that.
