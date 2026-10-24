// Ghi lại kết quả gửi tạo: thành công thì lưu link theo dõi, lỗi thì đếm lỗi
const items = $input.all();
return items.map((it, i) => {
  const s = $('Tách gửi').itemMatching(i).json.sub;
  const res = it.json;
  const tbl = s.kind === 'ghep' ? 'mau_do' : 'hang_doi';
  if (res && res.status_url) {
    const data = { id: s.row_id, status_url: res.status_url, gui_luc: NOW, so_loi: 0, ghi_chu_loi: '' };
    if (s.kind === 'ghep') Object.assign(data, { trang_thai: SP.DANG_GHEP, so_lan_ghep: s.so_lan_ghep });
    else data.trang_thai = JOB.DANG_TAO;
    return db(tbl, 'update', data);
  }
  const n = s.so_loi + 1;
  const data = { id: s.row_id, so_loi: n, ghi_chu_loi: 'Gửi tạo lỗi: ' + (errText(res.error) || JSON.stringify(res).slice(0, 200)) };
  if (n >= 3) data.trang_thai = s.kind === 'ghep' ? SP.LOI : JOB.LOI;
  return db(tbl, 'update', data);
});
