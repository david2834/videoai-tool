// Cấu hình mặc định. Chỉ thêm khóa còn thiếu, không ghi đè giá trị anh đã sửa.
const rows = [
  ['SO_VIDEO_MOI_MAU', '2', 'Số video OK cần cho mỗi mẫu đồ.'],
  ['TRAN_VIDEO_MOI_NGAY', '20', 'Tối đa số video gửi tạo mỗi ngày (chặn đốt tiền).'],
  ['TRAN_ANH_MOI_NGAY', '30', 'Tối đa số lượt ghép đồ mỗi ngày.'],
  ['SO_LAN_GHEP_LAI', '2', 'Claude chấm ảnh hỏng thì ghép lại tối đa bấy nhiêu lần, sau đó chờ người xem.'],
  ['NHA_CUNG_CAP', 'fal', 'Nơi gọi AI: fal (mặc định, rẻ hơn) hoặc higgsfield. Đổi nơi thì chạy lại CaiDat.bat với key tương ứng.'],
  ['MODEL_GHEP_DO', 'fal-ai/nano-banana/edit', 'Model ghép đồ. fal: fal-ai/nano-banana/edit. Higgsfield: alibaba/qwen-image-3/edit'],
  ['MODEL_VIDEO', 'fal-ai/kling-video/v2.6/standard/motion-control', 'Model video. fal Kling 3 đẹp hơn, đắt hơn: fal-ai/kling-video/v3/standard/motion-control. Higgsfield: kling-video/motion-control/std'],
  ['GIU_NHAC_GOC', 'yes', 'yes = giữ nhạc của video nhảy, no = video ra không có tiếng.'],
  ['HUONG_NHAN_VAT', 'video', 'video = theo hướng người trong video nhảy, image = theo ảnh.'],
  ['PROMPT_GHEP_DO', 'Dress the person from image 1 in the exact garment shown in image 2. Keep the face, hair, body shape and skin tone of the person in image 1 unchanged. Reproduce the garment faithfully: same color, pattern, fabric, cut, neckline, sleeves, length and details. Full body, standing straight, facing camera, arms relaxed, plain light studio background, vertical photo, realistic fashion photography.', 'Prompt ghép đồ (tiếng Anh).'],
  ['PROMPT_VIDEO', '', 'Prompt thêm cho bước tạo video (để trống cũng được).'],
  ['CLAUDE_KIEM_TRA', 'Bật', 'Bật / Tắt Claude chấm ảnh và video.'],
  ['CLAUDE_MODEL', 'claude-opus-5-5', 'Model Claude. Rẻ hơn khoảng 40 lần: claude-haiku-5-5'],
  ['HF_BASE', 'https://api.higgsfield.ai/', 'Địa chỉ API Higgsfield. Không cần sửa.'],
  ['CLAUDE_URL', 'https://api.anthropic.com/v1/messages', 'Địa chỉ API Claude. Không cần sửa.'],
];
return rows.map(([khoa, gia_tri, giai_thich]) => ({ json: { khoa, gia_tri, giai_thich } }));
