/**
 * LIWAYWAY SPORTS FESTIVAL 2026
 * Google Apps Script backend
 *
 * Lần đầu triển khai: chạy setupAdmin() một lần trong Apps Script.
 * Hàm này tự tạo mật khẩu Admin và ghi mật khẩu mới vào Execution log.
 */

const CONFIG = Object.freeze({
  EMPLOYEE_FILE_ID: '1caxiuh1jyzZi8rkz1EqDkzwcr_gf5sIk4XzCh-XBjjQ',
  EMPLOYEE_SHEET: 'DSCNV',
  REGISTRATION_FILE_ID: '1W-IUOmA_5VDYctjGTBwcKGEx1rND8sanyzPUIyhu_M8',
  REGISTRATION_SHEET: 'DSDK',
  SESSION_TTL_SEC: 6 * 60 * 60,
  EMPLOYEE_CACHE_SEC: 300
});

const GAME_LIMITS = Object.freeze({
  'Kéo co': { min: 6, max: 10 },
  'Nhảy bao jumbo': { min: 10, max: 10 },
  'Trò chơi liên hoàn': { min: 4, max: 4 }
});

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
  'Mã NV / CCCD đăng ký',
  'Mã xác nhận',
  'Hạn đăng ký'
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

function removeVietnameseMarks_(value) {
  return normalize_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase();
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

function randomPassword_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let result = '';
  const bytes = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  for (let i = 0; i < 18; i++) {
    const n = parseInt(bytes.substr((i * 2) % bytes.length, 2), 16);
    result += chars[n % chars.length];
  }
  return result;
}

/**
 * Chạy thủ công 1 lần sau khi deploy.
 * Tự tạo mật khẩu Admin mới, lưu HASH vào Script Properties và log mật khẩu thực tế.
 */
function setupAdmin() {
  const password = randomPassword_();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_PASSWORD_HASH', sha256Hex_(password));
  props.setProperty('ADMIN_SESSION_VERSION', String(Date.now()));
  if (!props.getProperty('REGISTRATION_DEADLINE_MS')) {
    props.setProperty('REGISTRATION_DEADLINE_MS', '');
  }
  console.log('========================================');
  console.log('SPORTS ADMIN - MẬT KHẨU MỚI');
  console.log(password);
  console.log('Hãy lưu mật khẩu này. Không cần sửa hash trong code.');
  console.log('========================================');
  return 'Đã thiết lập Admin. Mở Execution log để lấy mật khẩu mới.';
}

function getAdminPasswordHash_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') || '';
}

function getSessionVersion_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_SESSION_VERSION') || '1';
}

function createSession_() {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put(
    'SPORTS_ADMIN_' + token,
    getSessionVersion_(),
    CONFIG.SESSION_TTL_SEC
  );
  return token;
}

function isValidSession_(token) {
  token = normalize_(token);
  if (!token) return false;
  return CacheService.getScriptCache().get('SPORTS_ADMIN_' + token) === getSessionVersion_();
}

