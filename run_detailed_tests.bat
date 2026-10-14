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

echo Running Appota detailed test suite (38 scenarios)...
echo.
"%APPOTA_PYTHON%" -B "%~dp0run_tests.py" --cases "%~dp0tests\detailed_test_cases.json" --report "%~dp0docs\evidence\detailed_test_results.json"
set "APPOTA_TEST_EXIT=%ERRORLEVEL%"
echo.
echo Test exit code: %APPOTA_TEST_EXIT%  ^(0=PASS, 1=FAIL, 2=configuration error^)
echo Report: docs\evidence\detailed_test_results.json
pause
exit /b %APPOTA_TEST_EXIT%
