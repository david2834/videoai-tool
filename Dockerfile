# n8n kèm ffmpeg (dùng để cắt khung hình video cho Claude chấm)
FROM mwader/static-ffmpeg:7.1 AS ffmpeg
FROM n8nio/n8n:2.44.6
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
