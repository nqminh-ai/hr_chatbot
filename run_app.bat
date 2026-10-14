@echo off
setlocal
cd /d "%~dp0"
set "APPOTA_PYTHON=%~dp0.venv\Scripts\python.exe"
set "CHOICE=%~1"
if defined CHOICE goto :dispatch

echo [1] Next.js - Port 3000 [default]
echo [2] Streamlit - Port 8501
echo [3] Both interfaces in separate interactive terminals
set "CHOICE=1"
set /p "CHOICE=Choose [1/2/3]: "

:dispatch
if "%CHOICE%"=="2" goto :run_streamlit
if "%CHOICE%"=="3" goto :run_both
if "%CHOICE%"=="1" goto :run_nextjs
echo ERROR: Invalid choice.
exit /b 2

:run_nextjs
call "%~dp0run_frontend.bat"
exit /b %ERRORLEVEL%

:prepare_streamlit
if not exist "%APPOTA_PYTHON%" (
    echo ERROR: Create .venv and install requirements.lock first.
    exit /b 2
)
"%APPOTA_PYTHON%" -B "%~dp0manage_database.py" init
exit /b %ERRORLEVEL%

:run_streamlit
call :prepare_streamlit
if errorlevel 1 exit /b %ERRORLEVEL%
"%APPOTA_PYTHON%" -B -m streamlit run "%~dp0app.py" --server.address 127.0.0.1 --server.port 8501 --server.headless false --browser.gatherUsageStats false
exit /b %ERRORLEVEL%

:run_both
call :prepare_streamlit
if errorlevel 1 exit /b %ERRORLEVEL%
where node >nul 2>&1
if errorlevel 1 exit /b 2
where npm >nul 2>&1
if errorlevel 1 exit /b 2
if not exist "%~dp0frontend\node_modules" (
    pushd "%~dp0frontend"
    call npm ci
    if errorlevel 1 goto :install_failed
    popd
)
rem Visible terminals are requested by the user's explicit menu choice 3.
start "Appota - Next.js" cmd /k call "%~dp0run_frontend.bat"
if errorlevel 1 exit /b %ERRORLEVEL%
start "Appota - Streamlit" cmd /k call "%~dp0run_app.bat" 2
if errorlevel 1 exit /b %ERRORLEVEL%
echo Terminals opened. Check each terminal for server readiness or errors.
exit /b 0

:install_failed
set "APPOTA_EXIT=%ERRORLEVEL%"
popd
exit /b %APPOTA_EXIT%
