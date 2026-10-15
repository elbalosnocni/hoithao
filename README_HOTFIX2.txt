LIWAYWAY SPORTS FESTIVAL 2026 - HOTFIX 2

SUA CAC LOI IMPORT KE HOACH:
1. Admin doc them sheet DOI_THI_DAU va gui danh sach doi vao API importTournamentPlan.
2. Backend tu bo sung cac ma doi chua ton tai vao DOI_THI_DAU; neu ma doi da ton tai thi khong ghi de. Neu ma doi da ton tai nhung thuoc mon khac, tra loi loi rieng.
3. O TRAN_DAU, cac ma doi dang cho nhu W1/W2/L13/L14 duoc nhan dien la placeholder doi tu vong truoc, khong bi kiem tra nhu MaDoi that.
4. LHG cho phep mot doi tren moi dong/vi tri trong luot; JUMBO cho phep de trong doi khi BCH chua xac nhan nhom.
5. Bang mon dung tap hop tu MON_THI_DAU hien tai va danh sach MON_THI_DAU gui kem Excel, de khong bao sai MARATHON khi danh muc mon tren sheet chua duoc dong bo.
6. Giao dien hien thi ca loi DOI_THI_DAU, TRAN_DAU va GIAI_THUONG.

KIEM TRA DA THUC HIEN TAI MOI TRUONG DONG GOI:
- node --check Code.gs: PASS (sau khi copy tam sang .js).
- node --check script JavaScript trong admin.html: PASS.
- Kiem tra quy tac theo workbook: 4 mon, 48 doi, 48 dong ke hoach TRAN_DAU, 48 dong hop le, 0 loi; 18 dong giai thuong, 0 ma mon khong ton tai.

GIOI HAN:
Day la kiem tra tinh hop le cua ma nguon va du lieu Excel trong moi truong dong goi, KHONG phai test truc tiep voi Google Apps Script/Google Sheets cua cong ty. Can deploy vao ban sao va thu import truoc khi dung du lieu that.

CAP NHAT:
- Thay Code.gs bang file trong goi.
- Thay admin.html bang file trong goi.
- Luu va deploy mot ban Web App thu nghiem moi.
- Chon Excel -> Xem truoc ke hoach -> Nhap ke hoach an toan.
- Xem so doi duoc them, so tran duoc them va tung dong loi tra ve.
- Khong chuyen ve production cho den khi xac nhan ban sao chay dung.
