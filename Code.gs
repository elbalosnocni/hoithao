/**
 * LIWAYWAY SPORTS FESTIVAL 2026 - V4
 * Google Apps Script backend
 *
 * Giữ nguyên DSKD/DSDK cũ, bổ sung các sheet:
 * MON_THI_DAU, DOI_THI_DAU, VAN_DONG_VIEN, BANG_DAU, KET_QUA
 * Admin cấu hình môn/giới hạn/thể thức; hệ thống tự đồng bộ đội + VĐV và sinh bảng đấu.
 */

const CONFIG = Object.freeze({
  EMPLOYEE_FILE_ID: '1caxiuh1jyzZi8rkz1EqDkzwcr_gf5sIk4XzCh-XBjjQ',
  EMPLOYEE_SHEET: 'DSCNV',
  REGISTRATION_FILE_ID: '1W-IUOmA_5VDYctjGTBwcKGEx1rND8sanyzPUIyhu_M8',
  REGISTRATION_SHEET: 'DSDK',
  SESSION_TTL_SEC: 6 * 60 * 60,
  EMPLOYEE_CACHE_SEC: 300,
  SHEETS: {
    GAMES: 'MON_THI_DAU',
    TEAMS: 'DOI_THI_DAU',
    ATHLETES: 'VAN_DONG_VIEN',
    MATCHES: 'BANG_DAU',
    RESULTS: 'KET_QUA',
    PRIZES: 'GIAI_THUONG'
  }
});

const DEFAULT_GAMES = [
  { code:'KECO', name:'Kéo co', type:'Đội nhóm', min:6, max:10, description:'Mỗi đội từ 6 đến 10 người.', format:'Loại trực tiếp', groups:1, teamsPerGroup:0, advance:0, status:'Mở', order:1 },
  { code:'JUMBO', name:'Nhảy bao jumbo', type:'Đội nhóm', min:10, max:10, description:'Mỗi đội đúng 10 người.', format:'Loại trực tiếp', groups:1, teamsPerGroup:0, advance:0, status:'Mở', order:2 },
  { code:'LHG', name:'Trò chơi liên hoàn', type:'Đội nhóm', min:4, max:4, description:'Mỗi đội đúng 4 người.', format:'Loại trực tiếp', groups:1, teamsPerGroup:0, advance:0, status:'Mở', order:3 },
  { code:'MARATHON', name:'Chạy Marathon', type:'Cá nhân', min:1, max:1, description:'Đăng ký cá nhân.', format:'Xếp hạng thành tích', groups:1, teamsPerGroup:0, advance:0, status:'Mở', order:4 }
];

const REG_HEADERS = ['Thời gian đăng ký','Hình thức đăng ký','Công ty / Khối lớn','Bộ phận / Phòng ban','Tên Đội / Cá nhân đăng ký','Môn thi đấu','Danh sách thành viên chi tiết','Phòng ban','Bộ phận','Mã NV / CCCD đăng ký','Mã xác nhận','Hạn đăng ký'];
const GAME_HEADERS = ['MaMon','TenMon','HinhThuc','Min','Max','MoTa','TheThuc','SoBang','DoiMoiBang','VaoVongSau','TrangThai','ThuTu','CreatedAt','UpdatedAt'];
const TEAM_HEADERS = ['MaDoi','MaMon','TenDoi','MaDangKy','SoThanhVien','TrangThai','CreatedAt','UpdatedAt'];
const ATHLETE_HEADERS = ['MaVDV','MaDoi','MaMon','MaDangKy','MaNV','CCCD','HoTen','GioiTinh','PhongBan','BoPhan','ChucVu','HinhThuc','TrangThai','CreatedAt','UpdatedAt'];
const MATCH_HEADERS = ['MaTran','MaMon','Vong','Bang','TranSo','DoiA','DoiB','DiemA','DiemB','DoiThang','DoiThua','TrangThai','CreatedAt','UpdatedAt'];
const RESULT_HEADERS = ['MaKetQua','MaTran','MaMon','MaDoi','MaVDV','Diem','ThanhTich','XepHang','GhiChu','UpdatedAt'];
const PRIZE_HEADERS = ['MaMon','MaGiai','TenGiai','HinhThucThuong','TienThuong_VND','PhamVi','NguonQuyDinh','GhiChu','UpdatedAt'];

function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function normalize_(v) { return v == null ? '' : String(v).trim(); }
function key_(v) { return normalize_(v).toLowerCase().replace(/\s+/g,''); }
function removeVietnameseMarks_(v) { return normalize_(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase(); }
function now_() { return new Date(); }
function sha256Hex_(value) { const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8); return bytes.map(b=>{const n=b<0?b+256:b;return ('0'+n.toString(16)).slice(-2);}).join(''); }
function randomPassword_(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';let out='';const bytes=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');for(let i=0;i<18;i++){const n=parseInt(bytes.substr((i*2)%bytes.length,2),16);out+=chars[n%chars.length];}return out;}
function confirmationCode_(){return Utilities.getUuid().replace(/-/g,'').substring(0,12).toUpperCase();}
function id_(prefix){return prefix+'-'+Utilities.getUuid().replace(/-/g,'').substring(0,10).toUpperCase();}

