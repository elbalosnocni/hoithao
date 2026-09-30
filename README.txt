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
