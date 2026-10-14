@echo off
setlocal
cd /d "%~dp0"
set "APPOTA_PYTHON=%~dp0.venv\Scripts\python.exe"

if not exist "%APPOTA_PYTHON%" (
    echo ERROR: The project's .venv environment was not found.
    echo Follow the Windows setup instructions in README.md first.
    pause
    exit /b 2
)

echo Running Appota private scenarios...
echo.
"%APPOTA_PYTHON%" -B "%~dp0run_tests.py" --db "%~dp0data\appota.db" --cases "%~dp0tests\private_test_cases.json" --report "%~dp0docs\evidence\private_test_results.json"
set "APPOTA_TEST_EXIT=%ERRORLEVEL%"
echo.
echo Test exit code: %APPOTA_TEST_EXIT%  ^(0=PASS, 1=FAIL, 2=configuration error^)
echo Report: docs\evidence\private_test_results.json
pause
exit /b %APPOTA_TEST_EXIT%
