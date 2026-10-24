// Chuẩn bị lưu ảnh sản phẩm từ form vào 01_SanPham
const safe = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40);
return $input.all().map((it) => {
  const f = it.json;
  const ma = String(f['Mã SP'] || '').trim();
  const binKey = Object.keys(it.binary || {})[0];
  if (!ma || !binKey) throw new Error('Thiếu Mã SP hoặc ảnh sản phẩm');
  const bin = it.binary[binKey];
  const ext = (bin.fileExtension || String(bin.fileName || '').split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
  if (!['jpg', 'png', 'webp'].includes(ext)) throw new Error('Ảnh phải là JPG, PNG hoặc WEBP');
  const path = `/files/01_SanPham/${safe(ma)}.${ext}`;
  return {
    json: {
      path,
      row: {
        ma_sp: ma, ten_sp: String(f['Tên SP'] || ''), anh_sp: path,
        phong_cach: String(f['Phong cách'] || 'basic').toLowerCase(),
        link_aff: String(f['Link affiliate'] || ''), hoa_hong: Number(f['Hoa hồng %']) || 0,
        trang_thai: SP.MOI, so_lan_ghep: 0, so_video_tao: 0, so_video_ok: 0, so_loi: 0,
        ghi_chu_loi: '', ai_nhan_xet_anh: '', anh_mac_do: '', status_url: '', gui_luc: '',
      },
    },
    binary: { data: bin },
  };
});