function getRegistrationDeadlineMs_() {
  const value = PropertiesService.getScriptProperties().getProperty('REGISTRATION_DEADLINE_MS') || '';
  if (!value) return null;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function registrationStatus_() {
  const deadlineMs = getRegistrationDeadlineMs_();
  return {
    deadlineMs: deadlineMs,
    open: deadlineMs === null || Date.now() <= deadlineMs
  };
}

function assertRegistrationOpen_() {
  const status = registrationStatus_();
  if (!status.open) {
    throw new Error('Thời hạn đăng ký đã kết thúc. Vui lòng liên hệ Ban tổ chức.');
  }
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

  // Giữ nguyên A:J của dữ liệu cũ. Chỉ bổ sung K:L cho mã xác nhận và hạn đăng ký.
  const existingLastCol = Math.max(sheet.getLastColumn(), 10);
  if (existingLastCol < HEADERS.length) {
    sheet.insertColumnsAfter(existingLastCol, HEADERS.length - existingLastCol);
  }
  sheet.getRange(1, 1, 1, 10).setValues([HEADERS.slice(0, 10)])
    .setFontWeight('bold').setBackground('#212529').setFontColor('#ffffff');
  sheet.getRange(1, 11, 1, 2).setValues([[HEADERS[10], HEADERS[11]]])
    .setFontWeight('bold').setBackground('#212529').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  return sheet;
}
function getEmployees_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('SPORTS_EMPLOYEES_V3');
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const ss = SpreadsheetApp.openById(CONFIG.EMPLOYEE_FILE_ID);
  const sheet = ss.getSheetByName(CONFIG.EMPLOYEE_SHEET);
  if (!sheet) throw new Error("Không tìm thấy tab '" + CONFIG.EMPLOYEE_SHEET + "'.");

  const values = sheet.getDataRange().getDisplayValues();
  const employees = [];
  const seen = {};

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const hoTen = normalize_(row[0]);
    const maNV = normalize_(row[1]);
    const cccd = normalize_(row[5]);
    const phongBan = normalize_(row[6]);
    const boPhan = normalize_(row[7]);
    const chucVu = normalize_(row[8]);
    if (!hoTen && !maNV && !cccd) continue;

    const unique = key_(maNV || cccd || hoTen);
    if (unique && seen[unique]) continue;
    seen[unique] = true;

    employees.push({
      hoTen, maNV, cccd, phongBan, boPhan, chucVu,
      hoTenKhongDau: removeVietnameseMarks_(hoTen)
    });
  }

  const result = JSON.stringify(employees);
  if (result.length < 90000) cache.put('SPORTS_EMPLOYEES_V3', result, CONFIG.EMPLOYEE_CACHE_SEC);
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
      legacyDept: normalize_(r[3]),
      ten: normalize_(r[4]),
      mon: normalize_(r[5]),
      members: normalize_(r[6]),
      phongBan: normalize_(r[7]),
      boPhan: normalize_(r[8]),
      keys: normalize_(r[9]),
      confirmationCode: normalize_(r[10])
    };
  });
}
function checkDuplicateRegistration_(p, sheet) {
  const loai = normalize_(p.loaiDangKy);
  const mon = normalize_(p.monDangKy);
  const currentMaNV = key_(p.maNVDangKy);
  const currentCCCD = key_(p.cccdDangKy);
  const memberKeys = normalize_(p.memberKeys);
  const existing = getExistingRegistrations_(sheet);

  for (let i = 0; i < existing.length; i++) {
    const row = existing[i];

    if (loai === 'Cá nhân' && mon === 'Chạy Marathon' &&
        row.loai === 'Cá nhân' && row.mon === 'Chạy Marathon') {
      const rowKeys = (row.keys || '').split('|').map(key_).filter(Boolean);
      let hit = (currentMaNV && rowKeys.includes(currentMaNV)) ||
                (currentCCCD && rowKeys.includes(currentCCCD));

      if (!hit && currentMaNV) {
        const oldMembers = parseMemberKeys_(row.members);
        hit = oldMembers.maNV.includes(currentMaNV);
      }
      if (!hit && !row.keys && currentMaNV) {
        hit = key_(row.ten) === key_(p.tenFormTenDoi);
      }
      if (hit) throw new Error('Nhân viên này đã đăng ký Marathon rồi, không thể đăng ký thêm lần nữa.');
    }

    if (loai === 'Đội nhóm' && row.loai === 'Đội nhóm' && row.mon === mon) {
      const newKeys = memberKeys.split('|').map(key_).filter(Boolean);
      const oldKeys = (row.keys || '').split('|').map(key_).filter(Boolean);
      const oldMember = parseMemberKeys_(row.members);
      oldKeys.push.apply(oldKeys, oldMember.maNV);
      oldKeys.push.apply(oldKeys, oldMember.cccd);

      const oldSet = {};
      oldKeys.forEach(function(k) { if (k) oldSet[k] = true; });
      const duplicate = newKeys.find(function(k) { return oldSet[k]; });

      if (duplicate) {
        throw new Error('Có thành viên đã đăng ký ở đội khác trong môn "' + mon + '". Mỗi nhân viên chỉ được thuộc một đội cho cùng một môn.');
      }
    }
  }
}

