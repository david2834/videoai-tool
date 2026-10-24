// Ảnh/khung hình cho Claude đã chuẩn bị xong chưa
const items = $input.all();
return items.map((it, i) => {
  const t = $('Phân việc').itemMatching(i).json;
  const ex = it.json || {};
  if (ex.exitCode === 0 && !ex.error) return { json: { r: 1, task: t } };
  const why = errText(ex.stderr || ex.error) || 'không rõ';
  if (t.kind === 'anh') return db('mau_do', 'update', { id: t.row_id, trang_thai: SP.CAN_NGUOI_XEM, ai_nhan_xet_anh: 'Không chuẩn bị được ảnh để Claude chấm: ' + why });
  return db('hang_doi', 'update', { id: t.row_id, trang_thai: JOB.CHO_DUYET, ai_nhan_xet: 'Không cắt được khung hình, AI chưa kiểm. Người duyệt xem kỹ. (' + why + ')' });
});
