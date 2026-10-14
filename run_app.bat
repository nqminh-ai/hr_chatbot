@echo off
setlocal
cd /d "%~dp0"

set "APPOTA_PYTHON=%~dp0.venv\Scripts\python.exe"

if not exist "%~dp0app.py" (
    echo ERROR: app.py was not found. Keep this launcher in the project folder.
    goto :failed
)

if not exist "%APPOTA_PYTHON%" (
    echo ERROR: The project's .venv environment was not found.
    echo Follow the Windows setup instructions in README.md first.
    goto :failed
)

"%APPOTA_PYTHON%" -B -c "import streamlit" >nul 2>&1
if errorlevel 1 (
    echo ERROR: Streamlit is missing or the Python environment is damaged.
    echo Follow the Windows setup instructions in README.md first.
    goto :failed
)

echo Starting Appota at http://127.0.0.1:8501
if not exist "%~dp0data\appota.db" (
    "%APPOTA_PYTHON%" -B "%~dp0manage_database.py" init
    if errorlevel 1 goto :failed
)
echo Keep this window open. Press Ctrl+C to stop the app.
echo.
"%APPOTA_PYTHON%" -B -m streamlit run "%~dp0app.py" --server.address 127.0.0.1 --server.port 8501 --server.headless false --browser.gatherUsageStats false
if errorlevel 1 goto :failed
exit /b 0

:failed
echo.
echo Appota could not start. Check the error above.
pause
exit /b 1
