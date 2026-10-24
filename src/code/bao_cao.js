// Gom số liệu toàn hệ thống và nhờ Claude viết báo cáo buổi sáng
const rows = (name) => $(name).all().map((i) => i.json).filter((r) => r && r.id !== undefined);
const cfg = {};
rows('Đọc cấu hình').forEach((r) => { cfg[r.khoa] = String(r.gia_tri ?? '').trim(); });
const mau = rows('Đọc mẫu đồ');
const jobs = rows('Đọc hàng đợi');
const kho = rows('Đọc kho nhảy');
const yesterday = $now.minus({ days: 1 }).toFormat('yyyy-MM-dd HH:mm:ss');
const recent = (v) => v && String(v) >= yesterday;
const countBy = (arr, key) => arr.reduce((o, r) => { const k = r[key] || '(trống)'; o[k] = (o[k] || 0) + 1; return o; }, {});
const stats = {
  ngay: TODAY,
  mau_do_theo_trang_thai: countBy(mau, 'trang_thai'),
  video_theo_trang_thai: countBy(jobs, 'trang_thai'),
  video_gui_24h: jobs.filter((j) => recent(j.gui_luc)).length,
  video_xong_24h: jobs.filter((j) => recent(j.xong_luc)).length,
  nguoi_duyet: countBy(jobs.filter((j) => j.duyet), 'duyet'),
  ly_do_hong_nguoi_duyet: jobs.filter((j) => j.ly_do_hong).slice(-30).map((j) => j.ly_do_hong),
  ai_bao_loi_video: jobs.filter((j) => j.trang_thai === JOB.AI_LOI).slice(-30).map((j) => j.ai_nhan_xet),
  duyet_ok_chua_dang: jobs.filter((j) => j.duyet === 'OK' && !j.dang_fb && !j.dang_tiktok).length,
  da_dang_chua_nhan_ai: jobs.filter((j) => (j.dang_fb || j.dang_tiktok) && j.nhan_ai !== 'Có').map((j) => j.job_id),
  mau_can_nguoi_xem: mau.filter((m) => [SP.CAN_NGUOI_XEM, SP.LOI].includes(m.trang_thai)).map((m) => m.ma_sp + ': ' + (m.ghi_chu_loi || m.ai_nhan_xet_anh)),
  loi_dang_treo: mau.concat(jobs).filter((r) => r.ghi_chu_loi).slice(-30).map((r) => (r.ma_sp || '') + ' ' + (r.job_id || '') + ': ' + r.ghi_chu_loi),
  kho_nhay: {
    tong: kho.length,
    dang_dung: kho.filter((c) => c.trang_thai === CLIP.DUNG).length,
    nen_loai: kho.filter((c) => c.trang_thai === CLIP.NEN_LOAI).map((c) => c.ten_file + ' (' + c.ghi_chu + ')'),
    theo_phong_cach: countBy(kho.filter((c) => c.trang_thai === CLIP.DUNG), 'phong_cach'),
  },
  mau_dang_cho_theo_phong_cach: countBy(mau.filter((m) => [SP.MOI, SP.ANH_OK, SP.DANG_LAM_VIDEO, ''].includes(m.trang_thai || '')), 'phong_cach'),
  cau_hinh: { so_video_moi_mau: cfg.SO_VIDEO_MOI_MAU, tran_video_moi_ngay: cfg.TRAN_VIDEO_MOI_NGAY, model_video: cfg.MODEL_VIDEO },
};
const schema = {
  type: 'object',
  properties: {
    tom_tat: { type: 'string' },
    van_de: {
      type: 'array',
      items: {
        type: 'object',
        properties: { muc_do: { type: 'string', enum: ['Cao', 'Trung bình', 'Thấp'] }, mo_ta: { type: 'string' }, de_xuat: { type: 'string' } },
        required: ['muc_do', 'mo_ta', 'de_xuat'], additionalProperties: false,
      },
    },
  },
  required: ['tom_tat', 'van_de'], additionalProperties: false,
};
const model = cfg.CLAUDE_MODEL || 'claude-opus-5-5';
const body = {
  model, max_tokens: 16000,
  system: 'Bạn giám sát một dây chuyền tạo video AI thời trang (ghép đồ vào người mẫu, tạo video nhảy, người duyệt rồi đăng TikTok/Facebook để bán affiliate). ' +
    'Đọc số liệu JSON và viết báo cáo ngắn bằng tiếng Việt cho trưởng nhóm. Chỉ dùng số có trong dữ liệu, không bịa số. ' +
    'tom_tat: 2-4 câu, nêu số chính trước. van_de: tối đa 6 mục, xếp theo mức độ, mỗi đề xuất nói rõ làm gì cụ thể (clip nào nên loại, mẫu nào cần xem lại, phong cách nào thiếu clip). ' +
    'Luôn nêu nếu có video đã đăng mà chưa gắn nhãn AI, hoặc một lỗi lặp lại nhiều lần. Nguyên nhân chưa chắc thì ghi rõ là giả thuyết.',
  messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(stats) }] }],
  output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
};
const headers = { 'anthropic-version': '2026-10-21', 'content-type': 'application/json' };
if (/^claude-(opus-5|fable-5|sonnet-5-5)/.test(model)) {
  body.fallbacks = 'default';
  headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
}
return [{ json: { stats, url: cfg.CLAUDE_URL || 'https://api.anthropic.com/v1/messages', headers, body } }];
