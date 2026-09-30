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
    RESULTS: 'KET_QUA'
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
  const ss=SpreadsheetApp.openById(CONFIG.REGISTRATION_FILE_ID);
  ensureSheet_(ss,CONFIG.REGISTRATION_SHEET,REG_HEADERS);
  const gs=ensureSheet_(ss,CONFIG.SHEETS.GAMES,GAME_HEADERS);
  ensureSheet_(ss,CONFIG.SHEETS.TEAMS,TEAM_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.ATHLETES,ATHLETE_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.MATCHES,MATCH_HEADERS); ensureSheet_(ss,CONFIG.SHEETS.RESULTS,RESULT_HEADERS);
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
function ss_(){return SpreadsheetApp.openById(CONFIG.REGISTRATION_FILE_ID);}
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
  return normalize_(text).split(' | ').map(s=>s.trim()).filter(Boolean).map((part,i)=>{
    const name=(part.match(/^\d+\.\s*(.*?)(?=\s+-\s*MNV:|\s+-\s*CCCD|\s*\[|$)/i)||[])[1]||part;
    const maNV=(part.match(/MNV:\s*([^\]\-]+?)(?=\s*-\s*CCCD|\s*\[|$)/i)||[])[1]||'';
    const cccd4=(part.match(/CCCD\s*4\s*số\s*cuối:\s*(\d{4})/i)||[])[1]||'';
    const dept=(part.match(/Phòng ban:\s*([^\-\]]+)/i)||[])[1]||'';
    const section=(part.match(/Bộ phận:\s*([^\-\]]+)/i)||[])[1]||'';
    const pos=(part.match(/Chức vụ:\s*([^\]]+)/i)||[])[1]||'';
    return {index:i+1,hoTen:normalize_(name),maNV:normalize_(maNV),cccd4:normalize_(cccd4),phongBan:normalize_(dept),boPhan:normalize_(section),chucVu:normalize_(pos)};
  });
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
  syncRegistrationData_();const game=findGame_(gameCode);if(!game)throw new Error('Không tìm thấy môn.');if(game.type!=='Đội nhóm')return generateIndividualEntries_(game.code);
  const teams=listTeams_(game.code).filter(t=>key_(t.trangThai)!=='hủy'&&key_(t.trangThai)!=='huy');if(teams.length<2)throw new Error('Cần ít nhất 2 đội đã đăng ký để tạo bảng đấu.');
  clearMatchesForGame_(game.code);const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),n=teams.length;let size=1;while(size<n)size*=2;const seeded=teams.map(t=>t.maDoi);while(seeded.length<size)seeded.push('BYE');
  let current=seeded.slice(),round=1;while(current.length>1){const roundName=round===1?nameRound_(size):'Vòng '+round;for(let i=0;i<current.length;i+=2){const a=current[i],b=current[i+1],matchCode=game.code+'-R'+round+'-'+String(i/2+1).padStart(2,'0');sh.appendRow([matchCode,game.code,roundName,'',i/2+1,a==='BYE'?'':a,b==='BYE'?'':b,'','','','','Chưa đấu',now_(),now_()]);}current=new Array(Math.ceil(current.length/2)).fill('');round++;}
  return {game:game,teams:teams,matches:listMatches_(game.code),message:'Đã tạo lại bảng đấu cho '+teams.length+' đội.'};
}
function nameRound_(size){if(size===2)return'Chung kết';if(size===4)return'Bán kết';if(size===8)return'Tứ kết';return'Vòng '+size+' đội';}
function generateIndividualEntries_(gameCode){
  const sh=sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS);const rows=displayRows_(sh);const athletes=listAthletes_(gameCode).filter(a=>a.hinhThuc==='Cá nhân');for(let i=rows.length-1;i>=0;i--)if(key_(rows[i][2])===key_(gameCode))sh.deleteRow(i+2);athletes.forEach(a=>sh.appendRow([id_('KQ'),' ',gameCode,a.maDoi||'',a.maVDV,'','','','','',now_()]));return {game:findGame_(gameCode),athletes:athletes,entries:listResults_(gameCode),message:'Đã tạo danh sách thi cá nhân.'};}