function setupAdmin(){
  const password=randomPassword_(), props=PropertiesService.getScriptProperties();
  props.setProperty('ADMIN_PASSWORD_HASH',sha256Hex_(password));
  props.setProperty('ADMIN_SESSION_VERSION',String(Date.now()));
  if(!props.getProperty('REGISTRATION_DEADLINE_MS')) props.setProperty('REGISTRATION_DEADLINE_MS','');
  setupSystem();
  console.log('========================================'); console.log('SPORTS ADMIN - MAT KHAU MOI'); console.log(password); console.log('========================================');
  return 'Đã thiết lập Admin và hệ thống. Xem Execution log để lấy mật khẩu.';
}
function setupSystem(){
  const ss=ss_();
  ensureSheet_(ss,CONFIG.REGISTRATION_SHEET,REG_HEADERS);
  const gs=ensureSheet_(ss,CONFIG.SHEETS.GAMES,GAME_HEADERS);
  ensureSheet_(ss,CONFIG.SHEETS.TEAMS,TEAM_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.ATHLETES,ATHLETE_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.MATCHES,MATCH_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.RESULTS,RESULT_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.PRIZES,PRIZE_HEADERS);
  if(gs.getLastRow()<2){ const rows=DEFAULT_GAMES.map(g=>[g.code,g.name,g.type,g.min,g.max,g.description,g.format,g.groups,g.teamsPerGroup,g.advance,g.status,g.order,now_(),now_()]); gs.getRange(2,1,rows.length,GAME_HEADERS.length).setValues(rows); }
  return 'OK';
}
function ensureSheet_(ss,name,headers){
  let sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name);
  if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]); styleHeader_(sh,headers.length);}
  else { const current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getDisplayValues()[0]; headers.forEach((h,i)=>{if(normalize_(current[i])!==h) sh.getRange(1,i+1).setValue(h);}); styleHeader_(sh,headers.length); }
  sh.setFrozenRows(1); return sh;
}
function styleHeader_(sh,n){sh.getRange(1,1,1,n).setFontWeight('bold').setBackground('#172033').setFontColor('#fff').setHorizontalAlignment('center');}
function activeSpreadsheetId_(){const props=PropertiesService.getScriptProperties();return props.getProperty('SPORTS_TEST_MODE')==='true'?(props.getProperty('SPORTS_TEST_SPREADSHEET_ID')||CONFIG.REGISTRATION_FILE_ID):CONFIG.REGISTRATION_FILE_ID;}
function ss_(){return SpreadsheetApp.openById(activeSpreadsheetId_());}
// Chạy thủ công trong Apps Script để tạo bản sao kiểm thử; từ đó các API ghi dữ liệu sẽ đi vào bản sao.
function createTestCopy(){const props=PropertiesService.getScriptProperties();let id=props.getProperty('SPORTS_TEST_SPREADSHEET_ID');if(id){try{const existing=SpreadsheetApp.openById(id);props.setProperty('SPORTS_TEST_MODE','true');return {id:id,url:existing.getUrl(),message:'Đã chuyển sang bản sao kiểm thử có sẵn.'};}catch(e){}}const source=SpreadsheetApp.openById(CONFIG.REGISTRATION_FILE_ID);const copy=source.copy('TEST - '+source.getName()+' - '+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd-HHmm'));id=copy.getId();props.setProperty('SPORTS_TEST_SPREADSHEET_ID',id);props.setProperty('SPORTS_TEST_MODE','true');setupSystem();return {id:id,url:copy.getUrl(),message:'Đã tạo bản sao và bật chế độ kiểm thử. API ghi dữ liệu hiện đi vào bản sao, không ghi vào file đăng ký gốc.'};}
function useProductionSpreadsheet(){PropertiesService.getScriptProperties().setProperty('SPORTS_TEST_MODE','false');return 'Đã chuyển lại file sản xuất. Chỉ thực hiện sau khi xác nhận bản sao đã kiểm thử.';}
function getSpreadsheetMode(){const test=PropertiesService.getScriptProperties().getProperty('SPORTS_TEST_MODE')==='true';return {mode:test?'TEST':'PRODUCTION',spreadsheetId:activeSpreadsheetId_(),url:ss_().getUrl()};}
function runSandboxSelfTests(){const mode=getSpreadsheetMode();if(mode.mode!=='TEST')throw new Error('Từ chối chạy test: hãy chạy createTestCopy() trước.');setupSystem();const ss=ss_(),matchSh=ss.getSheetByName(CONFIG.SHEETS.MATCHES),resultSh=ss.getSheetByName(CONFIG.SHEETS.RESULTS);const matches=displayRows_(matchSh),results=displayRows_(resultSh);const duplicate=(arr,idx)=>{const seen={};return arr.filter(r=>{const k=key_(r[idx]);if(!k)return false;if(seen[k])return true;seen[k]=1;return false;}).length;};const checks=[{name:'Match headers length',pass:matchSh.getLastColumn()>=MATCH_HEADERS.length,detail:'Cần ít nhất '+MATCH_HEADERS.length+' cột.'},{name:'Result headers length',pass:resultSh.getLastColumn()>=RESULT_HEADERS.length,detail:'Cần ít nhất '+RESULT_HEADERS.length+' cột.'},{name:'Duplicate match IDs',pass:duplicate(matches,0)===0,detail:'Số mã trận trùng: '+duplicate(matches,0)},{name:'Duplicate result IDs',pass:duplicate(results,0)===0,detail:'Số mã kết quả trùng: '+duplicate(results,0)},{name:'Match status values',pass:matches.every(r=>!r[11]||['Chưa đấu','Đang đấu','Đã đấu','Hoãn','Hủy','Tạm dừng'].includes(r[11])),detail:'Kiểm tra trạng thái theo danh mục.'}];let testRow=0;try{const code='SELFTEST-'+Utilities.getUuid().substring(0,8),created=new Date(Math.floor((Date.now()-60000)/1000)*1000);matchSh.appendRow([code,'KECO','Test','Test',999,'TEST_DOI_A','TEST_DOI_B','','','','','Chưa đấu',created,created]);testRow=matchSh.getLastRow();updateMatchResult_({maTran:code,diemA:'2',diemB:'1'});const out=displayRows_(matchSh)[testRow-2],createdAfter=matchSh.getRange(testRow,13).getValue();const pass=Number(out[7])===2&&Number(out[8])===1&&out[9]==='TEST_DOI_A'&&out[10]==='TEST_DOI_B'&&out[11]==='Đã đấu'&&createdAfter instanceof Date&&createdAfter.getTime()===created.getTime()&&!!out[13];checks.push({name:'Match result column mapping',pass:pass,detail:pass?'Điểm/thắng/thua/trạng thái/CreatedAt/UpdatedAt đúng cột.':'Lỗi ánh xạ cột kết quả.'});}catch(e){checks.push({name:'Match result column mapping',pass:false,detail:e.message});}finally{if(testRow>0)matchSh.deleteRow(testRow);}const report={mode:mode.mode,spreadsheetUrl:mode.url,checks:checks,allPassed:checks.every(x=>x.pass)};return report;}
function sheet_(name,headers){return ensureSheet_(ss_(),name,headers);}
function rows_(sh){const lr=sh.getLastRow(),lc=sh.getLastColumn();return lr<2?[]:sh.getRange(2,1,lr-1,lc).getValues();}
function displayRows_(sh){const lr=sh.getLastRow(),lc=sh.getLastColumn();return lr<2?[]:sh.getRange(2,1,lr-1,lc).getDisplayValues();}
function headerMap_(headers){const m={};headers.forEach((h,i)=>m[h]=i);return m;}

function getAdminPasswordHash_(){return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH')||'';}
function getSessionVersion_(){return PropertiesService.getScriptProperties().getProperty('ADMIN_SESSION_VERSION')||'1';}
function createSession_(){const token=Utilities.getUuid()+Utilities.getUuid();CacheService.getScriptCache().put('SPORTS_ADMIN_'+token,getSessionVersion_(),CONFIG.SESSION_TTL_SEC);return token;}
function isValidSession_(token){token=normalize_(token);return !!token&&CacheService.getScriptCache().get('SPORTS_ADMIN_'+token)===getSessionVersion_();}
function getRegistrationDeadlineMs_(){const v=PropertiesService.getScriptProperties().getProperty('REGISTRATION_DEADLINE_MS')||'';if(!v)return null;const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function registrationStatus_(){const d=getRegistrationDeadlineMs_();return {deadlineMs:d,open:d===null||Date.now()<=d};}
function assertRegistrationOpen_(){if(!registrationStatus_().open)throw new Error('Thời hạn đăng ký đã kết thúc. Vui lòng liên hệ Ban tổ chức.');}
function getAdminSettings_(){const s=registrationStatus_();return {deadlineMs:s.deadlineMs,registrationOpen:s.open};}

function getRegistrationSheet_(){return sheet_(CONFIG.REGISTRATION_SHEET,REG_HEADERS);}
function getEmployees_(){
  const cache=CacheService.getScriptCache(),cached=cache.get('SPORTS_EMPLOYEES_V4'); if(cached){try{return JSON.parse(cached);}catch(e){}}
  const sh=SpreadsheetApp.openById(CONFIG.EMPLOYEE_FILE_ID).getSheetByName(CONFIG.EMPLOYEE_SHEET); if(!sh)throw new Error("Không tìm thấy tab '"+CONFIG.EMPLOYEE_SHEET+"'.");
  const v=sh.getDataRange().getDisplayValues(),out=[],seen={};
  for(let i=1;i<v.length;i++){const r=v[i],hoTen=normalize_(r[0]),maNV=normalize_(r[1]),cccd=normalize_(r[5]),phongBan=normalize_(r[6]),boPhan=normalize_(r[7]),chucVu=normalize_(r[8]),gioiTinh=normalize_(r[2]);if(!hoTen&&!maNV&&!cccd)continue;const u=key_(maNV||cccd||hoTen);if(u&&seen[u])continue;seen[u]=1;out.push({hoTen,maNV,cccd,gioiTinh,phongBan,boPhan,chucVu,hoTenKhongDau:removeVietnameseMarks_(hoTen)});}
  const s=JSON.stringify(out);if(s.length<90000)cache.put('SPORTS_EMPLOYEES_V4',s,CONFIG.EMPLOYEE_CACHE_SEC);return out;
}
function parseMemberText_(text){
  const source=String(text==null?'':text).replace(/\r/g,'\n').replace(/\s*\|\s*/g,'\n').replace(/\s*;\s*/g,'\n');
  return source.split(/\n+/).map(x=>x.trim()).filter(Boolean).map((part,i)=>{
    const clean=part.replace(/^[-•*\s]+/,'');
    const nameMatch=clean.match(/^\d+[.)、]?\s*(.*?)(?=\s+-\s*(?:MNV|CCCD)|\s*\[(?:Phòng ban|Bộ phận|Chức vụ)|$)/i);
    const maNV=(clean.match(/(?:MNV|Mã\s*NV|Mã nhân viên)\s*:\s*([^\]|,;]+?)(?=\s+-\s*CCCD|\s*\[(?:Phòng ban|Bộ phận|Chức vụ)|$)/i)||[])[1]||'';
    const cccd4=(clean.match(/CCCD\s*(?:4\s*số\s*cuối)?\s*:\s*(?:\*+)?(\d{4})/i)||[])[1]||'';
    const dept=(clean.match(/Phòng ban\s*:\s*([^\]]+?)(?=\s*\[|\s+-\s*(?:Bộ phận|Chức vụ)|$)/i)||[])[1]||'';
    const section=(clean.match(/Bộ phận\s*:\s*([^\]]+?)(?=\s*\[|\s+-\s*Chức vụ|$)/i)||[])[1]||'';
    const pos=(clean.match(/Chức vụ\s*:\s*([^\]]+)/i)||[])[1]||'';
    return {index:i+1,hoTen:normalize_(nameMatch&&nameMatch[1]||clean.replace(/^\d+[.)、]?\s*/,'')),maNV:normalize_(maNV).replace(/\s+-\s*$/,''),cccd4:normalize_(cccd4),phongBan:normalize_(dept),boPhan:normalize_(section),chucVu:normalize_(pos)};
  }).filter(x=>x.hoTen);
}
function gameRows_(){return displayRows_(sheet_(CONFIG.SHEETS.GAMES,GAME_HEADERS));}
function gameObjects_(){
  return gameRows_().map(r=>({code:r[0],name:r[1],type:r[2],min:Number(r[3])||1,max:Number(r[4])||1,description:r[5]||'',format:r[6]||'Loại trực tiếp',groups:Number(r[7])||1,teamsPerGroup:Number(r[8])||0,advance:Number(r[9])||0,status:r[10]||'Mở',order:Number(r[11])||0,createdAt:r[12]||'',updatedAt:r[13]||''})).filter(g=>g.code&&g.name).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'vi'));
}
function findGame_(value){const k=key_(value);return gameObjects_().find(g=>key_(g.code)===k||key_(g.name)===k)||null;}
function publicGames_(){return gameObjects_().filter(g=>key_(g.status)!=='đóng'&&key_(g.status)!=='khóa'&&key_(g.status)!=='khoa'&&key_(g.status)!=='tạm khóa'&&key_(g.status)!=='tam khoa');}

