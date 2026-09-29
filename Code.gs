/**
 * LIWAYWAY SPORTS FESTIVAL 2026
 * Google Apps Script backend
 */

const CONFIG = Object.freeze({
  EMPLOYEE_FILE_ID: '1caxiuh1jyzZi8rkz1EqDkzwcr_gf5sIk4XzCh-XBjjQ',
  EMPLOYEE_SHEET: 'DSCNV',
  REGISTRATION_FILE_ID: '1W-IUOmA_5VDYctjGTBwcKGEx1rND8sanyzPUIyhu_M8',
  REGISTRATION_SHEET: 'DSDK',
  SESSION_TTL_SEC: 6 * 60 * 60,
  EMPLOYEE_CACHE_SEC: 300,
  DEFAULT_ADMIN_PASSWORD_HASH:
    'dfbff6cfcb36fb052a25a07c12239f6004945a6c3848b8964d4b12574ffef577'
});

const GAME_LIMITS = Object.freeze({
  'Kéo co': { min: 6, max: 10 },
  'Nhảy bao jumbo': { min: 10, max: 10 },
  'Trò chơi liên hoàn': { min: 4, max: 4 }
});

// 9 columns. The last 2 are structured keys used for reliable duplicate checking.
const HEADERS = [
  'Thời gian đăng ký',
  'Hình thức đăng ký',
  'Công ty / Khối lớn',
  'Bộ phận / Phòng ban',
  'Tên Đội / Cá nhân đăng ký',
  'Môn thi đấu',
  'Danh sách thành viên chi tiết',
  'Phòng ban',
  'Bộ phận',
  'Mã NV / CCCD đăng ký'
];

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalize_(value) {
  return value == null ? '' : String(value).trim();
}

function key_(value) {
  return normalize_(value).toLowerCase().replace(/\s+/g, '');
}

function sha256Hex_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    const n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function getAdminPasswordHash_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') ||
    CONFIG.DEFAULT_ADMIN_PASSWORD_HASH;
}

function createSession_() {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('SPORTS_ADMIN_' + token, '1', CONFIG.SESSION_TTL_SEC);
  return token;
}

function isValidSession_(token) {
  token = normalize_(token);
  return !!token && CacheService.getScriptCache().get('SPORTS_ADMIN_' + token) === '1';
}

function getRegistrationSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.REGISTRATION_FILE_ID);
  let sheet = ss.getSheetByName(CONFIG.REGISTRATION_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.REGISTRATION_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#212529').setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    return sheet;
  }

  // IMPORTANT: preserve the original 7 registration columns. New structured
  // fields are appended to the right so historical rows never shift.
  const width = Math.max(sheet.getLastColumn(), 7);
  const existing = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  if (width < HEADERS.length) sheet.insertColumnsAfter(width, HEADERS.length - width);
  for (let i = 7; i < HEADERS.length; i++) {
    sheet.getRange(1, i + 1).setValue(HEADERS[i]);
  }
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold').setBackground('#212529').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  return sheet;
}

function getEmployees_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('SPORTS_EMPLOYEES_V2');
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const ss = SpreadsheetApp.openById(CONFIG.EMPLOYEE_FILE_ID);
  const sheet = ss.getSheetByName(CONFIG.EMPLOYEE_SHEET);
  if (!sheet) throw new Error("Không tìm thấy tab '" + CONFIG.EMPLOYEE_SHEET + "'.");

  // Display values preserve leading zeroes in CCCD.
  const values = sheet.getDataRange().getDisplayValues();
  const employees = [];
  const seen = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const hoTen = normalize_(row[0]);       // A
    const maNV = normalize_(row[1]);       // B
    const cccd = normalize_(row[5]);       // F
    const phongBan = normalize_(row[6]);   // G
    const boPhan = normalize_(row[7]);     // H
    const chucVu = normalize_(row[8]);     // I
    if (!hoTen && !maNV && !cccd) continue;

    // Avoid duplicated directory entries when the source contains duplicate rows.
    const unique = key_(maNV || cccd || hoTen);
    if (unique && seen[unique]) continue;
    seen[unique] = true;

    employees.push({ hoTen, maNV, cccd, phongBan, boPhan, chucVu });
  }

  const result = JSON.stringify(employees);
  if (result.length < 90000) cache.put('SPORTS_EMPLOYEES_V2', result, CONFIG.EMPLOYEE_CACHE_SEC);
  return employees;
}

