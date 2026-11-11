@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 goto failed
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto failed
".venv\Scripts\python.exe" Obninsk_Hakaton2\manage.py migrate
if errorlevel 1 goto failed
".venv\Scripts\python.exe" Obninsk_Hakaton2\manage.py seed_demo
if errorlevel 1 goto failed
echo Backend: http://127.0.0.1:8000 - keep this window open.
".venv\Scripts\python.exe" Obninsk_Hakaton2\manage.py runserver 127.0.0.1:8000
if errorlevel 1 goto failed
exit /b 0
:failed
echo Startup failed. Copy the error above and send it for help.
pause
exit /b 1
