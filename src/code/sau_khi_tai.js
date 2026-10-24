// File kết quả đã lưu vào máy: chuyển sang bước Claude chấm
const items = $input.all();
return items.map((it, i) => {
  const d = $('Tách tải').itemMatching(i).json;
  const t = d.task;
  const tbl = t.kind === 'ghep' ? 'mau_do' : 'hang_doi';
  if (it.json.error) {
    return db(tbl, 'update', { id: t.row_id, so_loi: t.so_loi + 1, ghi_chu_loi: 'Tải kết quả lỗi: ' + errText(it.json.error) });
  }
  if (t.kind === 'ghep') return db(tbl, 'update', { id: t.row_id, trang_thai: SP.CHO_AI, anh_mac_do: d.path, ghi_chu_loi: '', so_loi: 0 });
  return db(tbl, 'update', { id: t.row_id, trang_thai: JOB.CHO_AI, video: d.path, xong_luc: NOW, ghi_chu_loi: '', so_loi: 0 });
});
