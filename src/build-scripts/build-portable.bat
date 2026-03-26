@echo off
echo 🎵 Building Portable Step Sequencer...
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

:: Check if npm is installed  
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ npm not found. Please install npm first.
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
call npm install

echo 🔧 Installing additional Electron dependencies...
call npm install --save-dev concurrently wait-on

echo 📁 Creating build resources directory...
if not exist "build-resources" mkdir build-resources

echo ⚛️ Building React application...
call npm run build

if %ERRORLEVEL% neq 0 (
    echo ❌ React build failed!
    pause
    exit /b 1
)

echo 📱 Building Electron application...
echo 🖥️ Building Windows portable...
call npm run dist-portable

if %ERRORLEVEL% neq 0 (
    echo ❌ Electron build failed!
    pause
    exit /b 1
)

echo.
echo ✅ Build complete!
echo 📁 Portable apps available in: dist-electron\
echo.
echo 📋 Files created:
if exist "dist-electron" (
    dir /b dist-electron\*.exe 2>nul
    dir /b dist-electron\*.zip 2>nul
) else (
    echo    Build directory not found - check for errors above
)

echo.
echo 🎉 Your portable step sequencer is ready!
echo 📖 To distribute:
echo    • Windows: Share the .exe file (no installation needed)
echo.
echo 💡 Next steps:
echo    1. Test the app: Open the generated executable
echo    2. Connect MIDI device and test MIDI output  
echo    3. Share the portable file - no installation required!

pause