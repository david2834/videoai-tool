// ===== Dùng chung (tự chèn vào mọi khối Code) =====
const SP = {
  MOI: 'Mới', DANG_GHEP: 'Đang ghép đồ', CHO_AI: 'Chờ AI kiểm ảnh', CAN_NGUOI_XEM: 'Cần người xem ảnh',
  ANH_OK: 'Ảnh OK', DANG_LAM_VIDEO: 'Đang làm video', XONG: 'Xong', THIEU_VIDEO: 'Xong (thiếu video)',
  LOI: 'Lỗi', TAM_DUNG: 'Tạm dừng',
};
const JOB = {
  CHO_TAO: 'Chờ tạo', DANG_TAO: 'Đang tạo', CHO_AI: 'Chờ AI kiểm', CHO_DUYET: 'Chờ duyệt',
  AI_LOI: 'AI báo lỗi', LOI: 'Lỗi',
};
const CLIP = { DUNG: 'Dùng', NEN_LOAI: 'Nên loại', LOAI: 'Loại' };
const HF_FAIL = ['failed', 'nsfw', 'canceled', 'cancelled'];
const NOW = $now.toFormat('yyyy-MM-dd HH:mm:ss');
const TODAY = $now.toFormat('yyyy-MM-dd');

function minutesSince(s) {
  if (!s) return 0;
  const t = DateTime.fromFormat(String(s), 'yyyy-MM-dd HH:mm:ss', { zone: $now.zone });
  return t.isValid ? $now.diff(t, 'minutes').minutes : 0;
}
function errText(x) {
  if (!x) return '';
  if (typeof x === 'string') return x.slice(0, 300);
  const parts = [x.httpCode && 'HTTP ' + x.httpCode, x.message, x.description].filter(Boolean);
  const m = parts.length ? parts.join(' | ') : (x.error && (x.error.message || x.error)) || x;
  return (typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 400);
}
// Một lệnh ghi bảng: r = 0 để đi vào nhánh "Ghi bảng"
function db(tbl, op, data) {
  return { json: { r: 0, tbl, op, data } };
}
// =====