function getExistingRegistrations_(){
  const sh=getRegistrationSheet_(),v=displayRows_(sh);return v.map((r,i)=>({row:i+2,timestamp:r[0],loai:r[1],ten:r[4],mon:r[5],members:r[6],phongBan:r[7],boPhan:r[8],keys:r[9],confirmationCode:r[10]}));
}
function checkDuplicateRegistration_(p){
  const loai=normalize_(p.loaiDangKy),mon=normalize_(p.monDangKy),newKeys=normalize_(p.memberKeys||p.maNVDangKy||p.cccdDangKy).split('|').map(key_).filter(Boolean), existing=getExistingRegistrations_();
  existing.forEach(row=>{
    if(row.mon!==mon)return;
    const oldKeys=(row.keys||'').split('|').map(key_).filter(Boolean);parseMemberText_(row.members).forEach(m=>{if(m.maNV)oldKeys.push(key_(m.maNV));});
    const oldSet={};oldKeys.forEach(k=>oldSet[k]=1);const hit=newKeys.some(k=>oldSet[k]);
    if(!hit)return;
    if(loai==='Cá nhân')throw new Error('Người này đã đăng ký môn "'+mon+'" rồi, không thể đăng ký thêm lần nữa.');
    throw new Error('Có thành viên đã đăng ký ở đội khác trong môn "'+mon+'". Mỗi nhân viên chỉ được thuộc một đội cho cùng một môn.');
  });
}
function validateRegistration_(p){
  const loai=normalize_(p.loaiDangKy),ten=normalize_(p.tenFormTenDoi),mon=normalize_(p.monDangKy);if(!['Cá nhân','Đội nhóm'].includes(loai))throw new Error('Hình thức đăng ký không hợp lệ.');if(!ten||!mon)throw new Error('Vui lòng chọn đầy đủ thông tin.');
  const game=findGame_(mon);if(!game||key_(game.status)!=='mở')throw new Error('Môn thi đấu này không còn mở đăng ký.');
  if(game.type!==loai)throw new Error('Môn "'+game.name+'" yêu cầu hình thức "'+game.type+'".');
  if(loai==='Cá nhân'){if(!p.maNVDangKy&&!p.cccdDangKy)throw new Error('Vui lòng chọn người đăng ký từ danh sách nhân viên.');return;}
  const members=parseMemberText_(p.danhSachThanhVien),n=members.length;if(n<game.min||n>game.max)throw new Error('Môn "'+game.name+'" yêu cầu '+(game.min===game.max?'đúng '+game.min:'từ '+game.min+' đến '+game.max)+' thành viên. Hiện có '+n+'.');
  const keys=normalize_(p.memberKeys).split('|').map(key_).filter(Boolean);if(keys.length!==n||new Set(keys).size!==keys.length)throw new Error('Danh sách thành viên phải có mã NV/CCCD duy nhất cho từng người.');
}

function syncRegistrationData_(){
  const reg=getExistingRegistrations_(), teamSh=sheet_(CONFIG.SHEETS.TEAMS,TEAM_HEADERS), athSh=sheet_(CONFIG.SHEETS.ATHLETES,ATHLETE_HEADERS), games=gameObjects_();
  const existingTeams={};displayRows_(teamSh).forEach((r,i)=>existingTeams[normalize_(r[3])+'|'+normalize_(r[1])]= {row:i+2,code:r[0]});
  const existingAth={};displayRows_(athSh).forEach((r,i)=>existingAth[normalize_(r[3])+'|'+normalize_(r[2])+'|'+key_(r[4]||r[5]||r[6])]=i+2);
  const emp=getEmployees_(), byMa={},byCccd={};emp.forEach(e=>{if(e.maNV)byMa[key_(e.maNV)]=e;if(e.cccd)byCccd[key_(e.cccd)]=e;});
  reg.forEach(row=>{
    const game=findGame_(row.mon);if(!game)return;
    if(row.loai==='Đội nhóm'){
      const k=row.confirmationCode+'|'+game.code;if(!existingTeams[k]){
        const members=parseMemberText_(row.members);const code=uniqueTeamCode_(game.code);teamSh.appendRow([code,game.code,row.ten,row.confirmationCode,members.length,'Đã đăng ký',now_(),now_()]);existingTeams[k]={code};
      }
      const teamCode=existingTeams[k].code, members=parseMemberText_(row.members);
      members.forEach(m=>{
        const empRow=byMa[key_(m.maNV)]||byCccd[key_(m.cccd4)]||{};const ak=row.confirmationCode+'|'+game.code+'|'+key_(m.maNV||m.cccd4||m.hoTen);if(!existingAth[ak]){athSh.appendRow([id_('VDV'),teamCode,game.code,row.confirmationCode,m.maNV,empRow.cccd||'',m.hoTen||empRow.hoTen||'',empRow.gioiTinh||'',m.phongBan||empRow.phongBan||'',m.boPhan||empRow.boPhan||'',m.chucVu||empRow.chucVu||'',row.loai,'Đã đăng ký',now_(),now_()]);existingAth[ak]=1;}
      });
    } else {
      const k=row.confirmationCode+'|'+game.code;if(!existingTeams[k]){existingTeams[k]={code:''};}
      const ak=row.confirmationCode+'|'+game.code+'|'+key_(row.keys||row.ten);if(!existingAth[ak]){const e=byMa[key_(row.keys)]||byCccd[key_(row.keys)]||{};athSh.appendRow([id_('VDV'),' ',game.code,row.confirmationCode,e.maNV||row.keys||'',e.cccd||'',row.ten,e.gioiTinh||'',row.phongBan||e.phongBan||'',row.boPhan||e.boPhan||'',e.chucVu||'','Cá nhân','Đã đăng ký',now_(),now_()]);existingAth[ak]=1;}}
  });
  [teamSh,athSh].forEach(sh=>sh.autoResizeColumns(1,Math.min(sh.getLastColumn(),15)));
  return {registrations:reg.length,teams:Math.max(0,teamSh.getLastRow()-1),athletes:Math.max(0,athSh.getLastRow()-1),games:games.length};
}
function uniqueTeamCode_(gameCode){const sh=sheet_(CONFIG.SHEETS.TEAMS,TEAM_HEADERS),prefix=normalize_(gameCode).toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,10)||'TEAM';let n=1,c=prefix+String(n).padStart(3,'0'),set={};displayRows_(sh).forEach(r=>set[key_(r[0])]=1);while(set[key_(c)]){n++;c=prefix+String(n).padStart(3,'0');}return c;}