function listMatches_(gameCode){const rows=displayRows_(sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS));return rows.filter(r=>!gameCode||key_(r[1])===key_(gameCode)).map(r=>({maTran:r[0],maMon:r[1],vong:r[2],bang:r[3],tranSo:Number(r[4])||0,doiA:r[5],doiB:r[6],diemA:r[7],diemB:r[8],doiThang:r[9],doiThua:r[10],trangThai:r[11]}));}
function listResults_(gameCode){const rows=displayRows_(sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS));return rows.filter(r=>!gameCode||key_(r[2])===key_(gameCode)).map(r=>({maKetQua:r[0],maTran:r[1],maMon:r[2],maDoi:r[3],maVDV:r[4],diem:r[5],thanhTich:r[6],xepHang:r[7],ghiChu:r[8],updatedAt:r[9]}));}
function updateMatchResult_(p){
  const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),rows=displayRows_(sh),idx=rows.findIndex(r=>key_(r[0])===key_(p.maTran));if(idx<0)throw new Error('Không tìm thấy trận.');const row=idx+2,a=normalize_(p.diemA),b=normalize_(p.diemB);if(a===''||b==='')throw new Error('Vui lòng nhập đủ điểm.');const na=Number(a),nb=Number(b);if(!Number.isFinite(na)||!Number.isFinite(nb))throw new Error('Điểm không hợp lệ.');const r=rows[idx],winner=na>nb?r[5]:nb>na?r[6]:'';if(!winner)throw new Error('Trận hòa chưa có quy tắc xử lý. Hãy nhập lại điểm hoặc bổ sung xử lý tie-break.');const loser=winner===r[5]?r[6]:r[5];sh.getRange(row,8,1,6).setValues([[na,nb,winner,loser,'Đã đấu',now_()]]);advanceWinner_(r[0],r[1],winner);return listMatches_(r[1]);}
function advanceWinner_(matchCode,gameCode,winner){const sh=sheet_(CONFIG.SHEETS.MATCHES,MATCH_HEADERS),rows=displayRows_(sh),i=rows.findIndex(r=>key_(r[0])===key_(matchCode));if(i<0)return;const currentRound=Number(matchCode.match(/-R(\d+)-/i)?.[1]||1),slot=Number(matchCode.match(/-(\d+)$/)?.[1]||1);const nextCode=gameCode+'-R'+(currentRound+1)+'-'+String(Math.ceil(slot/2)).padStart(2,'0');const j=rows.findIndex(r=>key_(r[0])===key_(nextCode));if(j<0)return;const col=(slot%2===1)?6:7;sh.getRange(j+2,col).setValue(winner);}
function saveIndividualResults_(p){const sh=sheet_(CONFIG.SHEETS.RESULTS,RESULT_HEADERS),rows=displayRows_(sh);let updated=0;(Array.isArray(p.items)?p.items:[]).forEach(item=>{const idx=rows.findIndex(r=>key_(r[0])===key_(item.maKetQua));if(idx<0)return;const row=idx+2;sh.getRange(row,6,1,5).setValues([[normalize_(item.diem),normalize_(item.thanhTich),normalize_(item.xepHang),normalize_(item.ghiChu),now_()]]);updated++;});return {updated,results:listResults_(p.maMon)};}

function registrationReport_(){const sh=getRegistrationSheet_();return displayRows_(sh).map(r=>({timestamp:r[0],loaiDangKy:r[1],tenFormTenDoi:r[4],monDangKy:r[5],danhSachThanhVien:r[6],phongBan:r[7],boPhan:r[8],registrationKeys:r[9],confirmationCode:r[10]}));}
function findRegistrationByCode_(code){const target=key_(code),rows=displayRows_(getRegistrationSheet_()),r=rows.find(x=>key_(x[10])===target);if(!r)return null;return {timestamp:r[0],loaiDangKy:r[1],tenFormTenDoi:r[4],monDangKy:r[5],danhSachThanhVien:r[6],phongBan:r[7],boPhan:r[8],confirmationCode:r[10]};}
function dashboard_(){syncRegistrationData_();const games=gameObjects_(),reg=registrationReport_(),teams=listTeams_(),ath=listAthletes_();return {registrations:reg.length,individuals:reg.filter(r=>r.loaiDangKy==='Cá nhân').length,teams:teams.length,athletes:ath.length,games:games.map(g=>({code:g.code,name:g.name,type:g.type,status:g.status,count:reg.filter(r=>key_(r.monDangKy)===key_(g.name)).length}))};}

