// Đọc trạng thái job (fal hoặc Higgsfield): xong thì tải về, hỏng hoặc quá giờ thì xử lý lỗi
const TIMEOUT_MIN = 90;
const items = $input.all();
const out = [];
items.forEach((it, i) => {
  const t = $('Phân việc').itemMatching(i).json;
  // trạng thái lấy ở node hỏi trạng thái; kết quả (link file) ở node lấy kết quả
  const st = $('HF hỏi trạng thái').itemMatching(i).json || {};
  const res = it.json || {};
  const status = String(st.status || '').toLowerCase();
  const tbl = t.kind === 'ghep' ? 'mau_do' : 'hang_doi';
  const fail = (reason) => {
    if (t.kind === 'ghep') {
      if (t.so_lan_ghep < t.max_ghep) out.push(db(tbl, 'update', { id: t.row_id, trang_thai: SP.MOI, ghi_chu_loi: reason + ', ghép lại' }));
      else out.push(db(tbl, 'update', { id: t.row_id, trang_thai: SP.CAN_NGUOI_XEM, ghi_chu_loi: `${reason}. Đã ghép ${t.so_lan_ghep} lần.` }));
    } else {
      out.push(db(tbl, 'update', { id: t.row_id, trang_thai: JOB.LOI, ghi_chu_loi: reason }));
    }
  };
  if (st.error && !st.status) {
    // lỗi mạng hoặc lỗi xác thực: thử lại lượt sau, quá 3 lần thì báo
    const n = t.so_loi + 1;
    out.push(db(tbl, 'update', { id: t.row_id, so_loi: n, ghi_chu_loi: 'Hỏi trạng thái lỗi: ' + errText(st.error) }));
    if (n >= 3) fail('Không hỏi được trạng thái 3 lần');
    return;
  }
  if (status === 'completed') {
    // fal báo COMPLETED cả khi lỗi, lỗi nằm ở trường error
    if (t.fal && st.error) return fail('fal báo lỗi: ' + errText(st.error));
    if (res.error && !res.video && !res.images) {
      const n = t.so_loi + 1;
      out.push(db(tbl, 'update', { id: t.row_id, so_loi: n, ghi_chu_loi: 'Lấy kết quả lỗi: ' + errText(res.error) }));
      if (n >= 3) fail('Không lấy được kết quả 3 lần');
      return;
    }
    const url = t.kind === 'ghep' ? res.images && res.images[0] && res.images[0].url : res.video && res.video.url;
    if (!url) return fail('Báo xong nhưng không có file kết quả');
    const dir = t.kind === 'ghep' ? '/files/02_AnhMacDo' : '/files/04_KetQua/' + t.ma_sp;
    const name = t.kind === 'ghep' ? `${t.ma_sp}_v${t.so_lan_ghep}.png` : `${t.ma_sp}_${t.bai_hat || 'nhay'}_${t.job_id}.mp4`;
    out.push({ json: { r: 1, task: t, url, dir, path: dir + '/' + name } });
  } else if (HF_FAIL.includes(status)) {
    fail('Higgsfield trả về: ' + status + (st.error ? ' ' + errText(st.error) : ''));
  } else if (minutesSince(t.gui_luc) > TIMEOUT_MIN) {
    fail(`Quá ${TIMEOUT_MIN} phút chưa xong`);
  }
});
return out;