function listTeams_(gameCode){syncRegistrationData_();const rows=displayRows_(sheet_(CONFIG.SHEETS.TEAMS,TEAM_HEADERS));return rows.filter(r=>!gameCode||key_(r[1])===key_(gameCode)).map(r=>({maDoi:r[0],maMon:r[1],tenDoi:r[2],maDangKy:r[3],soThanhVien:Number(r[4])||0,trangThai:r[5]}));}
function listAthletes_(gameCode){syncRegistrationData_();const rows=displayRows_(sheet_(CONFIG.SHEETS.ATHLETES,ATHLETE_HEADERS));return rows.filter(r=>!gameCode||key_(r[2])===key_(gameCode)).map(r=>({maVDV:r[0],maDoi:r[1],maMon:r[2],maDangKy:r[3],maNV:r[4],cccd:r[5],hoTen:r[6],gioiTinh:r[7],phongBan:r[8],boPhan:r[9],chucVu:r[10],hinhThuc:r[11],trangThai:r[12]}));}
function clearMatchesForGame_(gameCode){const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),rows=displayRows_(sh);for(let i=rows.length-1;i>=0;i--){if(key_(rows[i][1])===key_(gameCode))sh.deleteRow(i+2);}}
function generateTournament_(gameCode){
  syncRegistrationData_(); const game=findGame_(gameCode); if(!game)throw new Error('Không tìm thấy môn.');
  if(game.type!=='Đội nhóm')return generateIndividualEntries_(game.code);
  if(['JUMBO','LHG'].includes(key_(game.code)))throw new Error('Môn này thi theo nhóm/lượt và xếp hạng thành tích, không bốc thăm loại trực tiếp tự động. Hãy nhập lịch chính thức từ Excel và ghi thành tích tại tab Kết quả.');
  const teams=listTeams_(game.code).filter(t=>!['hủy','huy'].includes(key_(t.trangThai)));
  if(teams.length<2)throw new Error('Cần ít nhất 2 đội đã đăng ký để tạo bảng đấu.');
  const existing=listMatches_(game.code); if(existing.length){const hasProgress=existing.some(m=>['Đã đấu','Đang đấu'].includes(normalize_(m.trangThai))||normalize_(m.diemA)!==''||normalize_(m.diemB)!=='');throw new Error(hasProgress?'Môn này đã có kết quả/đang thi đấu; hệ thống khóa tạo lại để bảo vệ dữ liệu. Hãy nhập kế hoạch Excel hoặc xử lý dữ liệu trên bản sao.':'Môn này đã có lịch. Không tự xóa lịch cũ; hãy nhập kế hoạch bằng importTournamentPlan hoặc xóa lịch thủ công sau khi sao lưu.');} const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS);
  // Fisher–Yates shuffle: bốc thăm ngẫu nhiên trên danh sách đội hiện có.
  const shuffled=teams.map(t=>t.maDoi); for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  const groupMode=/bảng|group|vòng tròn|round.?robin/i.test(game.format||'') || Number(game.groups)>1 || Number(game.teamsPerGroup)>0;
  const rows=[]; let seq=1;
  if(groupMode){
    const configuredPerGroup=Number(game.teamsPerGroup)||0; const configuredGroups=Number(game.groups)||1; const groupCount=Math.max(1,Math.min(teams.length,configuredPerGroup>0?Math.ceil(teams.length/configuredPerGroup):configuredGroups)), groups=Array.from({length:groupCount},(_,i)=>({name:String.fromCharCode(65+i),teams:[]}));
    shuffled.forEach((team,i)=>groups[i%groupCount].teams.push(team));
    groups.forEach(g=>{const arr=g.teams;for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){rows.push([game.code+'-G'+g.name+'-'+String(seq++).padStart(3,'0'),game.code,'Vòng bảng','Bảng '+g.name,seq-1,arr[i],arr[j],'','','','','Chưa đấu',now_(),now_()]);}});
    if(!rows.length)throw new Error('Không đủ đội để lập lịch vòng bảng.');
  } else {
    let size=1;while(size<shuffled.length)size*=2;const seeded=shuffled.slice();while(seeded.length<size)seeded.push('BYE');
    let current=seeded.slice(),round=1;
    while(current.length>1){const roundName=round===1?nameRound_(size):'Vòng '+round;for(let i=0;i<current.length;i+=2){const a=current[i],b=current[i+1];rows.push([game.code+'-R'+round+'-'+String(i/2+1).padStart(2,'0'),game.code,roundName,'',i/2+1,a==='BYE'?'':a,b==='BYE'?'':b,'','','','','Chưa đấu',now_(),now_()]);}current=new Array(Math.ceil(current.length/2)).fill('');round++;}
  }
  if(rows.length)sh.getRange(sh.getLastRow()+1,1,rows.length,MATCH_HEADERS.length).setValues(rows);
  return {game:game,teams:teams,matches:listMatches_(game.code),message:groupMode?'Đã bốc thăm ngẫu nhiên và lập lịch vòng bảng cho '+teams.length+' đội.':'Đã bốc thăm ngẫu nhiên và tạo nhánh loại trực tiếp cho '+teams.length+' đội.'};
}
function nameRound_(size){if(size===2)return'Chung kết';if(size===4)return'Bán kết';if(size===8)return'Tứ kết';return'Vòng '+size+' đội';}
function generateIndividualEntries_(gameCode){const sh=sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS),rows=displayRows_(sh),existing={};rows.forEach(r=>{if(key_(r[2])===key_(gameCode)&&r[4])existing[key_(r[4])]=r[0];});const athletes=listAthletes_(gameCode).filter(a=>a.hinhThuc==='Cá nhân');const add=[];athletes.forEach(a=>{if(!existing[key_(a.maVDV)])add.push([id_('KQ'),' ',gameCode,a.maDoi||'',a.maVDV,'','','','','',now_()]);});if(add.length)sh.getRange(sh.getLastRow()+1,1,add.length,RESULT_HEADERS.length).setNumberFormat('@').setValues(add);return {game:findGame_(gameCode),athletes:athletes,entries:listResults_(gameCode),added:add.length,message:'Đã đồng bộ danh sách thi cá nhân; không xóa kết quả đã nhập.'};}
function listMatches_(gameCode){const rows=displayRows_(sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS));return rows.filter(r=>!gameCode||key_(r[1])===key_(gameCode)).map(r=>({maTran:r[0],maMon:r[1],vong:r[2],bang:r[3],tranSo:Number(r[4])||0,doiA:r[5],doiB:r[6],diemA:r[7],diemB:r[8],doiThang:r[9],doiThua:r[10],trangThai:r[11]}));}
function listResults_(gameCode){const rows=displayRows_(sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS));return rows.filter(r=>!gameCode||key_(r[2])===key_(gameCode)).map(r=>({maKetQua:r[0],maTran:r[1],maMon:r[2],maDoi:r[3],maVDV:r[4],diem:r[5],thanhTich:r[6],xepHang:r[7],ghiChu:r[8],updatedAt:r[9]}));}
function updateMatchResult_(p){
  const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),rows=displayRows_(sh),idx=rows.findIndex(r=>key_(r[0])===key_(p.maTran));if(idx<0)throw new Error('Không tìm thấy mã trận.');
  const row=idx+2,r=rows[idx],game=findGame_(r[1]);if(['JUMBO','LHG'].includes(key_(r[1])))throw new Error('Môn này tính theo thành tích/nhóm lượt. Nhập thời gian và xếp hạng tại tab Kết quả, không nhập tỷ số đối kháng.');if(!normalize_(r[5])||!normalize_(r[6]))throw new Error('Trận chưa có đủ hai đội/VĐV.');
  const a=normalize_(p.diemA),b=normalize_(p.diemB);if(a===''||b==='')throw new Error('Vui lòng nhập đủ điểm/kết quả hai bên.');const na=Number(a),nb=Number(b);if(!Number.isFinite(na)||!Number.isFinite(nb)||na<0||nb<0)throw new Error('Điểm phải là số không âm.');
  let winner='',loser='',status='Đã đấu';if(na>nb){winner=r[5];loser=r[6];}else if(nb>na){winner=r[6];loser=r[5];}else if(normalize_(p.winnerTieBreak)){winner=normalize_(p.winnerTieBreak);if(winner!==r[5]&&winner!==r[6])throw new Error('Đội thắng tie-break phải là Đội A hoặc Đội B.');loser=winner===r[5]?r[6]:r[5];}else if(key_(r[1])==='KECO'){throw new Error('Kéo co không chấp nhận hòa: nhập số hiệp thắng của mỗi đội (đội thắng phải đạt 2 hiệp).');}else{throw new Error('Tỷ số hòa: nhập lại kết quả hoặc chỉ định winnerTieBreak.');}
  if(key_(r[1])==='KECO'&&(Math.max(na,nb)>2||Math.max(na,nb)<2||Math.min(na,nb)>1))throw new Error('Kéo co theo thể thức 3 hiệp thắng 2: tỷ số hợp lệ gồm 2-0 hoặc 2-1.');
  if(key_(r[11])==='đãđấu'&&(String(r[7])!==String(na)||String(r[8])!==String(nb)))throw new Error('Trận đã chốt kết quả. Để tránh sai lệch nhánh, không cho sửa trực tiếp; hãy sao lưu và nhờ quản trị viên xử lý trên bản sao.');
  {const conflict=checkAdvanceConflict_(r[0],r[1],winner,loser);if(conflict)throw new Error(conflict);}
  // Viết đúng 7 trường từ cột H:N; giữ nguyên kiểu dữ liệu CreatedAt (cột M) và ghi UpdatedAt (cột N).
  const createdAt=sh.getRange(row,13).getValue()||now_();
  sh.getRange(row,8,1,7).setValues([[na,nb,winner,loser,status,createdAt,now_()]]);
  advanceWinner_(r[0],r[1],winner,loser);
  return listMatches_(r[1]);
}
function advancementTargets_(matchCode,gameCode,winner,loser){const out=[];const official=key_(gameCode)==='keco'&&String(matchCode).match(/-M(\d+)$/i);if(official){const n=Number(official[1]),map={1:[['KECO-M05',6,winner]],2:[['KECO-M05',7,winner]],3:[['KECO-M06',6,winner]],4:[['KECO-M06',7,winner]],5:[['KECO-M13',6,winner]],6:[['KECO-M13',7,winner]],7:[['KECO-M11',6,winner]],8:[['KECO-M11',7,winner]],9:[['KECO-M12',6,winner]],10:[['KECO-M12',7,winner]],11:[['KECO-M14',6,winner]],12:[['KECO-M14',7,winner]],13:[['KECO-M16',6,winner],['KECO-M15',6,loser]],14:[['KECO-M16',7,winner],['KECO-M15',7,loser]]};return map[n]||[];}const m=String(matchCode).match(/-R(\d+)-(\d+)$/i);if(m){const round=Number(m[1]),slot=Number(m[2]),nextCode=gameCode+'-R'+(round+1)+'-'+String(Math.ceil(slot/2)).padStart(2,'0'),col=(slot%2===1)?6:7;out.push([nextCode,col,winner]);}return out;}
function checkAdvanceConflict_(matchCode,gameCode,winner,loser){const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),rows=displayRows_(sh),targets=advancementTargets_(matchCode,gameCode,winner,loser);for(const t of targets){const j=rows.findIndex(r=>key_(r[0])===key_(t[0]));if(j<0)continue;const existing=rows[j][t[1]-1];if(existing&&existing!==t[2])return 'Trận kế tiếp '+t[0]+' đã có đội khác ở ô đi tiếp. Kết quả chưa được ghi; cần BCH kiểm tra nhánh trước.';if(key_(rows[j][11])==='đãđấu'&&existing!==t[2])return 'Trận kế tiếp '+t[0]+' đã chốt kết quả; không thể thay đổi đội đi tiếp tự động.';}return '';}
function advanceWinner_(matchCode,gameCode,winner,loser){const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),rows=displayRows_(sh),targets=advancementTargets_(matchCode,gameCode,winner,loser);targets.forEach(t=>{const j=rows.findIndex(r=>key_(r[0])===key_(t[0]));if(j<0)return;const existing=rows[j][t[1]-1];if(!existing)sh.getRange(j+2,t[1]).setValue(t[2]);});}

