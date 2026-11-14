@echo off
setlocal
cd /d "%~dp0FRONTEND\my-volunteer-app"
call npm ci --no-audit --no-fund
if errorlevel 1 goto failed
echo App: http://127.0.0.1:5173 - keep this window open.
call npm run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Check Node.js version and copy the error above.
pause
exit /b 1
