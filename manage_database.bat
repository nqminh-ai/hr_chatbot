@echo off
setlocal
cd /d "%~dp0"
set "APPOTA_PYTHON=%~dp0.venv\Scripts\python.exe"
if not exist "%APPOTA_PYTHON%" (
    echo ERROR: Set up .venv using README.md first.
    pause
    exit /b 2
)
if not exist "%~dp0data\appota.db" (
    "%APPOTA_PYTHON%" -B "%~dp0manage_database.py" init
    if errorlevel 1 (
        pause
        exit /b 2
    )
)

:menu
echo.
echo Appota Database Management
echo [1] Database status and validation
echo [2] Check edited CSV in data\csv
echo [3] Import data\csv into DB with automatic backup
echo [4] Export DB to data\exports\latest ^(replace previous export^)
echo [5] Create a database backup
echo [6] Exit
choice /c 123456 /n /m "Select 1-6: "
if errorlevel 6 exit /b 0
if errorlevel 5 goto :backup
if errorlevel 4 goto :export
if errorlevel 3 goto :import
if errorlevel 2 goto :check
if errorlevel 1 goto :status
goto :menu

:status
"%APPOTA_PYTHON%" -B "%~dp0manage_database.py" status
goto :done
:check
"%APPOTA_PYTHON%" -B "%~dp0manage_database.py" check-csv --dir "%~dp0data\csv"
goto :done
:import
"%APPOTA_PYTHON%" -B "%~dp0manage_database.py" import-csv --dir "%~dp0data\csv"
goto :done
:export
"%APPOTA_PYTHON%" -B "%~dp0manage_database.py" export-csv --dir "%~dp0data\exports\latest" --overwrite
goto :done
:backup
"%APPOTA_PYTHON%" -B "%~dp0manage_database.py" backup
:done
echo.
echo Exit code: %ERRORLEVEL% ^(0=success, 2=operation failed^)
pause
goto :menu
