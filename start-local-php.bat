@echo off
title Local PHP Server - POS Backend
set PHP=C:\Users\adnan\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe
cd /d C:\Users\adnan\Documents\GitHub\pos_exe\backend\api
echo.
echo  Starting local PHP server on http://localhost:8001
echo  Connected to live database (MariaDB on stackcp.com)
echo.
echo  Renderer .env.local is already set to http://localhost:8001
echo  Run "npm run dev" in apps/renderer to test locally
echo.
echo  Press Ctrl+C to stop the server
echo.
"%PHP%" artisan serve --host=127.0.0.1 --port=8001
pause
