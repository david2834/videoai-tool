@echo off
REM ===== Cai dat Tool Video AI (chay 1 lan; chay lai duoc khi can doi key) =====
cd /d "%~dp0"
echo.
echo ==== CAI DAT TOOL VIDEO AI ====
echo.
docker --version >nul 2>&1
if errorlevel 1 (
  echo [LOI] May chua cai Docker Desktop. Xem Buoc 1 trong huong dan.
  pause
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo [LOI] Docker Desktop chua chay. Mo Docker Desktop, doi bieu tuong ca voi hien "Engine running", roi chay lai file nay.
  pause
  exit /b 1
)
echo Dan key vao (chuot phai de dan), roi bam Enter.
echo.
set /p HFKEY=1/2 fal.ai API key (tao tai fal.ai/dashboard/keys):
set /p CLAUDEKEY=2/2 Claude API key (sk-ant-...):
echo.
echo Dang tai va khoi dong. Lan dau mat 3-10 phut tuy mang...
for %%d in (00_NguoiMau 01_SanPham 02_AnhMacDo 03_KhoNhay 04_KetQua tmp) do if not exist files\%%d mkdir files\%%d
docker compose up -d --build
if errorlevel 1 (
  echo [LOI] Khong khoi dong duoc. Chup man hinh nay gui lai.
  pause
  exit /b 1
)
call :waitup
> files\tmp\creds.json echo [{"id":"hfApiCred0000001","name":"Video API","type":"httpHeaderAuth","data":{"name":"Authorization","value":"Key %HFKEY%"}},{"id":"claudeApiCred001","name":"Claude API","type":"httpHeaderAuth","data":{"name":"x-api-key","value":"%CLAUDEKEY%"}}]
docker compose exec -T n8n n8n import:credentials --input=/files/tmp/creds.json
del /q files\tmp\creds.json
docker compose exec -T n8n n8n import:workflow --separate --input=/workflows
for %%i in (VideoAI00CaiDat1 VideoAI01FormMau VideoAI02DongCo1 VideoAI03BaoCao1) do docker compose exec -T n8n n8n publish:workflow --id=%%i
docker compose restart
call :waitup
call :setup
echo.
echo ==== XONG ====
echo Trinh duyet se mo http://localhost:5678
echo Lan dau: tao tai khoan quan tri (email + mat khau cua anh).
echo Thu muc lam viec: %~dp0files
start "" http://localhost:5678
pause
exit /b 0

:waitup
echo Doi tool khoi dong...
for /l %%n in (1,1,60) do (
  curl -s http://localhost:5678/healthz 2>nul | findstr "ok" >nul && exit /b 0
  timeout /t 3 /nobreak >nul
)
echo [CANH BAO] Tool khoi dong cham, van tiep tuc...
exit /b 0

:setup
echo Tao bang du lieu va thu muc...
for /l %%n in (1,1,40) do (
  curl -s -o nul -w "%%{http_code}" http://localhost:5678/webhook/cai-dat 2>nul | findstr "200" >nul && goto setupok
  timeout /t 3 /nobreak >nul
)
echo [CANH BAO] Chua tao duoc bang du lieu. Doi 1 phut roi chay CapNhat.bat.
exit /b 0
:setupok
if exist files\04_KetQua (echo Da tao bang va thu muc.) else (echo [CANH BAO] Chua thay thu muc 04_KetQua.)
exit /b 0
