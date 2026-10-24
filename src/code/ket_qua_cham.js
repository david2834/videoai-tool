// Đọc điểm Claude chấm và chuyển trạng thái
const items = $input.all();
const out = [];
items.forEach((it, i) => {
  const t = $('Gói yêu cầu Claude').itemMatching(i).json.task;
  const res = it.json || {};
  let kq = null;
  let why = '';
  if (res.error && !res.content) {
    // lỗi key, hết credit, mạng...: giữ nguyên trạng thái để lượt sau chấm lại
    out.push(db(t.kind === 'anh' ? 'mau_do' : 'hang_doi', 'update', { id: t.row_id, ghi_chu_loi: 'Gọi Claude lỗi: ' + errText(res.error) }));
    return;
  }
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') why = 'Claude dừng: ' + res.stop_reason;
  else {
    const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    try { kq = JSON.parse(text); } catch (e) { why = 'Claude trả về không đúng định dạng'; }
  }
  if (kq) kq.dat = kq.dat && kq.khop_trang_phuc && kq.diem >= 7;
  const note = kq ? `${kq.diem}/10. ${kq.nhan_xet}${kq.loi && kq.loi.length ? ' | Lỗi: ' + kq.loi.join('; ') : ''}` : why;

  if (t.kind === 'anh') {
    if (!kq) out.push(db('mau_do', 'update', { id: t.row_id, trang_thai: SP.CAN_NGUOI_XEM, ai_nhan_xet_anh: note + '. Cần người xem.' }));
    else if (kq.dat) out.push(db('mau_do', 'update', { id: t.row_id, trang_thai: SP.ANH_OK, ai_nhan_xet_anh: note }));
    else if (t.so_lan_ghep < t.max_ghep) out.push(db('mau_do', 'update', { id: t.row_id, trang_thai: SP.MOI, ai_nhan_xet_anh: note, ghi_chu_loi: 'Claude chấm không đạt, ghép lại' }));
    else out.push(db('mau_do', 'update', { id: t.row_id, trang_thai: SP.CAN_NGUOI_XEM, ai_nhan_xet_anh: note, ghi_chu_loi: `Đã ghép ${t.so_lan_ghep} lần vẫn chưa đạt. Ảnh dùng được thì chọn "Ảnh OK".` }));
  } else {
    if (!kq) out.push(db('hang_doi', 'update', { id: t.row_id, trang_thai: JOB.CHO_DUYET, ai_nhan_xet: note + '. AI chưa kiểm, người duyệt xem kỹ.' }));
    else out.push(db('hang_doi', 'update', { id: t.row_id, trang_thai: kq.dat ? JOB.CHO_DUYET : JOB.AI_LOI, ai_nhan_xet: note }));
  }
});
return out;