function validateRegistration_(p) {
  const loai = normalize_(p.loaiDangKy);
  const ten = normalize_(p.tenFormTenDoi);
  const mon = normalize_(p.monDangKy);

  if (!['Cá nhân', 'Đội nhóm'].includes(loai)) throw new Error('Hình thức đăng ký không hợp lệ.');
  if (!ten || !mon) throw new Error('Vui lòng chọn người đăng ký/tên đội và môn thi đấu.');

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
    ? normalize_(p.danhSachThanhVien).split(' | ').map(function(s) { return s.trim(); }).filter(Boolean)
    : [];

  if (memberArray.length < limit.min || memberArray.length > limit.max) {
    throw new Error('Môn "' + mon + '" yêu cầu ' +
      (limit.min === limit.max ? 'đúng ' + limit.min : 'từ ' + limit.min + ' đến ' + limit.max) +
      ' thành viên. Hiện có ' + memberArray.length + '.');
  }

  if (!normalize_(p.memberKeys)) throw new Error('Danh sách thành viên chưa có Mã NV/CCCD hợp lệ.');

  const keys = normalize_(p.memberKeys).split('|').map(key_).filter(Boolean);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Trong cùng một đội không được đăng ký trùng Mã NV/CCCD.');
  }
}

function confirmationCode_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

function rowToReport_(r) {
  return {
    timestamp: r[0] || '',
    loaiDangKy: r[1] || '',
    tenFormTenDoi: r[4] || '',
    monDangKy: r[5] || '',
    danhSachThanhVien: r[6] || '',
    phongBan: r[7] || '',
    boPhan: r[8] || r[3] || '',
    registrationKeys: r[9] || '',
    confirmationCode: r[10] || ''
  };
}
function findRegistrationByCode_(code) {
  const sheet = getRegistrationSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getDisplayValues();
  const target = key_(code);

  for (let i = 0; i < values.length; i++) {
    if (key_(values[i][10]) === target) return rowToReport_(values[i]);
  }
  return null;
}

function getAdminSettings_() {
  const deadlineMs = getRegistrationDeadlineMs_();
  return {
    deadlineMs: deadlineMs,
    registrationOpen: deadlineMs === null || Date.now() <= deadlineMs
  };
}