function parseMemberKeys_(text) {
  const result = { maNV: [], cccd: [] };
  const s = normalize_(text);
  if (!s) return result;

  s.split(' | ').forEach(function(part) {
    const m = part.match(/MNV:\s*([^\]\-]+?)(?:\s*-\s*CCCD|\s*\[|$)/i);
    if (m && normalize_(m[1])) result.maNV.push(key_(m[1]));
    const c = part.match(/CCCD\s*4\s*số\s*cuối:\s*(\d{4})/i);
    if (c && c[1]) result.cccd.push(key_(c[1]));
  });
  return result;
}

function getExistingRegistrations_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  return values.map(function(r) {
    return {
      loai: normalize_(r[1]),
      congTy: normalize_(r[2]),
      legacyDept: normalize_(r[3]),
      ten: normalize_(r[4]),
      mon: normalize_(r[5]),
      members: normalize_(r[6]),
      phongBan: normalize_(r[7]),
      boPhan: normalize_(r[8]),
      keys: normalize_(r[9])
    };
  });
}

function checkDuplicateRegistration_(p, sheet) {
  const loai = normalize_(p.loaiDangKy);
  const mon = normalize_(p.monDangKy);
  const congTy = key_(p.congTy);
  const currentMaNV = key_(p.maNVDangKy);
  const currentCCCD = key_(p.cccdDangKy);
  const memberKeys = normalize_(p.memberKeys);
  const existing = getExistingRegistrations_(sheet);

  for (let i = 0; i < existing.length; i++) {
    const row = existing[i];
    if (key_(row.congTy) !== congTy) continue;

    // Individual Marathon: the same employee cannot register twice.
    if (loai === 'Cá nhân' && mon === 'Chạy Marathon' && row.mon === 'Chạy Marathon') {
      let hit = false;
      if (currentMaNV && row.keys && row.keys.split('|').map(key_).includes(currentMaNV)) hit = true;
      if (currentCCCD && row.keys && row.keys.split('|').map(key_).includes(currentCCCD)) hit = true;
      if (!hit && currentMaNV) {
        const oldMembers = parseMemberKeys_(row.members);
        hit = oldMembers.maNV.includes(currentMaNV);
      }
      // Backward compatibility: old Marathon rows may not have the structured key column.
      if (!hit && !row.keys && currentMaNV) {
        hit = key_(row.ten) === key_(p.tenFormTenDoi);
      }
      if (hit) throw new Error('Nhân viên này đã đăng ký Marathon rồi, không thể đăng ký thêm lần nữa.');
    }

    // Team: a member may only belong to one team for the same game.
    if (loai === 'Đội nhóm' && row.loai === 'Đội nhóm' && row.mon === mon) {
      const newKeys = memberKeys.split('|').map(key_).filter(Boolean);
      const oldKeys = (row.keys || '').split('|').map(key_).filter(Boolean);
      const oldMember = parseMemberKeys_(row.members);
      oldKeys.push.apply(oldKeys, oldMember.maNV);
      oldKeys.push.apply(oldKeys, oldMember.cccd);

      const oldSet = {};
      oldKeys.forEach(k => { if (k) oldSet[k] = true; });
      const duplicate = newKeys.find(k => oldSet[k]);
      if (duplicate) {
        throw new Error('Có thành viên đã đăng ký ở đội khác trong môn "' + mon + '". Mỗi nhân viên chỉ được thuộc một đội cho cùng một môn.');
      }
    }
  }
}

