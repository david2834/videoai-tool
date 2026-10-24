// Đọc toàn bộ bảng và thư mục, quyết định việc cần làm trong lượt này.
// r = 0: ghi bảng | 1: đẩy file + gửi tạo | 2: hỏi trạng thái | 3: Claude chấm
const rows = (name) => $(name).all().map((i) => i.json).filter((r) => r && r.id !== undefined);
const cfg = {};
rows('Đọc cấu hình').forEach((r) => { cfg[r.khoa] = String(r.gia_tri ?? '').trim(); });
const num = (k, d) => (cfg[k] === undefined || cfg[k] === '' || isNaN(Number(cfg[k])) ? d : Number(cfg[k]));
const target = num('SO_VIDEO_MOI_MAU', 2);
const maxGhep = num('SO_LAN_GHEP_LAI', 2) + 1;
const claudeOn = (cfg.CLAUDE_KIEM_TRA || 'Bật') === 'Bật';
const hfBase = (cfg.HF_BASE || 'https://api.higgsfield.ai/').replace(/\/?$/, '/');
// Nơi gọi AI: fal (mặc định, rẻ hơn) hoặc higgsfield
const useFal = (cfg.NHA_CUNG_CAP || 'fal').toLowerCase() !== 'higgsfield';
const isFalModel = (m) => /^fal-ai\//.test(m || '');
const api = useFal
  ? {
    base: 'https://queue.fal.run/', up: 'https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3',
    ghep: isFalModel(cfg.MODEL_GHEP_DO) ? cfg.MODEL_GHEP_DO : 'fal-ai/nano-banana/edit',
    video: isFalModel(cfg.MODEL_VIDEO) ? cfg.MODEL_VIDEO : 'fal-ai/kling-video/v2.6/standard/motion-control',
  }
  : { base: hfBase, up: hfBase + 'files/generate-upload-url', ghep: cfg.MODEL_GHEP_DO, video: cfg.MODEL_VIDEO };
const upTask = (sub, role, p, mime) => ({
  json: { r: 1, sub, role, path: p, mime, up_url: api.up,
    up_body: useFal ? { content_type: mime, file_name: String(p || '').split('/').pop() } : { content_type: mime } },
});
const isFalUrl = (u) => /\/fal-ai\//.test(u || '');

const mau = rows('Đọc mẫu đồ');
const kho = rows('Đọc kho nhảy');
const jobs = rows('Đọc hàng đợi');
const ls = (node) => String(($(node).first().json || {}).stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
const khoFiles = ls('Quét kho nhảy').filter((f) => /\.mp4$/i.test(f));
const modelFiles = ls('Quét người mẫu').filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const modelPath = modelFiles.length ? '/files/00_NguoiMau/' + modelFiles[0] : null;

const out = [];
const upd = { mau_do: {}, hang_doi: {}, kho_nhay: {} };
const set = (tbl, r, obj) => {
  upd[tbl][r.id] = Object.assign(upd[tbl][r.id] || { id: r.id }, obj);
  Object.assign(r, obj);
};
const mimeOf = (p) => ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4' })[String(p).split('.').pop().toLowerCase()] || '';
const safe = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40);
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
const failed = (j) => j.trang_thai === JOB.LOI || j.trang_thai === JOB.AI_LOI || j.duyet === 'Hỏng';
const claude = { claude_url: cfg.CLAUDE_URL || 'https://api.anthropic.com/v1/messages', claude_model: cfg.CLAUDE_MODEL || 'claude-opus-5-5' };

