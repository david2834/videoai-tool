// Ghi báo cáo vào bảng bao_cao
const res = $input.first().json || {};
const src = $('Lập báo cáo').first().json;
let out = null;
try { out = JSON.parse((res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('')); } catch (e) { out = null; }
return [{ json: {
  ngay: NOW,
  tom_tat: out ? out.tom_tat : 'Claude không tạo được báo cáo: ' + (errText(res.error) || res.stop_reason || 'không rõ') + '. Xem cột số liệu.',
  van_de: out ? out.van_de.map((v) => `[${v.muc_do}] ${v.mo_ta} → ${v.de_xuat}`).join('\n') : '',
  so_lieu: JSON.stringify(src.stats),
} }];
