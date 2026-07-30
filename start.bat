@echo off
echo ========================================
echo   NextGen Campus - Starting All Services
echo ========================================
echo.

:: Start PostgreSQL
echo [1/4] Starting PostgreSQL...
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" -D "C:\Users\sujal\pgdata" start -l "C:\Users\sujal\pgdata\log.txt" >nul 2>&1
if %errorlevel% neq 0 (
    echo   PostgreSQL may already be running or needs admin privileges
) else (
    echo   PostgreSQL started
)
timeout /t 2 /nobreak >nul

:: Start Backend
echo [2/4] Starting Backend on port 5000...
start "NextGen-Backend" /min cmd /c "cd /d C:\Users\sujal\NextGen_Campus\backend && node src/server.js"
timeout /t 3 /nobreak >nul

:: Start AI Service
echo [3/4] Starting AI Service on port 5001...
start "NextGen-AI" /min cmd /c "cd /d C:\Users\sujal\NextGen_Campus\ai-service && python app.py"
timeout /t 2 /nobreak >nul

:: Start Frontend
echo [4/4] Starting Frontend on port 3000...
start "NextGen-Frontend" /min cmd /c "cd /d C:\Users\sujal\NextGen_Campus\frontend && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   All Services Started!
echo ========================================
echo   Backend:    http://localhost:5000
echo   API Docs:   http://localhost:5000/api-docs
echo   Frontend:   http://localhost:3000
echo   AI Service: http://localhost:5001
echo ========================================
echo.
echo Press any key to stop all services...
pause >nul

:: Stop all
echo Stopping services...
taskkill /FI "WindowTitle eq NextGen-Backend" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq NextGen-AI" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq NextGen-Frontend" /T /F >nul 2>&1
echo All services stopped.
