@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 goto py
where python >nul 2>nul
if not errorlevel 1 goto python
echo Python 3 richiesto per avviare la preview: https://www.python.org/downloads/
pause
exit /b 1
:py
echo CONQUER urban locale: http://127.0.0.1:4173/
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4173/"
py -3 -m http.server 4173 --bind 127.0.0.1
exit /b %errorlevel%
:python
echo CONQUER urban locale: http://127.0.0.1:4173/
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:4173/"
python -m http.server 4173 --bind 127.0.0.1
