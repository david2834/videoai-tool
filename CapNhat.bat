@echo off
REM ===== Cap nhat tool: tu tai ban moi nhat tu GitHub. Khong mat du lieu, clip, video. =====
cd /d "%~dp0"
set "REPO=https://codeload.github.com/david2834/videoai-tool/zip/refs/heads/main"
set "TMPD=%TEMP%\videoai-capnhat"
if exist "%TMPD%" rmdir /s /q "%TMPD%"
mkdir "%TMPD%"
echo Dang tai ban moi tu GitHub...
curl -sSLf -o "%TMPD%\ban-moi.zip" "%REPO%"
if errorlevel 1 goto tailoi
powershell -NoProfile -Command "Expand-Archive -LiteralPath '%TMPD%\ban-moi.zip' -DestinationPath '%TMPD%' -Force"
if errorlevel 1 goto tailoi
set "SRC=%TMPD%\videoai-tool-main"
if not exist "%SRC%\workflows" goto tailoi
xcopy /y /q "%SRC%\workflows\*" "workflows\" >nul
for %%f in (CaiDat.bat MoTool.bat TatTool.bat docker-compose.yml Dockerfile cai-dat-mac.command Huong-dan-cai-Windows.pdf) do if exist "%SRC%\%%f" copy /y "%SRC%\%%f" . >nul
REM file CapNhat.bat moi chep vao sau cung, khi file nay chay xong
if exist "%SRC%\CapNhat.bat" copy /y "%SRC%\CapNhat.bat" "CapNhat.moi" >nul
echo Da tai ban moi.
goto doimport
:tailoi
echo [CANH BAO] Khong tai duoc ban moi tu GitHub (kiem tra mang). Cai lai ban dang co.
:doimport
for %%d in (00_NguoiMau 01_SanPham 02_AnhMacDo 03_KhoNhay 04_KetQua tmp) do if not exist files\%%d mkdir files\%%d
docker compose up -d --build
call :waitup
docker compose exec -T n8n n8n import:workflow --separate --input=/workflows
for %%i in (VideoAI00CaiDat1 VideoAI01FormMau VideoAI02DongCo1 VideoAI03BaoCao1) do docker compose exec -T n8n n8n publish:workflow --id=%%i
docker compose restart
call :waitup
call :setup
echo.
echo ==== DA CAP NHAT ====
pause
if exist CapNhat.moi (copy /y CapNhat.moi CapNhat.bat >nul & del CapNhat.moi & exit /b 0)
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
echo Kiem tra bang du lieu va thu muc...
for /l %%n in (1,1,40) do (
  curl -s -o nul -w "%%{http_code}" http://localhost:5678/webhook/cai-dat 2>nul | findstr "200" >nul && goto setupok
  timeout /t 3 /nobreak >nul
)
echo [CANH BAO] Chua chay duoc buoc tao bang. Doi 1 phut roi chay lai file nay.
exit /b 0
:setupok
if exist files\04_KetQua (echo Bang va thu muc da san sang.) else (echo [CANH BAO] Chua thay thu muc 04_KetQua.)
exit /b 0
