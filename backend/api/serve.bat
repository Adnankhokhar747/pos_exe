@echo off
:: Start the PHP backend server on port 8000 + Laravel scheduler
:: Run this from the backend/api/ directory: serve.bat

echo Starting POS PHP Backend on http://127.0.0.1:8000 ...
echo Scheduler will run daily cloud backups at 02:00.
echo.
echo Press Ctrl+C to stop.
echo.

:: Run the scheduler in background (checks every minute)
start /B C:\php82\php.exe artisan schedule:work --no-interaction

:: Run the HTTP server (blocks until Ctrl+C)
C:\php82\php.exe -S 127.0.0.1:8000 "%~dp0public\index.php"
