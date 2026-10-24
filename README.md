# Tool Video AI (n8n chạy trên máy)

Tự ghép mẫu đồ vào người mẫu chính của kênh, tạo video nhảy bằng Kling Motion Control (qua fal.ai), Claude chấm ảnh và video, lưu kết quả về máy để người đăng thủ công.

- Cài lần đầu: tải zip của repo này, giải nén vào `C:\VideoAI`, chạy `CaiDat.bat`. Xem `Huong-dan-cai-Windows.pdf`.
- Cập nhật: bấm đúp `CapNhat.bat`. File tự tải bản mới nhất từ nhánh `main` của repo này, không đụng tới dữ liệu, clip, video.

Key API nằm trên máy người dùng, không bao giờ có trong repo.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `workflows/` | 4 quy trình n8n (sinh tự động từ `src/`, không sửa tay) |
| `src/build.js`, `src/code/` | Mã nguồn sinh ra `workflows/`: `node src/build.js workflows` |
| `src/test/mock.js` | Giả lập fal, Higgsfield, Claude để chạy thử |
| `CaiDat.bat`, `CapNhat.bat`, `MoTool.bat`, `TatTool.bat` | Cài, cập nhật, bật, tắt trên Windows |
| `cai-dat-mac.command` | Cài trên Mac (chưa thử trên máy thật) |