function saveIndividualResults_(p){const sh=sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS),rows=displayRows_(sh),items=Array.isArray(p.items)?p.items:[],byId={};rows.forEach((r,i)=>byId[key_(r[0])]={row:i+2,data:r});const errors=[],updates=[];items.forEach((item,i)=>{const found=byId[key_(item.maKetQua)];if(!found){errors.push({row:i+1,maKetQua:item.maKetQua||'',message:'Không tìm thấy mã kết quả.'});return;}if(p.maMon&&key_(found.data[2])!==key_(p.maMon)){errors.push({row:i+1,maKetQua:item.maKetQua,message:'Mã kết quả không thuộc môn đã chọn.'});return;}const rank=normalize_(item.xepHang),score=normalize_(item.diem);if(rank&&(!Number.isInteger(Number(rank))||Number(rank)<1)){errors.push({row:i+1,maKetQua:item.maKetQua,message:'Xếp hạng phải là số nguyên từ 1 trở lên.'});return;}if(score!==''&&!Number.isFinite(Number(score))){errors.push({row:i+1,maKetQua:item.maKetQua,message:'Điểm phải là số.'});return;}updates.push({row:found.row,values:[score,normalize_(item.thanhTich),rank,normalize_(item.ghiChu),now_()]});});updates.forEach(u=>sh.getRange(u.row,6,1,5).setValues([u.values]));return {updated:updates.length,failed:errors.length,errors:errors,results:listResults_(p.maMon)};}

