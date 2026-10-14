@echo off
setlocal
title Appota Knowledge System Launcher
cd /d "%~dp0"

echo =====================================================================
echo                TRINH KHOI DONG HE THONG APPOTA
echo =====================================================================
echo.
echo  [1] Giao dien Chatbot Next.js moi (Next.js - Port 3000) [Mac dinh]
echo  [2] Giao dien Streamlit goc (Streamlit - Port 8501)
echo  [3] Chay ca 2 giao dien cung luc
echo.
echo =====================================================================
set "CHOICE=1"
set /p "CHOICE=Nhap lua chon cua ban [1/2/3] (Bam Enter de chon 1): "

if "%CHOICE%"=="2" goto :run_streamlit
if "%CHOICE%"=="3" goto :run_both
goto :run_nextjs

:run_nextjs
echo.
echo [1/1] Dang khoi dong Giao dien Chatbot Next.js...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Dang cai dat dependencies npm...
    call npm install
)
echo Truy cap tai: http://localhost:3000
echo Nhan Ctrl+C de dung.
echo.
call npm run dev
goto :end

:run_streamlit
echo.
echo [1/1] Dang khoi dong Giao dien Streamlit goc...
set "APPOTA_PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%APPOTA_PYTHON%" (
    echo [LOI] Khong tim thay Python venv tai .venv\Scripts\python.exe.
    pause
    exit /b 1
)
if not exist "%~dp0data\appota.db" (
    "%APPOTA_PYTHON%" -B "%~dp0manage_database.py" init
)
echo Truy cap tai: http://localhost:8501
"%APPOTA_PYTHON%" -B -m streamlit run "%~dp0app.py" --server.address 127.0.0.1 --server.port 8501 --server.headless false --browser.gatherUsageStats false
goto :end

:run_both
echo.
echo Dang khoi dong ca 2 giao dien trong 2 cua so rieng biet...
start "Appota - Next.js Chatbot (Port 3000)" cmd /k "%~dp0run_frontend.bat"
start "Appota - Streamlit (Port 8501)" cmd /k "%APPOTA_PYTHON%" -B -m streamlit run "%~dp0app.py" --server.address 127.0.0.1 --server.port 8501 --server.headless false --browser.gatherUsageStats false
echo.
echo Da khoi dong ca hai giao dien!
echo   - Next.js Chatbot: http://localhost:3000
echo   - Streamlit:       http://localhost:8501
echo.
pause
goto :end

:end
exit /b 0