function validateRegistration_(p) {
  const loai = normalize_(p.loaiDangKy);
  const congTy = normalize_(p.congTy);
  const phongBan = normalize_(p.phongBan);
  const boPhan = normalize_(p.boPhan);
  const ten = normalize_(p.tenFormTenDoi);
  const mon = normalize_(p.monDangKy);

  if (!['Cá nhân', 'Đội nhóm'].includes(loai)) throw new Error('Hình thức đăng ký không hợp lệ.');
  if (!congTy || !phongBan || !boPhan || !ten || !mon) throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc.');

  if (loai === 'Cá nhân') {
    if (mon !== 'Chạy Marathon') throw new Error('Đăng ký cá nhân chỉ áp dụng cho Chạy Marathon.');
    if (!normalize_(p.maNVDangKy) && !normalize_(p.cccdDangKy)) {
      throw new Error('Vui lòng chọn người đăng ký từ danh sách DSCNV để hệ thống kiểm trùng.');
    }
    return;
  }

  const limit = GAME_LIMITS[mon];
  if (!limit) throw new Error('Môn thi đấu đội nhóm không hợp lệ.');
  const memberArray = normalize_(p.danhSachThanhVien)
    ? normalize_(p.danhSachThanhVien).split(' | ').map(s => s.trim()).filter(Boolean) : [];
  if (memberArray.length < limit.min || memberArray.length > limit.max) {
    throw new Error('Môn "' + mon + '" yêu cầu ' + (limit.min === limit.max ? 'đúng ' + limit.min : 'từ ' + limit.min + ' đến ' + limit.max) + ' thành viên. Hiện có ' + memberArray.length + '.');
  }
  if (!normalize_(p.memberKeys)) throw new Error('Danh sách thành viên chưa có Mã NV/CCCD hợp lệ.');
  const keys = normalize_(p.memberKeys).split('|').map(key_).filter(Boolean);
  if (new Set(keys).size !== keys.length) throw new Error('Trong cùng một đội không được đăng ký trùng Mã NV/CCCD.');
}

function doGet(e) {
  try {
    const action = normalize_(e && e.parameter && e.parameter.action);
    if (action === 'health') return json_({ result: 'success', message: 'API is running.' });
    if (action === 'getEmployees' || !action) return json_({ result: 'success', data: getEmployees_() });

    if (action === 'getReport') {
      if (!isValidSession_(e.parameter.token)) return json_({ result: 'unauthorized', message: 'Phiên Admin không hợp lệ hoặc đã hết hạn.' });
      const sheet = getRegistrationSheet_();
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return json_({ result: 'success', data: [] });
      const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getDisplayValues();
      return json_({ result: 'success', data: values.map(function(r) {
        return { timestamp:r[0], loaiDangKy:r[1], congTy:r[2], legacyDept:r[3], tenFormTenDoi:r[4], monDangKy:r[5], danhSachThanhVien:r[6], phongBan:r[7] || '', boPhan:r[8] || r[3] || '', registrationKeys:r[9] || '' };
      }) });
    }
    return json_({ result: 'error', message: 'Action không hợp lệ.' });
  } catch (error) {
    console.error(error);
    return json_({ result: 'error', message: error.message || String(error) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = normalize_(p.action);

    if (action === 'adminLogin') {
      const password = normalize_(p.password);
      if (!password) return json_({ result:'error', message:'Vui lòng nhập mật khẩu.' });
      if (sha256Hex_(password) !== getAdminPasswordHash_()) return json_({ result:'error', message:'Mật khẩu Admin không chính xác.' });
      return json_({ result:'success', token:createSession_() });
    }

    if (action === 'clearEmployeeCache') {
      if (!isValidSession_(p.token)) return json_({ result:'unauthorized', message:'Phiên Admin không hợp lệ.' });
      CacheService.getScriptCache().remove('SPORTS_EMPLOYEES_V2');
      return json_({ result:'success' });
    }

    validateRegistration_(p);
    const sheet = getRegistrationSheet_();
    checkDuplicateRegistration_(p, sheet);

    sheet.appendRow([
      new Date(), normalize_(p.loaiDangKy), normalize_(p.congTy),
      normalize_(p.boPhan), normalize_(p.tenFormTenDoi), normalize_(p.monDangKy),
      normalize_(p.danhSachThanhVien), normalize_(p.phongBan), normalize_(p.boPhan),
      normalize_(p.memberKeys || p.maNVDangKy || p.cccdDangKy)
    ]);

    return json_({ result:'success', message:'Đăng ký đã được lưu.' });
  } catch (error) {
    console.error(error);
    return json_({ result:'error', message:error.message || String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doOptions() { return ContentService.createTextOutput(''); }