function importTournamentPlan_(p){
  requireAdmin_(p);syncRegistrationData_();const items=Array.isArray(p.items)?p.items:[];if(!items.length)throw new Error('Excel chưa có dòng kế hoạch hợp lệ.');if(items.length>2000)throw new Error('Mỗi lần nhập tối đa 2.000 trận/dòng.');
  // Chỉ bổ sung mã môn còn thiếu; tuyệt đối không ghi đè cấu hình môn đã tồn tại.
  const gameSheet=sheet_(CONFIG.SHEETS.GAMES,GAME_HEADERS),gameRows=displayRows_(gameSheet),knownGames={};gameRows.forEach(r=>knownGames[key_(r[0])]=true);let gamesAdded=0;
  (Array.isArray(p.games)?p.games:[]).forEach((g,i)=>{const code=normalize_(g.maMon||g.MaMon||g.code),name=normalize_(g.tenMon||g.TenMon||g.name);if(!code||!name||knownGames[key_(code)])return;const type=normalize_(g.hinhThuc||g.HinhThuc||g.type)||'Đội nhóm';const min=Number(g.soTVToiThieu||g.SoTVToiThieu||g.min)||1;const max=Number(g.soTVToiDa||g.SoTVToiDa||g.max)||min;const description=normalize_(g.thanhPhan||g.ThanhPhan||g.moTa||g.MoTa);const format=normalize_(g.theThuc||g.TheThuc||g.format)||'Loại trực tiếp';const groups=Number(g.quyMo||g.QuyMo||g.soBang||g.SoBang)||1;const status=normalize_(g.trangThaiKeHoach||g.TrangThaiKeHoach||g.trangThai||g.TrangThai)||'Mở';const order=Number(g.thuTu||g.ThuTu||g.order)||gameRows.length+gamesAdded+1;gameSheet.appendRow([code,name,type,min,max,description,format,groups,0,0,status,order,now_(),now_()]);knownGames[key_(code)]=true;gamesAdded++;});
  // Build a stable game lookup from both the destination sheet and this workbook payload.
  const games=gameObjects_(),gameMap={};games.forEach(g=>gameMap[key_(g.code)]=g);
  (Array.isArray(p.games)?p.games:[]).forEach(g=>{const code=normalize_(g.maMon||g.MaMon||g.code),name=normalize_(g.tenMon||g.TenMon||g.name);if(code&&!gameMap[key_(code)])gameMap[key_(code)]={code:code,name:name,type:normalize_(g.hinhThuc||g.HinhThuc||g.type)||'Đội nhóm'};});
  // Import team master data from the workbook before validating match references. Never overwrite existing team codes.
  const teamSheet=sheet_(CONFIG.SHEETS.TEAMS,TEAM_HEADERS),teamRows=displayRows_(teamSheet),teamMap={};teamRows.forEach(r=>teamMap[key_(r[0])]={code:r[0],game:r[1],name:r[2]});let teamsAdded=0;const teamErrors=[];
  (Array.isArray(p.teams)?p.teams:[]).forEach((t,i)=>{const code=normalize_(t.maDoi||t.MaDoi),game=normalize_(t.maMon||t.MaMon),name=normalize_(t.tenDoi||t.TenDoi)||code;if(!code||!game){teamErrors.push({row:i+2,message:'Đội thiếu MaDoi hoặc MaMon.'});return;}if(!gameMap[key_(game)]){teamErrors.push({row:i+2,message:'Không tồn tại mã môn '+game+' cho đội '+code+'.'});return;}if(teamMap[key_(code)]){if(key_(teamMap[key_(code)].game)!==key_(game))teamErrors.push({row:i+2,message:'Mã đội '+code+' đã tồn tại nhưng thuộc môn '+teamMap[key_(code)].game+'.'});return;}teamSheet.appendRow([code,game,name,'',Number(t.soThanhVien||t.SoThanhVien)||0,normalize_(t.trangThai||t.TrangThai)||'Đã nhập từ kế hoạch',now_(),now_()]);teamMap[key_(code)]={code:code,game:game,name:name};teamsAdded++;});
  const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),existing=displayRows_(sh),existingMap={};existing.forEach((r,i)=>existingMap[key_(r[0])]={row:i+2,data:r});
  const seen={},errors=[],add=[];items.forEach((x,i)=>{const line=Number(x._row)||i+2,code=normalize_(x.maMon||x.MaMon||x.gameCode),match=normalize_(x.maTran||x.MaTran||x.matchCode),round=normalize_(x.vong||x.Vong||x.round),group=normalize_(x.bang||x.Bang||x.Bang_Luot||x.group),number=normalize_(x.tranSo||x.TranSo||x.matchNo);let a=normalize_(x.doiA||x.DoiA||x.DoiA_MaDoi||x.teamA),b=normalize_(x.doiB||x.DoiB||x.DoiB_MaDoi||x.teamB);let status=normalize_(x.trangThai||x.TrangThai)||'Chưa đấu';
    const fail=m=>errors.push({row:line,maTran:match,message:m});if(!code||!match||!round){fail('Thiếu MaMon, MaTran hoặc Vong.');return;}const game=gameMap[key_(code)];if(!game){fail('Không tồn tại mã môn: '+code);return;}if(removeVietnameseMarks_(game.type)!=='doi nhom'&&removeVietnameseMarks_(game.type)!=='do nhom'){fail('Kế hoạch trận chỉ dành cho môn đội nhóm; môn cá nhân dùng KET_QUA.');return;}
    // Excel bracket placeholders W1/L1 etc mean a team will be filled after the prior match; they are not team master IDs.
    const isPlaceholder=v=>/^[WL]\s*\d+$/i.test(normalize_(v))||/^(doi thang|doi thua)\s*(tran)?\s*\d*$/i.test(removeVietnameseMarks_(v));
    if(isPlaceholder(a))a='';if(isPlaceholder(b))b='';
    if(a&&b&&key_(a)===key_(b)){fail('Đội A và Đội B không thể giống nhau.');return;}
    const gameKey=key_(code),singleCompetitorAllowed=['lhg'].includes(gameKey)&&!!a&&!b;
    if((!a&&b)||(a&&!b&&!singleCompetitorAllowed)){fail('DoiA/DoiB phải cùng có mã, trừ dòng LHG ghi từng đội/lượt hoặc trận chờ đội thắng từ vòng trước.');return;}
    if(a&&!teamMap[key_(a)]){fail('Không tồn tại mã đội A '+a+' trong DOI_THI_DAU hoặc sheet đội của Excel.');return;}if(b&&!teamMap[key_(b)]){fail('Không tồn tại mã đội B '+b+' trong DOI_THI_DAU hoặc sheet đội của Excel.');return;}
    if(a&&key_(teamMap[key_(a)].game)!==gameKey){fail('Đội A '+a+' không thuộc mã môn '+code+'.');return;}if(b&&key_(teamMap[key_(b)].game)!==gameKey){fail('Đội B '+b+' không thuộc mã môn '+code+'.');return;}
    const statusKey=removeVietnameseMarks_(status).replace(/\s+/g,' ').trim();const allowedStatuses=['chua dau','dang dau','da dau','hoan','huy','tam dung','cho doi thang/thua','cho bch xac nhan nhom','cho nhap thu tu ve dich','cho xac nhan','chua xep nhom','cho bch xac nhan so doi'];if(!allowedStatuses.includes(statusKey)){fail('Trạng thái không hợp lệ: '+status);return;}if(seen[key_(match)]){fail('Mã trận bị trùng trong file Excel.');return;}seen[key_(match)]=1;
    const old=existingMap[key_(match)];if(old){const r=old.data,hasResult=normalize_(r[9])||normalize_(r[10])||normalize_(r[7])!==''||normalize_(r[8])!==''||key_(r[11])==='đãđấu';const same=key_(r[1])===key_(code)&&key_(r[5])===key_(a)&&key_(r[6])===key_(b)&&key_(r[2])===key_(round)&&key_(r[3])===key_(group);if(hasResult){if(!same)fail('Mã trận đã có kết quả; không được ghi đè dữ liệu cũ.');return;}if(!same){fail('Mã trận đã tồn tại với lịch khác; không ghi đè. Dùng mã trận mới hoặc kiểm tra bảng cũ.');return;}return;}
    add.push([match,code,round,group,number?Number(number):'',a,b,'','','','',status,now_(),now_()]);
  });
  if(add.length){sh.getRange(sh.getLastRow()+1,1,add.length,MATCH_HEADERS.length).setNumberFormat('@').setValues(add);sh.getRange(sh.getLastRow()-add.length+1,5,add.length,1).setNumberFormat('0');}
  const prizeErrors=[],prizes=Array.isArray(p.prizes)?p.prizes:[],ps=sheet_(CONFIG.SHEETS.PRIZES,PRIZE_HEADERS),pr=displayRows_(ps),pmap={};pr.forEach((r,i)=>pmap[key_(r[0]+'|'+r[1])]={row:i+2,data:r});let prizeAdded=0;prizes.forEach((x,i)=>{const code=normalize_(x.maMon||x.MaMon),prizeCode=normalize_(x.maGiai||x.MaGiai),name=normalize_(x.tenGiai||x.TenGiai);if(!code||!prizeCode||!name){prizeErrors.push({row:i+2,message:'Giải thưởng thiếu MaMon, MaGiai hoặc TenGiai.'});return;}if(!gameMap[key_(code)]){prizeErrors.push({row:i+2,message:'Không tồn tại mã môn '+code+' cho giải thưởng; kiểm tra MON_THI_DAU hoặc sheet môn trong Excel.'});return;}const amount=normalize_(x.tienThuong_VND||x.TienThuong_VND||x.tienThuong||'0').replace(/[,\s]/g,'');if(amount&&!/^\d+(\.\d+)?$/.test(amount)){prizeErrors.push({row:i+2,message:'Tiền thưởng phải là số.'});return;}const key=key_(code+'|'+prizeCode);if(pmap[key]){const old=pmap[key].data;if(key_(old[2])!==key_(name)){prizeErrors.push({row:i+2,message:'Mã giải đã tồn tại với tên khác; không ghi đè.'});}return;}ps.appendRow([code,prizeCode,name,normalize_(x.hinhThucThuong||x.HinhThucThuong),(amount===''?'':Number(amount)),normalize_(x.phamVi||x.PhamVi),normalize_(x.nguonQuyDinh||x.NguonQuyDinh),normalize_(x.ghiChu||x.GhiChu),now_()]);prizeAdded++;});
  return {gamesImported:gamesAdded,teamsImported:teamsAdded,teamErrors:teamErrors,imported:add.length,skipped:errors.length,errors:errors,prizesImported:prizeAdded,prizeErrors:prizeErrors,message:'Đã bổ sung '+gamesAdded+' mã môn, '+teamsAdded+' đội, thêm '+add.length+' trận mới; '+errors.length+' dòng trận bị từ chối; nhập thêm '+prizeAdded+' giải thưởng. Môn/trận/đội/giải cũ không bị xóa hoặc ghi đè.'};
}
function prepareResultEntries_(p){requireAdmin_(p);const game=findGame_(p.maMon);if(!game)throw new Error('Không tìm thấy môn.');const sh=sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS),rows=displayRows_(sh),exists={};rows.forEach(r=>{if(key_(r[2])===key_(game.code)){if(r[4])exists['V|'+key_(r[4])]=1;if(r[3])exists['T|'+key_(r[3])]=1;}});let add=[];if(game.type==='Cá nhân'){listAthletes_(game.code).filter(a=>a.hinhThuc==='Cá nhân').forEach(a=>{if(!exists['V|'+key_(a.maVDV)])add.push([id_('KQ'),' ',game.code,a.maDoi||'',a.maVDV,'','','','','',now_()]);});}else{listTeams_(game.code).filter(t=>!['hủy','huy'].includes(key_(t.trangThai))).forEach(t=>{if(!exists['T|'+key_(t.maDoi)])add.push([id_('KQ'),' ',game.code,t.maDoi,'','','','','','',now_()]);});}if(add.length)sh.getRange(sh.getLastRow()+1,1,add.length,RESULT_HEADERS.length).setNumberFormat('@').setValues(add);return {added:add.length,results:listResults_(game.code),message:'Đã tạo '+add.length+' dòng kết quả mới; kết quả cũ được giữ nguyên.'};}
function saveFinishOrder_(p){const game=findGame_(p.maMon);if(!game)throw new Error('Không tìm thấy mã môn.');const items=Array.isArray(p.items)?p.items:[];if(!items.length)throw new Error('Chưa có dòng kết quả.');const sh=sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS),rows=displayRows_(sh),map={};rows.forEach((r,i)=>map[key_(r[0])]={row:i+2,data:r});const errors=[],valid=[];items.forEach((x,i)=>{const f=map[key_(x.maKetQua)];if(!f){errors.push({row:i+1,maKetQua:x.maKetQua||'',message:'Không tìm thấy mã kết quả.'});return;}if(key_(f.data[2])!==key_(game.code)){errors.push({row:i+1,maKetQua:x.maKetQua,message:'Mã kết quả không thuộc môn.'});return;}const rank=normalize_(x.xepHang||x.thuTuVeDich),time=normalize_(x.thanhTich||x.thoiGian),score=normalize_(x.diem||x.diemSo);if(rank&&(!Number.isInteger(Number(rank))||Number(rank)<1)){errors.push({row:i+1,maKetQua:x.maKetQua,message:'Thứ tự/xếp hạng phải là số nguyên dương.'});return;}if(score!==''&&!Number.isFinite(Number(score))){errors.push({row:i+1,maKetQua:x.maKetQua,message:'Điểm phải là số.'});return;}valid.push({row:f.row,rank:rank?Number(rank):null,item:x,old:f.data,time:time,gender:normalize_(x.gioiTinh||'Khác'),group:normalize_(x.nhomXepHang||x.bang||x.ghiChu||'Tổng')});});
  // Quy tắc: Marathon xếp thời gian tăng dần riêng Nam/Nữ; Jumbo xếp thời gian tăng dần trong nhóm; LHG xếp thời gian tăng dần trong từng lượt/heat. Nếu không nhập thời gian có thể nhập xếp hạng thủ công.
  const timed=valid.filter(v=>v.time&&/^\d+(?:[.,:]\d+)*$/.test(v.time));const autoRank=key_(game.code)==='MARATHON'||key_(game.code)==='JUMBO'||key_(game.code)==='LHG';if(autoRank&&timed.length===valid.length&&valid.length&&valid.every(v=>v.rank===null)){const parseTime=v=>{const t=String(v.time).replace(',', '.');if(t.includes(':'))return t.split(':').reduce((a,n)=>a*60+Number(n),0);return Number(t);};const groups={};valid.forEach(v=>{const g=key_(game.code)==='MARATHON'?key_(v.gender):key_(v.group||'Tổng');(groups[g]||(groups[g]=[])).push(v);});Object.keys(groups).forEach(g=>{const arr=groups[g].sort((a,b)=>parseTime(a)-parseTime(b));arr.forEach((v,i)=>{if(i>0&&parseTime(v)===parseTime(arr[i-1])){if(!errors.some(e=>key_(e.maKetQua)===key_(v.item.maKetQua)))errors.push({row:items.indexOf(v.item)+1,maKetQua:v.item.maKetQua,message:'Thành tích trùng thời gian; cần trọng tài xác nhận thứ hạng thủ công.'});if(!errors.some(e=>key_(e.maKetQua)===key_(arr[i-1].item.maKetQua)))errors.push({row:items.indexOf(arr[i-1].item)+1,maKetQua:arr[i-1].item.maKetQua,message:'Thành tích trùng thời gian; cần trọng tài xác nhận thứ hạng thủ công.'});}else v.rank=i+1;});});}
  const seen={};valid.forEach(v=>{if(key_(game.code)==='MARATHON'&&v.rank!==null){const k=key_(v.gender)+'|'+v.rank;if(seen[k])errors.push({row:items.indexOf(v.item)+1,maKetQua:v.item.maKetQua,message:'Trùng thứ hạng trong cùng giới tính Marathon.'});else seen[k]=1;}});const badIds=new Set(errors.map(e=>key_(e.maKetQua)));const accepted=valid.filter(v=>!badIds.has(key_(v.item.maKetQua)));accepted.forEach(v=>{const item=v.item;sh.getRange(v.row,6,1,5).setValues([[normalize_(item.diem||item.diemSo),v.time,String(v.rank||''),normalize_(item.ghiChu),now_()]]);});return {updated:accepted.length,failed:errors.length,errors:errors,results:listResults_(game.code),message:'Đã lưu '+accepted.length+' dòng; '+errors.length+' dòng lỗi.'};}

