@echo off
echo ========================================
echo NimHub - Quick Start Script
echo ========================================
echo.

echo [1/5] Killing processes on ports 3000 and 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] Clearing Next.js cache...
if exist .next rmdir /s /q .next
echo Cache cleared!

echo [3/5] Starting backend server (port 3000)...
start "NimHub Backend" cmd /k "cd nimsplit\server && npm start"
timeout /t 3 /nobreak >nul

echo [4/5] Starting frontend server (port 3001)...
start "NimHub Frontend" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

echo [5/5] Opening browser...
timeout /t 5 /nobreak >nul
start http://localhost:3001

echo.
echo ========================================
echo NimHub is starting!
echo ========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:3001
echo.
echo Press any key to close this window...
pause >nul