// ---- 1. Đồng bộ kho video nhảy với thư mục 03_KhoNhay ----
// Tên file: baihat_phongcach_15s_01.mp4
const known = new Set(kho.map((c) => c.ten_file));
khoFiles.filter((f) => !known.has(f)).forEach((f) => {
  const parts = f.replace(/\.mp4$/i, '').split('_');
  out.push(db('kho_nhay', 'insert', {
    ten_file: f, duong_dan: '/files/03_KhoNhay/' + f, bai_hat: parts[0] || '',
    phong_cach: (parts[1] || 'basic').toLowerCase(), so_lan_dung: 0, so_lan_loi: 0,
    trang_thai: CLIP.DUNG, ghi_chu: '',
  }));
});
const khoListed = ($('Quét kho nhảy').first().json || {}).exitCode === 0; // quét lỗi thì không đánh dấu gì
kho.forEach((c) => {
  if (khoListed && c.trang_thai !== CLIP.LOAI && !khoFiles.includes(c.ten_file)) set('kho_nhay', c, { trang_thai: CLIP.LOAI, ghi_chu: 'Không còn file trong thư mục' });
  // file được chép lại vào kho thì dùng lại clip
  else if (khoListed && c.trang_thai === CLIP.LOAI && c.ghi_chu === 'Không còn file trong thư mục' && khoFiles.includes(c.ten_file)) set('kho_nhay', c, { trang_thai: CLIP.DUNG, ghi_chu: 'File đã có lại' });
});

// ---- 2. Tự phát hiện lỗi: đếm lỗi theo clip, tạm ngưng clip lỗi nhiều ----
const clipByName = {};
kho.forEach((c) => { clipByName[c.ten_file] = c; });
jobs.forEach((j) => {
  if (j.da_tinh_loi || !failed(j)) return;
  const c = clipByName[j.clip];
  if (c) set('kho_nhay', c, { so_lan_loi: (Number(c.so_lan_loi) || 0) + 1 });
  set('hang_doi', j, { da_tinh_loi: 'x' });
});
kho.forEach((c) => {
  const used = Number(c.so_lan_dung) || 0;
  const err = Number(c.so_lan_loi) || 0;
  if (c.trang_thai === CLIP.DUNG && used >= 3 && err / used >= 0.5) {
    set('kho_nhay', c, { trang_thai: CLIP.NEN_LOAI, ghi_chu: `Tự tạm ngưng: lỗi ${err}/${used} lần. Xem lại clip, chọn "Dùng" nếu muốn dùng tiếp.` });
  }
});

// ---- 3. Ghép đồ: gửi mẫu mới, hỏi trạng thái mẫu đang ghép, chấm ảnh ----
let anhToday = mau.filter((m) => String(m.gui_luc || '').startsWith(TODAY)).length;
const capAnh = num('TRAN_ANH_MOI_NGAY', 30);
mau.forEach((m) => {
  const st = m.trang_thai || SP.MOI;
  if (st === SP.MOI) {
    if (!modelPath) {
      if (m.ghi_chu_loi !== 'Chưa có ảnh người mẫu trong thư mục 00_NguoiMau') set('mau_do', m, { ghi_chu_loi: 'Chưa có ảnh người mẫu trong thư mục 00_NguoiMau' });
      return;
    }
    if (!m.anh_sp) { set('mau_do', m, { trang_thai: SP.LOI, ghi_chu_loi: 'Thiếu ảnh sản phẩm' }); return; }
    if (anhToday >= capAnh) return;
    anhToday++;
    const lan = (Number(m.so_lan_ghep) || 0) + 1;
    const sub = {
      key: `ghep-${m.id}-${lan}`, kind: 'ghep', row_id: m.id, hf_base: api.base, endpoint: api.ghep,
      so_lan_ghep: lan, so_loi: Number(m.so_loi) || 0, n_files: 2,
      body: useFal ? { prompt: cfg.PROMPT_GHEP_DO, num_images: 1 } : { prompt: cfg.PROMPT_GHEP_DO, resolution: '1k', aspect_ratio: '9:16' },
    };
    out.push(upTask(sub, 0, modelPath, mimeOf(modelPath)));
    out.push(upTask(sub, 1, m.anh_sp, mimeOf(m.anh_sp)));
  } else if (st === SP.DANG_GHEP) {
    out.push({ json: { r: 2, kind: 'ghep', row_id: m.id, status_url: m.status_url, fal: isFalUrl(m.status_url), ma_sp: safe(m.ma_sp), so_lan_ghep: Number(m.so_lan_ghep) || 1, max_ghep: maxGhep, gui_luc: m.gui_luc, so_loi: Number(m.so_loi) || 0 } });
  } else if (st === SP.CHO_AI) {
    if (!claudeOn) { set('mau_do', m, { trang_thai: SP.ANH_OK, ai_nhan_xet_anh: 'Claude tắt, không kiểm' }); return; }
    if (!modelPath) return;
    const key = `qc-anh-${m.id}-${m.so_lan_ghep}`;
    const dir = '/files/tmp/' + key;
    const files = [[modelPath, '1_nguoi_mau'], [m.anh_sp, '2_san_pham'], [m.anh_mac_do, '3_ket_qua']];
    const cmd = [`rm -rf ${shq(dir)}`, `mkdir -p ${shq(dir)}`]
      .concat(files.map(([p, l]) => `ffmpeg -y -loglevel error -i ${shq(p)} -vf "scale='min(1024,iw)':-2" -q:v 3 ${shq(dir + '/' + l + '.jpg')}`))
      .join(' && ');
    out.push({ json: { r: 3, kind: 'anh', key, dir, cmd, row_id: m.id, so_lan_ghep: Number(m.so_lan_ghep) || 1, max_ghep: maxGhep, ...claude } });
  }
});

