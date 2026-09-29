// ==========================================
// CONFIGURATION - CẤU HÌNH HỆ THỐNG ĐỘC LẬP
// ==========================================
const FILE_NHAN_VIEN_ID = "1caxiuh1jyzZi8rkz1EqDkzwcr_gf5sIk4XzCh-XBjjQ";
const TEN_TAB_NHAN_VIEN  = "DSCNV"; 

const FILE_DANG_KY_ID    = "1W-IUOmA_5VDYctjGTBwcKGEx1rND8sanyzPUIyhu_M8";
const TEN_TAB_DANG_KY    = "DSDK";

// ==========================================
// HÀM TỰ ĐỘNG KIỂM TRA & TẠO TIÊU ĐỀ SHEET (AUTO-SETUP)
// ==========================================
function initAndCheckSheets() {
  try {
    var docDangKy = SpreadsheetApp.openById(FILE_DANG_KY_ID);
    var sheetDangKy = docDangKy.getSheetByName(TEN_TAB_DANG_KY);
    if (!sheetDangKy) { sheetDangKy = docDangKy.insertSheet(TEN_TAB_DANG_KY); }
    
    if (sheetDangKy.getLastRow() === 0) {
      var headers = [
        "Thời gian đăng ký", "Hình thức đăng ký", "Công ty / Khối lớn", 
        "Bộ phận / Phòng ban", "Tên Đội / Cá nhân đăng ký", "Môn thi đấu", "Danh sách thành viên chi tiết"
      ];
      sheetDangKy.appendRow(headers);
      var range = sheetDangKy.getRange(1, 1, 1, headers.length);
      range.setFontWeight("bold").setBackground("#212529").setFontColor("#ffffff").setHorizontalAlignment("center");
    }
    return sheetDangKy;
  } catch (err) {
    throw new Error("Không thể kết nối File Đăng Ký. Vui lòng kiểm tra lại ID file.");
  }
}

// ==========================================
// HÀM XỬ LÝ GET REQUEST (ĐỌC DỮ LIỆU) - THÊM CCCD & CHỨC VỤ
// ==========================================
function doGet(e) {
  try {
    var action = e.parameter.action;
    
    // TRƯỜNG HỢP 1: Xuất báo cáo tổng hợp cho Dashboard Admin
    if (action === "getReport") {
      var sheetDangKy = initAndCheckSheets();
      var dataDangKy = sheetDangKy.getDataRange().getValues();
      var reports = [];
      for (var i = 1; i < dataDangKy.length; i++) {
        reports.push({
          timestamp: dataDangKy[i][0],
          loaiDangKy: dataDangKy[i][1],
          congTy: dataDangKy[i][2],
          boPhan: dataDangKy[i][3],
          tenFormTenDoi: dataDangKy[i][4],
          monDangKy: dataDangKy[i][5],
          danhSachThanhVien: dataDangKy[i][6]
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ "result": "success", "data": reports })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // TRƯỜNG HỢP MẶC ĐỊNH: LẤY DANH SÁCH NHÂN VIÊN TỪ FILE GỐC ĐỂ TÌM KIẾM
    var docNhanVien = SpreadsheetApp.openById(FILE_NHAN_VIEN_ID);
    var sheetNhanVien = docNhanVien.getSheetByName(TEN_TAB_NHAN_VIEN);
    if (!sheetNhanVien) {
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Không tìm thấy tên Tab '" + TEN_TAB_NHAN_VIEN + "'!" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var dataNhanVien = sheetNhanVien.getDataRange().getValues();
    var employees = [];
    
    for (var j = 1; j < dataNhanVien.length; j++) {
      if (!dataNhanVien[j][1]) continue; // Bỏ qua dòng trống nếu không có Mã số NV
      
      // Chuyển đổi số CCCD sang dạng chuỗi tránh bị mất số 0 ở đầu
      var cccdStr = dataNhanVien[j][5] ? dataNhanVien[j][5].toString().trim() : "";
      
      employees.push({
        hoTen: dataNhanVien[j][0].toString().trim(),     // Cột A: Hoten
        maNV: dataNhanVien[j][1].toString().trim(),      // Cột B: MaNV
        cccd: cccdStr,                                   // Cột F: SoCanCuoc
        khoiLon: dataNhanVien[j][6].toString().trim(),   // Cột G: Phongban (Khối lớn)
        boPhan: dataNhanVien[j][7].toString().trim(),    // Cột H: Bophan (Chi tiết)
        chucVu: dataNhanVien[j][8].toString().trim()     // Cột I: Chucvu
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "result": "success", "data": employees })).setMimeType(ContentService.MimeType.JSON);
          
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var sheetDangKy = initAndCheckSheets();
    var params = JSON.parse(e.postData.contents);
    sheetDangKy.appendRow([
      new Date(), params.loaiDangKy, params.congTy, params.boPhan, params.tenFormTenDoi, params.monDangKy, params.danhSachThanhVien || ""
    ]);
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally { lock.releaseLock(); }
}

function doOptions(e) {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT).setHeaders({
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'
  });
}
