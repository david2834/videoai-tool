// Gom các ảnh của từng lượt chấm thành một yêu cầu gửi Claude
const LABEL = {
  '1_nguoi_mau': 'Ảnh người mẫu chính của kênh (tham chiếu khuôn mặt, dáng người).',
  '2_san_pham': 'Ảnh sản phẩm thật (tham chiếu trang phục).',
  '1_san_pham': 'Ảnh sản phẩm thật (tham chiếu trang phục).',
  '3_ket_qua': 'Ảnh AI vừa ghép đồ, cần chấm.',
};
const SCHEMA = {
  type: 'object',
  properties: {
    dat: { type: 'boolean' }, diem: { type: 'integer' }, khop_trang_phuc: { type: 'boolean' },
    loi: { type: 'array', items: { type: 'string' } }, nhan_xet: { type: 'string' },
  },
  required: ['dat', 'diem', 'khop_trang_phuc', 'loi', 'nhan_xet'],
  additionalProperties: false,
};
const groups = {};
const items = $input.all();
for (let i = 0; i < items.length; i++) {
  const t = $('Tách QC').itemMatching(i).json.task;
  const g = (groups[t.key] = groups[t.key] || { t, imgs: [] });
  const name = String(items[i].json.fileName || '').replace(/\.jpg$/i, '');
  const buf = await this.helpers.getBinaryDataBuffer(i, 'data');
  g.imgs.push({ name, data: buf.toString('base64') });
}
return Object.values(groups).map(({ t, imgs }) => {
  imgs.sort((a, b) => a.name.localeCompare(b.name));
  const content = [];
  imgs.forEach((im) => {
    const m = im.name.match(/^2_khung_(\d+)$/);
    content.push({ type: 'text', text: m ? `Khung hình ở ${m[1]}% thời lượng video AI, cần chấm.` : LABEL[im.name] || im.name });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.data } });
  });
  content.push({ type: 'text', text: t.kind === 'anh'
    ? 'Chấm ảnh AI vừa ghép theo tiêu chí trong hướng dẫn.'
    : 'Chấm video AI qua các khung hình theo tiêu chí trong hướng dẫn. Chỉ báo lỗi nhìn thấy được trong các khung hình.' });
  const system = 'Bạn là người kiểm tra chất lượng (QC) cho video thời trang bán hàng affiliate. Trả lời bằng tiếng Việt, ngắn gọn. ' +
    'Tiêu chí: (1) trang phục khớp với ảnh sản phẩm thật: màu, họa tiết, chất liệu nhìn thấy, form dáng, cổ áo, tay áo, độ dài, chi tiết; ' +
    'sai trang phục là lỗi nặng vì khách sẽ nhận hàng khác video. ' +
    (t.kind === 'anh' ? '(2) khuôn mặt và dáng người giống người mẫu chính; ' : '(2) người mẫu nhất quán giữa các khung hình, trang phục không đổi màu hay đổi kiểu giữa các khung; ') +
    '(3) cơ thể không biến dạng: tay, ngón tay, chân, khớp, mặt; (4) thấy rõ toàn thân hoặc gần toàn thân; ' +
    '(5) không có chữ, logo lạ, watermark; (6) không hở hang quá mức chính sách TikTok/Facebook. ' +
    'diem từ 1 đến 10. dat = true chỉ khi diem >= 7 và khop_trang_phuc = true. loi: liệt kê lỗi cụ thể, rỗng nếu không có.';
  const body = {
    model: t.claude_model, max_tokens: 16000, system,
    messages: [{ role: 'user', content }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
  };
  const headers = { 'anthropic-version': '2026-10-21', 'content-type': 'application/json' };
  // Nếu bộ lọc an toàn từ chối nhầm (vd ảnh đồ bơi), server tự chuyển sang model dự phòng
  if (/^claude-(opus-5|fable-5|sonnet-5-5)/.test(t.claude_model)) {
    body.fallbacks = 'default';
    headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  }
  return { json: { task: t, url: t.claude_url, headers, body } };
});