// ---- 4. Bốc video nhảy cho mẫu đã có ảnh OK ----
// Ưu tiên: cùng phong cách > basic > bất kỳ; chưa dùng cho mẫu này; ít dùng nhất; ngẫu nhiên khi bằng nhau
const pick = (style, used, n) => kho
  .filter((c) => c.trang_thai === CLIP.DUNG && !used.includes(c.ten_file))
  .map((c) => ({ c, k: [c.phong_cach === style ? 0 : c.phong_cach === 'basic' ? 1 : 2, Number(c.so_lan_dung) || 0, Math.random()] }))
  .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2])
  .slice(0, n).map((x) => x.c);
const noClip = new Set();
mau.forEach((m) => {
  if (![SP.ANH_OK, SP.DANG_LAM_VIDEO, SP.XONG].includes(m.trang_thai)) return;
  const mine = jobs.filter((j) => j.ma_sp === m.ma_sp);
  const alive = mine.filter((j) => !failed(j)).length;
  const need = Math.min(target - alive, target * 2 - mine.length); // tổng số lần thử tối đa = 2 x mục tiêu
  if (m.trang_thai === SP.ANH_OK) set('mau_do', m, { trang_thai: SP.DANG_LAM_VIDEO, thu_muc_video: '/files/04_KetQua/' + safe(m.ma_sp) });
  if (need <= 0) return;
  if (m.trang_thai === SP.XONG) set('mau_do', m, { trang_thai: SP.DANG_LAM_VIDEO }); // người duyệt chọn Hỏng sau khi đã xong: làm bù
  const clips = pick(String(m.phong_cach || 'basic').toLowerCase(), mine.map((j) => j.clip), need);
  if (!clips.length) {
    noClip.add(m.ma_sp);
    if (m.ghi_chu_loi !== 'Hết video nhảy phù hợp trong kho') set('mau_do', m, { ghi_chu_loi: 'Hết video nhảy phù hợp trong kho' });
    return;
  }
  clips.forEach((c, idx) => {
    out.push(db('hang_doi', 'insert', {
      job_id: 'J' + $now.toFormat('yyMMddHHmmss') + String(m.id).padStart(3, '0') + idx,
      ma_sp: m.ma_sp, anh_mac_do: m.anh_mac_do, clip: c.ten_file, clip_path: c.duong_dan, bai_hat: c.bai_hat,
      trang_thai: JOB.CHO_TAO, so_loi: 0, duyet: '', nhan_ai: 'Chưa',
    }));
    set('kho_nhay', c, { so_lan_dung: (Number(c.so_lan_dung) || 0) + 1 });
  });
});

