@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run_mission3_video_tests.ps1" %*
set "APPOTA_TEST_EXIT=%ERRORLEVEL%"

if not "%APPOTA_TEST_EXIT%"=="0" (
  echo.
  echo Mission 3 video tests failed with exit code %APPOTA_TEST_EXIT%.
)

exit /b %APPOTA_TEST_EXIT%
