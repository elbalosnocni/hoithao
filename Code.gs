/**
 * LIWAYWAY SPORTS FESTIVAL 2026
 * Google Apps Script backend
 *
 * Required Script Properties (recommended):
 *   ADMIN_PASSWORD_HASH = SHA-256 hash of the Admin password.
 *
 * The fallback hash below keeps compatibility with the current deployment.
 * Change the Script Property before production use.
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

const HEADERS = [
  'Thời gian đăng ký',
  'Hình thức đăng ký',
  'Công ty / Khối lớn',
  'Bộ phận / Phòng ban',
  'Tên Đội / Cá nhân đăng ký',
  'Môn thi đấu',
  'Danh sách thành viên chi tiết'
];

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalize_(value) {
  return value == null ? '' : String(value).trim();
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
  CacheService.getScriptCache().put(
    'SPORTS_ADMIN_' + token,
    '1',
    CONFIG.SESSION_TTL_SEC
  );
  return token;
}

function isValidSession_(token) {
  token = normalize_(token);
  if (!token) return false;
  return CacheService.getScriptCache().get('SPORTS_ADMIN_' + token) === '1';
}

function getRegistrationSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.REGISTRATION_FILE_ID);
  let sheet = ss.getSheetByName(CONFIG.REGISTRATION_SHEET);
  if (!sheet) sheet = ss.insertSheet(CONFIG.REGISTRATION_SHEET);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#212529')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getEmployees_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('SPORTS_EMPLOYEES_V1');
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const ss = SpreadsheetApp.openById(CONFIG.EMPLOYEE_FILE_ID);
  const sheet = ss.getSheetByName(CONFIG.EMPLOYEE_SHEET);
  if (!sheet) throw new Error("Không tìm thấy tab '" + CONFIG.EMPLOYEE_SHEET + "'.");

  // getDisplayValues() is intentional: it preserves leading zeroes in CCCD.
  const values = sheet.getDataRange().getDisplayValues();
  const employees = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const hoTen = normalize_(row[0]);
    const maNV = normalize_(row[1]);

    if (!hoTen && !maNV) continue;

    employees.push({
      hoTen: hoTen,
      maNV: maNV,
      cccd: normalize_(row[5]),
      khoiLon: normalize_(row[6]),
      boPhan: normalize_(row[7]),
      chucVu: normalize_(row[8])
    });
  }

  const result = JSON.stringify(employees);
  // CacheService has a per-value size limit; skip caching if the directory is too large.
  if (result.length < 90000) {
    cache.put('SPORTS_EMPLOYEES_V1', result, CONFIG.EMPLOYEE_CACHE_SEC);
  }
  return employees;
}

function validateRegistration_(p) {
  const loai = normalize_(p.loaiDangKy);
  const congTy = normalize_(p.congTy);
  const boPhan = normalize_(p.boPhan);
  const ten = normalize_(p.tenFormTenDoi);
  const mon = normalize_(p.monDangKy);
  const members = normalize_(p.danhSachThanhVien);

  if (!['Cá nhân', 'Đội nhóm'].includes(loai)) {
    throw new Error('Hình thức đăng ký không hợp lệ.');
  }
  if (!congTy || !boPhan || !ten || !mon) {
    throw new Error('Vui lòng điền đầy đủ thông tin bắt buộc.');
  }

  if (loai === 'Cá nhân' && mon !== 'Chạy Marathon') {
    throw new Error('Đăng ký cá nhân chỉ áp dụng cho Chạy Marathon.');
  }

  if (loai === 'Đội nhóm') {
    const limit = GAME_LIMITS[mon];
    if (!limit) throw new Error('Môn thi đấu đội nhóm không hợp lệ.');

    const memberArray = members
      ? members.split(' | ').map(s => s.trim()).filter(Boolean)
      : [];

    if (memberArray.length < limit.min || memberArray.length > limit.max) {
      throw new Error(
        'Môn "' + mon + '" yêu cầu từ ' + limit.min + ' đến ' +
        limit.max + ' thành viên. Hiện có ' + memberArray.length + '.'
      );
    }
  }
}

function doGet(e) {
  try {
    const action = normalize_(e && e.parameter && e.parameter.action);

    if (action === 'health') {
      return json_({ result: 'success', message: 'API is running.' });
    }

    if (action === 'getEmployees' || !action) {
      return json_({ result: 'success', data: getEmployees_() });
    }

    if (action === 'getReport') {
      if (!isValidSession_(e.parameter.token)) {
        return json_({ result: 'unauthorized', message: 'Phiên Admin không hợp lệ hoặc đã hết hạn.' });
      }

      const sheet = getRegistrationSheet_();
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return json_({ result: 'success', data: [] });

      // Display values make timestamps and text predictable for the frontend.
      const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
      const reports = values.map(function (r) {
        return {
          timestamp: r[0],
          loaiDangKy: r[1],
          congTy: r[2],
          boPhan: r[3],
          tenFormTenDoi: r[4],
          monDangKy: r[5],
          danhSachThanhVien: r[6]
        };
      });

      return json_({ result: 'success', data: reports });
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
      if (!password) return json_({ result: 'error', message: 'Vui lòng nhập mật khẩu.' });

      if (sha256Hex_(password) !== getAdminPasswordHash_()) {
        return json_({ result: 'error', message: 'Mật khẩu Admin không chính xác.' });
      }

      return json_({ result: 'success', token: createSession_() });
    }

    if (action === 'clearEmployeeCache') {
      if (!isValidSession_(p.token)) {
        return json_({ result: 'unauthorized', message: 'Phiên Admin không hợp lệ.' });
      }
      CacheService.getScriptCache().remove('SPORTS_EMPLOYEES_V1');
      return json_({ result: 'success' });
    }

    validateRegistration_(p);

    const sheet = getRegistrationSheet_();
    sheet.appendRow([
      new Date(),
      normalize_(p.loaiDangKy),
      normalize_(p.congTy),
      normalize_(p.boPhan),
      normalize_(p.tenFormTenDoi),
      normalize_(p.monDangKy),
      normalize_(p.danhSachThanhVien)
    ]);

    return json_({ result: 'success', message: 'Đăng ký đã được lưu.' });
  } catch (error) {
    console.error(error);
    return json_({ result: 'error', message: error.message || String(error) });
  } finally {
    lock.releaseLock();
  }
}

function doOptions() {
  return ContentService.createTextOutput('');
}

/**
 * Optional one-time helper:
 * Set the Script Property ADMIN_PASSWORD_HASH to the SHA-256 hash
 * of your desired Admin password.
 *
 * Example in Apps Script editor:
 *   PropertiesService.getScriptProperties()
 *     .setProperty('ADMIN_PASSWORD_HASH', sha256Hex_('YourNewPassword'));
 */
