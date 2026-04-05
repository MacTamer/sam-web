@echo off
title Sam Web
cd /d "%~dp0"

echo.
echo  Starting Sam Web (development)...
echo  Open: http://localhost:3000
echo.

npm run dev
pause
