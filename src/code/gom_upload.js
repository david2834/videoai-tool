// Gom link file đã đẩy lên Higgsfield theo từng lượt tạo, rồi lắp thân yêu cầu
const groups = {};
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const task = $('Phân việc').itemMatching(i).json;
  const link = $('HF xin link upload').itemMatching(i).json;
  const g = (groups[task.sub.key] = groups[task.sub.key] || { sub: task.sub, urls: {}, err: [] });
  // lỗi ở bước xin link là gốc; lỗi bước đẩy chỉ là hệ quả
  const e = link.error || items[i].json.error;
  if (e || !(link.public_url || link.file_url)) g.err.push(errText(e) || 'Higgsfield không trả link upload: ' + JSON.stringify(link).slice(0, 200));
  else g.urls[task.role] = link.public_url || link.file_url;
}

const out = [];
Object.values(groups).forEach((g) => {
  const s = g.sub;
  const tbl = s.kind === 'ghep' ? 'mau_do' : 'hang_doi';
  if (g.err.length || Object.keys(g.urls).length < s.n_files) {
    const n = s.so_loi + 1;
    const data = { id: s.row_id, so_loi: n, ghi_chu_loi: 'Đẩy file lỗi: ' + (g.err[0] || 'thiếu file') };
    if (n >= 3) data.trang_thai = 'Lỗi';
    out.push(db(tbl, 'update', data));
    return;
  }
  const body = Object.assign({}, s.body);
  if (s.kind === 'ghep') body.image_urls = [g.urls[0], g.urls[1]];
  else { body.image_url = g.urls[0]; body.video_url = g.urls[1]; }
  out.push({ json: { r: 1, sub: s, url: s.hf_base + String(s.endpoint).replace(/^\//, ''), body } });
});
return out;