// ---- 5. Video: gửi job chờ tạo, hỏi trạng thái job đang tạo, chấm video ----
let videoToday = jobs.filter((j) => String(j.gui_luc || '').startsWith(TODAY)).length;
const capVideo = num('TRAN_VIDEO_MOI_NGAY', 20);
const mauByCode = {};
mau.forEach((m) => { mauByCode[m.ma_sp] = m; });
jobs.forEach((j) => {
  if (j.trang_thai === JOB.CHO_TAO) {
    if (videoToday >= capVideo) return;
    videoToday++;
    const sub = {
      key: `video-${j.job_id}`, kind: 'video', row_id: j.id, hf_base: api.base, endpoint: api.video,
      so_loi: Number(j.so_loi) || 0, n_files: 2,
      body: Object.assign(
        { character_orientation: cfg.HUONG_NHAN_VAT === 'image' ? 'image' : 'video' },
        // fal nhận true/false, Higgsfield nhận yes/no
        { keep_original_sound: useFal ? cfg.GIU_NHAC_GOC !== 'no' : (cfg.GIU_NHAC_GOC === 'no' ? 'no' : 'yes') },
        cfg.PROMPT_VIDEO || !useFal ? { prompt: cfg.PROMPT_VIDEO || '' } : {},
      ),
    };
    out.push(upTask(sub, 0, j.anh_mac_do, mimeOf(j.anh_mac_do)));
    out.push(upTask(sub, 1, j.clip_path, 'video/mp4'));
  } else if (j.trang_thai === JOB.DANG_TAO) {
    out.push({ json: { r: 2, kind: 'video', row_id: j.id, status_url: j.status_url, fal: isFalUrl(j.status_url), ma_sp: safe(j.ma_sp), job_id: j.job_id, bai_hat: safe(j.bai_hat), gui_luc: j.gui_luc, so_loi: Number(j.so_loi) || 0 } });
  } else if (j.trang_thai === JOB.CHO_AI) {
    if (!claudeOn) { set('hang_doi', j, { trang_thai: JOB.CHO_DUYET, ai_nhan_xet: 'Claude tắt, không kiểm' }); return; }
    const m = mauByCode[j.ma_sp];
    const key = `qc-video-${j.job_id}`;
    const dir = '/files/tmp/' + key;
    const v = shq(j.video);
    const cmd = [
      `rm -rf ${shq(dir)}`, `mkdir -p ${shq(dir)}`,
      `ffmpeg -y -loglevel error -i ${shq(m ? m.anh_sp : '')} -vf "scale='min(1024,iw)':-2" -q:v 3 ${shq(dir + '/1_san_pham.jpg')}`,
      `D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 ${v})`,
      `for p in 20 50 80; do T=$(awk -v d="$D" -v p=$p 'BEGIN{printf "%.2f", d*p/100}'); ffmpeg -y -loglevel error -ss "$T" -i ${v} -frames:v 1 -vf "scale='min(720,iw)':-2" -q:v 3 ${shq(dir)}/2_khung_$p.jpg || exit 1; done`,
    ].join(' && ');
    out.push({ json: { r: 3, kind: 'video', key, dir, cmd, row_id: j.id, ...claude } });
  }
});

// ---- 6. Cập nhật số video theo mẫu và đóng mẫu đã đủ ----
mau.forEach((m) => {
  if (![SP.DANG_LAM_VIDEO, SP.XONG, SP.THIEU_VIDEO].includes(m.trang_thai)) return;
  const mine = jobs.filter((j) => j.ma_sp === m.ma_sp);
  const ok = mine.filter((j) => j.trang_thai === JOB.CHO_DUYET && j.duyet !== 'Hỏng').length;
  const pending = mine.filter((j) => [JOB.CHO_TAO, JOB.DANG_TAO, JOB.CHO_AI].includes(j.trang_thai)).length;
  const u = {};
  if (m.so_video_tao !== mine.length) u.so_video_tao = mine.length;
  if (m.so_video_ok !== ok) u.so_video_ok = ok;
  if (m.trang_thai === SP.DANG_LAM_VIDEO && !pending && mine.length) {
    if (ok >= target) u.trang_thai = SP.XONG;
    else if (mine.length >= target * 2 || noClip.has(m.ma_sp)) u.trang_thai = SP.THIEU_VIDEO;
  }
  if (Object.keys(u).length) set('mau_do', m, u);
});

// Lệnh ghi bảng đi trước, sau đó mới tới việc gọi API
const writes = [];
Object.keys(upd).forEach((tbl) => Object.values(upd[tbl]).forEach((d) => writes.push(db(tbl, 'update', d))));
return writes.concat(out);
