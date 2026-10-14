@echo off
setlocal
title Appota Knowledge Chatbot - Next.js
cd /d "%~dp0frontend"

echo =====================================================================
echo           KHOI DONG GIAO DIEN CHATBOT APPOTA (NEXT.JS)
echo =====================================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js tren may tinh!
    echo Vui long cai dat Node.js tu https://nodejs.org de tiep tuc.
    echo.
    exit /b 1
)

if not exist "node_modules" (
    echo Dang cai dat cac goi thu vien can thiet...
    call npm ci
    if errorlevel 1 (
        echo [LOI] Khong the cai dat cac goi npm.
        exit /b 1
    )
)

echo.
echo =====================================================================
echo   Dia chi truy cap: http://localhost:3000
echo   De dung may chu:  Nhan to hop phim Ctrl + C
echo =====================================================================
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo [LOI] Khong the khoi dong may chu Next.js.
    exit /b 1
)

exit /b 0
