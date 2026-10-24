#!/bin/sh
# ===== Cai dat Tool Video AI tren Mac (chay 1 lan; chay lai duoc khi can doi key) =====
cd "$(dirname "$0")" || exit 1
echo "==== CAI DAT TOOL VIDEO AI ===="
command -v docker >/dev/null 2>&1 || { echo "[LOI] May chua cai Docker Desktop."; exit 1; }
docker info >/dev/null 2>&1 || { echo "[LOI] Docker Desktop chua chay. Mo Docker Desktop roi chay lai."; exit 1; }
printf "1/2 fal.ai API key (tao tai fal.ai/dashboard/keys): "; read -r HFKEY
printf "2/2 Claude API key (sk-ant-...): "; read -r CLAUDEKEY
mkdir -p files/00_NguoiMau files/01_SanPham files/02_AnhMacDo files/03_KhoNhay files/04_KetQua files/tmp
docker compose up -d --build || { echo "[LOI] Khong khoi dong duoc."; exit 1; }
waitup() {
  echo "Doi tool khoi dong..."
  for i in $(seq 1 60); do curl -s http://localhost:5678/healthz | grep -q ok && return 0; sleep 3; done
}
waitup
printf '[{"id":"hfApiCred0000001","name":"Video API","type":"httpHeaderAuth","data":{"name":"Authorization","value":"Key %s"}},{"id":"claudeApiCred001","name":"Claude API","type":"httpHeaderAuth","data":{"name":"x-api-key","value":"%s"}}]' "$HFKEY" "$CLAUDEKEY" > files/tmp/creds.json
docker compose exec -T n8n n8n import:credentials --input=/files/tmp/creds.json
rm -f files/tmp/creds.json
docker compose exec -T n8n n8n import:workflow --separate --input=/workflows
for id in VideoAI00CaiDat1 VideoAI01FormMau VideoAI02DongCo1 VideoAI03BaoCao1; do
  docker compose exec -T n8n n8n publish:workflow --id=$id
done
docker compose restart
waitup
echo "Tao bang du lieu va thu muc..."
OK=0
for i in $(seq 1 40); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5678/webhook/cai-dat)" = "200" ] && { OK=1; break; }
  sleep 3
done
if [ $OK = 1 ] && [ -d files/04_KetQua ]; then echo "Da tao bang va thu muc."; else echo "[CANH BAO] Chua tao duoc bang. Doi 1 phut roi chay CapNhat."; fi
echo "==== XONG ==== Mo http://localhost:5678 va tao tai khoan quan tri."
open http://localhost:5678 2>/dev/null || true