function doGet(e){
  try{const p=(e&&e.parameter)||{},action=normalize_(p.action);if(!action&&p.code)return json_({result:'success',data:findRegistrationByCode_(p.code)});if(action==='health')return json_({result:'success',message:'API V4 is running.'});if(action==='getRegistrationStatus')return json_({result:'success',data:registrationStatus_()});if(action==='getGames')return json_({result:'success',data:publicGames_()});if(action==='verify'){const row=findRegistrationByCode_(p.code);return row?json_({result:'success',data:row}):json_({result:'not_found',message:'Không tìm thấy mã xác nhận.'});}if(action==='getEmployees'||!action)return json_({result:'success',data:getEmployees_()});if(!isValidSession_(p.token))return json_({result:'unauthorized',message:'Phiên Admin không hợp lệ hoặc đã hết hạn.'});if(action==='getAdminSettings')return json_({result:'success',data:getAdminSettings_()});if(action==='getGamesAdmin')return json_({result:'success',data:gameObjects_()});if(action==='getReport')return json_({result:'success',data:registrationReport_()});if(action==='getTeams')return json_({result:'success',data:listTeams_(p.game||'')});if(action==='getAthletes')return json_({result:'success',data:listAthletes_(p.game||'')});if(action==='getMatches')return json_({result:'success',data:listMatches_(p.game||'')});if(action==='getResults')return json_({result:'success',data:listResults_(p.game||'')});if(action==='getDashboard')return json_({result:'success',data:dashboard_()});return json_({result:'error',message:'Action không hợp lệ.'});}catch(err){console.error(err);return json_({result:'error',message:err.message||String(err)});}
}
function doPost(e){
  if(!e||!e.postData||typeof e.postData.contents!=='string')return json_({result:'error',message:'doPost() chỉ được gọi qua HTTP POST Web App.'});
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    let p;try{p=JSON.parse(e.postData.contents||'{}');}catch(err){return json_({result:'error',message:'JSON không hợp lệ.'});}
    const action=normalize_(p.action);
    if(action==='health')return json_({result:'success',message:'POST API V4 is running.'});
    if(action==='adminLogin'){const pass=normalize_(p.password),hash=getAdminPasswordHash_();if(!hash)return json_({result:'error',message:'Admin chưa được thiết lập. Hãy chạy setupAdmin().'});if(!pass||sha256Hex_(pass)!==hash)return json_({result:'error',message:'Mật khẩu Admin không chính xác.'});return json_({result:'success',token:createSession_()});}
    if(action==='adminChangePassword'){requireAdmin_(p);const old=normalize_(p.oldPassword),nw=normalize_(p.newPassword);if(nw.length<8)throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự.');if(sha256Hex_(old)!==getAdminPasswordHash_())throw new Error('Mật khẩu hiện tại không đúng.');const props=PropertiesService.getScriptProperties();props.setProperty('ADMIN_PASSWORD_HASH',sha256Hex_(nw));props.setProperty('ADMIN_SESSION_VERSION',String(Date.now()));return json_({result:'success',message:'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'});}
    if(action==='adminSetDeadline'){requireAdmin_(p);const v=p.deadlineMs===null||normalize_(p.deadlineMs)===''?'':Number(p.deadlineMs);if(v!==''&&(!Number.isFinite(v)||v<=0))throw new Error('Thời hạn không hợp lệ.');PropertiesService.getScriptProperties().setProperty('REGISTRATION_DEADLINE_MS',v===''?'':String(v));return json_({result:'success',data:getAdminSettings_(),message:'Đã cập nhật thời hạn đăng ký.'});}
    if(action==='clearEmployeeCache'){requireAdmin_(p);CacheService.getScriptCache().remove('SPORTS_EMPLOYEES_V4');return json_({result:'success'});}
    if(action==='setupSystem'){requireAdmin_(p);return json_({result:'success',message:setupSystem()});}
    if(action==='saveGame'){requireAdmin_(p);return json_({result:'success',data:saveGame_(p)});}
    if(action==='deleteGame'){requireAdmin_(p);return json_({result:'success',data:deleteGame_(p)});}
    if(action==='syncData'){requireAdmin_(p);return json_({result:'success',data:syncRegistrationData_(),message:'Đã đồng bộ dữ liệu đăng ký → đội/VĐV.'});}
    if(action==='generateTournament'){requireAdmin_(p);return json_({result:'success',data:generateTournament_(p.game),message:'Đã tạo lại bảng thi đấu.'});}
    if(action==='saveMatchResult'){requireAdmin_(p);return json_({result:'success',data:updateMatchResult_(p),message:'Đã lưu kết quả trận đấu.'});}
    if(action==='saveIndividualResults'){requireAdmin_(p);return json_({result:'success',data:saveIndividualResults_(p),message:'Đã lưu kết quả cá nhân.'});}
    if(action==='register'){
      assertRegistrationOpen_();validateRegistration_(p);checkDuplicateRegistration_(p);const sh=getRegistrationSheet_(),code=confirmationCode_(),deadline=getRegistrationDeadlineMs_();
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