function listPrizes_(gameCode){return displayRows_(sheet_(CONFIG.SHEETS.PRIZES,PRIZE_HEADERS)).filter(r=>!gameCode||key_(r[0])===key_(gameCode)).map(r=>({maMon:r[0],maGiai:r[1],tenGiai:r[2],hinhThucThuong:r[3],tienThuong:r[4]===''?null:(Number(r[4])||0),phamVi:r[5],nguonQuyDinh:r[6],ghiChu:r[7]}));}
function getSummary_(gameCode){const game=findGame_(gameCode);if(!game)throw new Error('Không tìm thấy môn.');const teams=listTeams_(gameCode),athletes=listAthletes_(gameCode),matches=listMatches_(gameCode),results=listResults_(gameCode),prizes=listPrizes_(gameCode);const rank=n=>Number(n)||999999;results.sort((a,b)=>rank(a.xepHang)-rank(b.xepHang)||String(a.maVDV).localeCompare(String(b.maVDV)));return {game:game,teams:teams,athletes:athletes,matches:matches,results:results,prizes:prizes,generatedAt:now_().toISOString()};}

function registrationReport_(){const sh=getRegistrationSheet_();return displayRows_(sh).map(r=>({timestamp:r[0],loaiDangKy:r[1],tenFormTenDoi:r[4],monDangKy:r[5],danhSachThanhVien:r[6],phongBan:r[7],boPhan:r[8],registrationKeys:r[9],confirmationCode:r[10]}));}
function findRegistrationByCode_(code){const target=key_(code),rows=displayRows_(getRegistrationSheet_()),r=rows.find(x=>key_(x[10])===target);if(!r)return null;return {timestamp:r[0],loaiDangKy:r[1],tenFormTenDoi:r[4],monDangKy:r[5],danhSachThanhVien:r[6],phongBan:r[7],boPhan:r[8],confirmationCode:r[10]};}
function dashboard_(){syncRegistrationData_();const games=gameObjects_(),reg=registrationReport_(),teams=listTeams_(),ath=listAthletes_();return {registrations:reg.length,individuals:reg.filter(r=>r.loaiDangKy==='Cá nhân').length,teams:teams.length,athletes:ath.length,games:games.map(g=>({code:g.code,name:g.name,type:g.type,status:g.status,count:reg.filter(r=>key_(r.monDangKy)===key_(g.name)).length}))};}

function verifyCitizenId_(cccd){
  const value=normalize_(cccd).replace(/\D/g,'');
  if(!/^\d{9}$|^\d{12}$/.test(value)) throw new Error('Vui lòng nhập CCCD/CMND gồm 9 hoặc 12 chữ số.');
  const sh=SpreadsheetApp.openById(CONFIG.EMPLOYEE_FILE_ID).getSheetByName(CONFIG.EMPLOYEE_SHEET);
  if(!sh) throw new Error("Không tìm thấy tab '"+CONFIG.EMPLOYEE_SHEET+"'.");
  const values=sh.getDataRange().getDisplayValues();
  const found=values.slice(1).some(r=>normalize_(r[5]).replace(/\D/g,'')===value);
  if(!found) throw new Error('Không xác minh được CCCD. Vui lòng kiểm tra lại hoặc liên hệ Ban tổ chức.');
  const token=Utilities.getUuid()+Utilities.getUuid();
  CacheService.getScriptCache().put('SPORTS_CCCD_'+token,sha256Hex_(value),60*60*4);
  return {accessToken:token,expiresIn:14400};
}
function requireCccdAccess_(token){ if(!token || !CacheService.getScriptCache().get('SPORTS_CCCD_'+normalize_(token))) throw new Error('Vui lòng xác minh CCCD trước khi tra cứu nhân viên.'); }
function importRegistrations_(p){
  requireAdmin_(p); const items=Array.isArray(p.items)?p.items:[];
  if(!items.length) throw new Error('File không có dòng dữ liệu hợp lệ.');
  if(items.length>1500) throw new Error('Mỗi lần chỉ nhập tối đa 1.500 dòng.');
  const sh=getRegistrationSheet_(), games=gameObjects_(), existing=getExistingRegistrations_();
  const values=[], errors=[];
  items.forEach((x,i)=>{
    const loai=normalize_(x.loaiDangKy||x.hinhThuc||x.type),ten=normalize_(x.tenFormTenDoi||x.tenDoi||x.hoTen),mon=normalize_(x.monDangKy||x.monThiDau||x.mon),members=normalize_(x.danhSachThanhVien||x.danhSachThanhVienChiTiet),keys=normalize_(x.memberKeys||x.maNVDangKy||x.maNV||x.cccd);
    if(!['Cá nhân','Đội nhóm'].includes(loai)||!ten||!mon){errors.push('Dòng '+(i+2)+': thiếu hình thức, tên đăng ký hoặc môn thi đấu.');return;}
    const g=games.find(a=>key_(a.name)===key_(mon)||key_(a.code)===key_(mon)); if(!g){errors.push('Dòng '+(i+2)+': không tìm thấy môn '+mon+'.');return;}
    if(g.type!==loai){errors.push('Dòng '+(i+2)+': hình thức không khớp môn '+g.name+'.');return;}
    if(existing.some(r=>key_(r.mon)===key_(g.name)&&key_(r.keys)===key_(keys))){errors.push('Dòng '+(i+2)+': có vẻ đã đăng ký trùng.');return;}
    const code=confirmationCode_(); values.push([now_(),loai,normalize_(x.congTy||x.khoi||''),normalize_(x.phongBan||''),ten,g.name,members,normalize_(x.phongBan||''),normalize_(x.boPhan||''),keys,code,'']);
  });
  if(values.length) sh.getRange(sh.getLastRow()+1,1,values.length,REG_HEADERS.length).setValues(values);
  return {imported:values.length,skipped:errors.length,errors:errors.slice(0,100),message:'Đã nhập '+values.length+' dòng; bỏ qua '+errors.length+' dòng cần kiểm tra.'};
}

