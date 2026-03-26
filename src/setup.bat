@echo off
echo ======================================
echo Step Sequencer - Complete Setup
echo ======================================
echo.

REM Stop any running dev server
echo ^> Stopping any running dev servers...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Clean everything
echo ^> Cleaning old build files and dependencies...
if exist node_modules rmdir /s /q node_modules
if exist dist rmdir /s /q dist
if exist .vite rmdir /s /q .vite
if exist package-lock.json del /f package-lock.json
if exist yarn.lock del /f yarn.lock

echo ^> Installing dependencies (this may take a minute)...
call npm install

echo.
echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo Now run: npm run dev
echo.
echo Then open: http://localhost:5173
echo.
pause