function doGet(e) {
  try {
    const action = normalize_(e && e.parameter && e.parameter.action);

    if (action === 'health') {
      return json_({ result: 'success', message: 'API is running.' });
    }

    if (action === 'getRegistrationStatus') {
      return json_({ result: 'success', data: registrationStatus_() });
    }

    if (action === 'verify') {
      const code = normalize_(e.parameter.code);
      if (!code) return json_({ result: 'error', message: 'Thiếu mã xác nhận.' });
      const row = findRegistrationByCode_(code);
      if (!row) return json_({ result: 'not_found', message: 'Không tìm thấy mã xác nhận.' });
      return json_({ result: 'success', data: row });
    }

    if (action === 'getEmployees' || !action) {
      return json_({ result: 'success', data: getEmployees_() });
    }

    if (action === 'getAdminSettings') {
      if (!isValidSession_(e.parameter.token)) {
        return json_({ result: 'unauthorized', message: 'Phiên Admin không hợp lệ hoặc đã hết hạn.' });
      }
      return json_({ result: 'success', data: getAdminSettings_() });
    }

    if (action === 'getReport') {
      if (!isValidSession_(e.parameter.token)) {
        return json_({ result: 'unauthorized', message: 'Phiên Admin không hợp lệ hoặc đã hết hạn.' });
      }
      const sheet = getRegistrationSheet_();
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return json_({ result: 'success', data: [] });

      const values = sheet.getRange(
        2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), HEADERS.length)
      ).getDisplayValues();

      return json_({
        result: 'success',
        data: values.map(rowToReport_)
      });
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
      const hash = getAdminPasswordHash_();
      if (!hash) {
        return json_({ result:'error', message:'Admin chưa được thiết lập. Hãy chạy setupAdmin() trong Apps Script.' });
      }
      if (!password) return json_({ result:'error', message:'Vui lòng nhập mật khẩu.' });
      if (sha256Hex_(password) !== hash) {
        return json_({ result:'error', message:'Mật khẩu Admin không chính xác.' });
      }
      return json_({ result:'success', token:createSession_() });
    }

    if (action === 'adminChangePassword') {
      if (!isValidSession_(p.token)) return json_({ result:'unauthorized', message:'Phiên Admin không hợp lệ.' });
      const oldPassword = normalize_(p.oldPassword);
      const newPassword = normalize_(p.newPassword);

      if (!oldPassword || !newPassword) throw new Error('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
      if (newPassword.length < 8) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');
      if (sha256Hex_(oldPassword) !== getAdminPasswordHash_()) throw new Error('Mật khẩu hiện tại không đúng.');

      const props = PropertiesService.getScriptProperties();
      props.setProperty('ADMIN_PASSWORD_HASH', sha256Hex_(newPassword));
      props.setProperty('ADMIN_SESSION_VERSION', String(Date.now()));
      return json_({ result:'success', message:'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.' });
    }

    if (action === 'adminSetDeadline') {
      if (!isValidSession_(p.token)) return json_({ result:'unauthorized', message:'Phiên Admin không hợp lệ.' });
      const value = p.deadlineMs === null || normalize_(p.deadlineMs) === '' ? '' : Number(p.deadlineMs);

      if (value !== '' && (!Number.isFinite(value) || value <= 0)) {
        throw new Error('Thời hạn đăng ký không hợp lệ.');
      }

      PropertiesService.getScriptProperties().setProperty('REGISTRATION_DEADLINE_MS', value === '' ? '' : String(value));
      return json_({ result:'success', data:getAdminSettings_(), message:'Đã cập nhật thời hạn đăng ký.' });
    }

    if (action === 'clearEmployeeCache') {
      if (!isValidSession_(p.token)) return json_({ result:'unauthorized', message:'Phiên Admin không hợp lệ.' });
      CacheService.getScriptCache().remove('SPORTS_EMPLOYEES_V3');
      return json_({ result:'success' });
    }

    // Không cho đăng ký sau deadline, kiểm tra lại ở backend để không thể bypass bằng DevTools.
    assertRegistrationOpen_();
    validateRegistration_(p);

    const sheet = getRegistrationSheet_();
    checkDuplicateRegistration_(p, sheet);

    const code = confirmationCode_();
    const deadlineMs = getRegistrationDeadlineMs_();

    sheet.appendRow([
      new Date(),
      normalize_(p.loaiDangKy),
      '',
      '',
      normalize_(p.tenFormTenDoi),
      normalize_(p.monDangKy),
      normalize_(p.danhSachThanhVien),
      normalize_(p.phongBan),
      normalize_(p.boPhan),
      normalize_(p.memberKeys || p.maNVDangKy || p.cccdDangKy),
      code,
      deadlineMs ? new Date(deadlineMs) : ''
    ]);

    return json_({
      result:'success',
      message:'Đăng ký đã được lưu.',
      confirmationCode:code,
      registrationStatus:registrationStatus_(),
      data:{
        loaiDangKy:normalize_(p.loaiDangKy),
        tenFormTenDoi:normalize_(p.tenFormTenDoi),
        monDangKy:normalize_(p.monDangKy),
        danhSachThanhVien:normalize_(p.danhSachThanhVien),
        phongBan:normalize_(p.phongBan),
        boPhan:normalize_(p.boPhan)
      }
    });
  } catch (error) {
    console.error(error);
    return json_({ result:'error', message:error.message || String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doOptions() {
  return ContentService.createTextOutput('');
}