function doGet(e){
  try{const p=(e&&e.parameter)||{},action=normalize_(p.action);if(!action&&p.code)return json_({result:'success',data:findRegistrationByCode_(p.code)});if(action==='health')return json_({result:'success',message:'API V4 is running.'});if(action==='getRegistrationStatus')return json_({result:'success',data:registrationStatus_()});if(action==='getGames')return json_({result:'success',data:publicGames_()});if(action==='verify'){const row=findRegistrationByCode_(p.code);return row?json_({result:'success',data:row}):json_({result:'not_found',message:'Không tìm thấy mã xác nhận.'});}if(action==='getEmployees'){requireCccdAccess_(p.accessToken);return json_({result:'success',data:getEmployees_().map(e=>({hoTen:e.hoTen,maNV:e.maNV,cccdTail:String(e.cccd||'').slice(-3),gioiTinh:e.gioiTinh,phongBan:e.phongBan,boPhan:e.boPhan,chucVu:e.chucVu,hoTenKhongDau:e.hoTenKhongDau}))});}if(!action)return json_({result:'error',message:'Vui lòng xác minh CCCD trước khi tra cứu.'});if(!isValidSession_(p.token))return json_({result:'unauthorized',message:'Phiên Admin không hợp lệ hoặc đã hết hạn.'});if(action==='getAdminSettings')return json_({result:'success',data:getAdminSettings_()});if(action==='getGamesAdmin')return json_({result:'success',data:gameObjects_()});if(action==='getReport')return json_({result:'success',data:registrationReport_()});if(action==='getTeams')return json_({result:'success',data:listTeams_(p.game||'')});if(action==='getAthletes')return json_({result:'success',data:listAthletes_(p.game||'')});if(action==='getMatches')return json_({result:'success',data:listMatches_(p.game||'')});if(action==='getResults')return json_({result:'success',data:listResults_(p.game||'')});if(action==='getTournamentSummary')return json_({result:'success',data:getSummary_(p.game)});if(action==='getPrizes')return json_({result:'success',data:listPrizes_(p.game||'')});if(action==='getSpreadsheetMode')return json_({result:'success',data:getSpreadsheetMode()});if(action==='getDashboard')return json_({result:'success',data:dashboard_()});return json_({result:'error',message:'Action không hợp lệ.'});}catch(err){console.error(err);return json_({result:'error',message:err.message||String(err)});}
}
function doPost(e){
  if(!e||!e.postData||typeof e.postData.contents!=='string')return json_({result:'error',message:'doPost() chỉ được gọi qua HTTP POST Web App.'});
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    let p;try{p=JSON.parse(e.postData.contents||'{}');}catch(err){return json_({result:'error',message:'JSON không hợp lệ.'});}
    const action=normalize_(p.action);
    if(action==='health')return json_({result:'success',message:'POST API V4 is running.'});
    if(action==='verifyCitizenId')return json_({result:'success',data:verifyCitizenId_(p.cccd),message:'Xác minh CCCD thành công.'});
    if(action==='adminLogin'){const pass=normalize_(p.password),hash=getAdminPasswordHash_();if(!hash)return json_({result:'error',message:'Admin chưa được thiết lập. Hãy chạy setupAdmin().'});if(!pass||sha256Hex_(pass)!==hash)return json_({result:'error',message:'Mật khẩu Admin không chính xác.'});return json_({result:'success',token:createSession_()});}
    if(action==='adminChangePassword'){requireAdmin_(p);const old=normalize_(p.oldPassword),nw=normalize_(p.newPassword);if(nw.length<8)throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');if(sha256Hex_(old)!==getAdminPasswordHash_())throw new Error('Mật khẩu hiện tại không đúng.');const props=PropertiesService.getScriptProperties();props.setProperty('ADMIN_PASSWORD_HASH',sha256Hex_(nw));props.setProperty('ADMIN_SESSION_VERSION',String(Date.now()));return json_({result:'success',message:'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'});}
    if(action==='adminSetDeadline'){requireAdmin_(p);const v=p.deadlineMs===null||normalize_(p.deadlineMs)===''?'':Number(p.deadlineMs);if(v!==''&&(!Number.isFinite(v)||v<=0))throw new Error('Thời hạn không hợp lệ.');PropertiesService.getScriptProperties().setProperty('REGISTRATION_DEADLINE_MS',v===''?'':String(v));return json_({result:'success',data:getAdminSettings_(),message:'Đã cập nhật thời hạn đăng ký.'});}
    if(action==='clearEmployeeCache'){requireAdmin_(p);CacheService.getScriptCache().remove('SPORTS_EMPLOYEES_V4');return json_({result:'success'});}
    if(action==='setupSystem'){requireAdmin_(p);return json_({result:'success',message:setupSystem()});}
    if(action==='saveGame'){requireAdmin_(p);return json_({result:'success',data:saveGame_(p)});}
    if(action==='deleteGame'){requireAdmin_(p);return json_({result:'success',data:deleteGame_(p)});}
    if(action==='importRegistrations'){requireAdmin_(p);return json_({result:'success',data:importRegistrations_(p),message:'Đã xử lý file nhập Excel.'});}
    if(action==='syncData'){requireAdmin_(p);return json_({result:'success',data:syncRegistrationData_(),message:'Đã đồng bộ dữ liệu đăng ký → đội/VĐV.'});}
    if(action==='generateTournament'){requireAdmin_(p);return json_({result:'success',data:generateTournament_(p.game),message:'Đã tạo bảng thi đấu nếu chưa có lịch cũ.'});}
    if(action==='importTournamentPlan'){requireAdmin_(p);return json_({result:'success',data:importTournamentPlan_(p),message:'Đã kiểm tra kế hoạch thi đấu.'});}
    if(action==='saveFinishOrder'){requireAdmin_(p);return json_({result:'success',data:saveFinishOrder_(p),message:'Đã xử lý thứ tự về đích.'});}
    if(action==='prepareResultEntries'){requireAdmin_(p);return json_({result:'success',data:prepareResultEntries_(p),message:'Đã chuẩn bị danh sách kết quả.'});}
    if(action==='saveMatchResult'){requireAdmin_(p);return json_({result:'success',data:updateMatchResult_(p),message:'Đã lưu kết quả trận đấu.'});}
    if(action==='saveIndividualResults'){requireAdmin_(p);return json_({result:'success',data:saveIndividualResults_(p),message:'Đã lưu kết quả cá nhân.'});}
    if(action==='register'){
      requireCccdAccess_(p.accessToken);assertRegistrationOpen_();validateRegistration_(p);checkDuplicateRegistration_(p);const sh=getRegistrationSheet_(),code=confirmationCode_(),deadline=getRegistrationDeadlineMs_();
      sh.appendRow([now_(),normalize_(p.loaiDangKy),'','',normalize_(p.tenFormTenDoi),normalize_(p.monDangKy),normalize_(p.danhSachThanhVien),normalize_(p.phongBan),normalize_(p.boPhan),normalize_(p.memberKeys||p.maNVDangKy||p.cccdDangKy),code,deadline?new Date(deadline):'']);
      // Chi luu dang ky trong request nay. Dong bo doi/VDV la tac vu nang,
      // khong chay dong bo trong request cong nhan de tranh timeout / Failed to fetch.
      return json_({result:'success',message:'Đăng ký đã được lưu. Ban tổ chức có thể đồng bộ danh sách thi đấu từ Admin.',confirmationCode:code,registrationStatus:registrationStatus_(),data:{loaiDangKy:p.loaiDangKy,tenFormTenDoi:p.tenFormTenDoi,monDangKy:p.monDangKy,danhSachThanhVien:p.danhSachThanhVien,phongBan:p.phongBan,boPhan:p.boPhan}});
    }
    return json_({result:'error',message:'Action POST không hợp lệ: '+action});
  }catch(err){console.error(err);return json_({result:'error',message:err.message||String(err)});}finally{lock.releaseLock();}
}
function doOptions(e){
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}
function requireAdmin_(p){if(!isValidSession_(p.token))throw new Error('Phiên Admin không hợp lệ hoặc đã hết hạn.');}
function saveGame_(p){
  const sh=sheet_(CONFIG.SHEETS.GAMES,GAME_HEADERS),rows=displayRows_(sh),code=normalize_(p.code).toUpperCase().replace(/[^A-Z0-9_-]/g,'').substring(0,30),name=normalize_(p.name),type=normalize_(p.type)||'Đội nhóm',min=Math.max(1,Number(p.min)||1),max=Math.max(min,Number(p.max)||min),status=normalize_(p.status)||'Mở';if(!code||!name)throw new Error('Mã môn và tên môn là bắt buộc.');if(!['Cá nhân','Đội nhóm'].includes(type))throw new Error('Hình thức không hợp lệ.');
  const duplicate=rows.findIndex(r=>key_(r[0])===key_(code)&&key_(r[0])!==key_(p.oldCode||''));if(duplicate>=0)throw new Error('Mã môn đã tồn tại.');
  const values=[code,name,type,min,max,normalize_(p.description),normalize_(p.format)||'Loại trực tiếp',Math.max(1,Number(p.groups)||1),Math.max(0,Number(p.teamsPerGroup)||0),Math.max(0,Number(p.advance)||0),status,Number(p.order)||99,now_(),now_()];
  const idx=rows.findIndex(r=>key_(r[0])===key_(p.oldCode||code));if(idx>=0){sh.getRange(idx+2,1,1,GAME_HEADERS.length).setValues([values]);}else sh.appendRow(values);return gameObjects_().find(g=>key_(g.code)===key_(code));
}
function deleteGame_(p){const game=findGame_(p.code);if(!game)throw new Error('Không tìm thấy môn.');const has=registrationReport_().some(r=>key_(r.monDangKy)===key_(game.name));if(has){const sh=sheet_(CONFIG.SHEETS.GAMES,GAME_HEADERS),rows=displayRows_(sh),i=rows.findIndex(r=>key_(r[0])===key_(game.code));sh.getRange(i+2,11).setValue('Khóa');return {mode:'lock',message:'Môn đã có dữ liệu đăng ký nên được chuyển sang Khóa, không xóa dữ liệu.'};}const sh=sheet_(CONFIG.SHEETS.GAMES,GAME_HEADERS),rows=displayRows_(sh),i=rows.findIndex(r=>key_(r[0])===key_(game.code));if(i>=0)sh.deleteRow(i+2);return {mode:'delete',message:'Đã xóa môn.'};}
function testRouting(){return {get:JSON.parse(doGet({parameter:{action:'health'}}).getContent()),post:JSON.parse(doPost({postData:{contents:JSON.stringify({action:'health'})}}).getContent())};}
