@echo off
echo ==========================================
echo      Attenda - Offline Attendance App v1.0.4
echo ==========================================
echo.
echo Checking environment...

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo First run detected. Installing dependencies...
    call npm install
    echo.
    echo Building the application...
    call npm run build
)

echo.
echo Starting Application Server...
echo.
echo ------------------------------------------
echo  Use CTRL+C to stop the server
echo ------------------------------------------
echo.

call npm run dev -- --open
