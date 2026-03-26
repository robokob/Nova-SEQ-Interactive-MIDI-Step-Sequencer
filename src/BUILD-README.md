# 🎵 Building Portable Step Sequencer

This guide will help you create standalone, portable executables for your Interactive Step Sequencer that run without installation.

## 🚀 Quick Start

### Windows Users
```bash
# Option 1: Use batch file
build-scripts\build-portable.bat

# Option 2: Use command line
npm install
npm run dist-portable
```

### Mac/Linux Users  
```bash
# Option 1: Use shell script
chmod +x build-scripts/build-portable.sh
./build-scripts/build-portable.sh

# Option 2: Use npm commands
npm install
npm run dist-portable
```

## 📋 Prerequisites

1. **Node.js** (version 16 or higher)
   - Download from: https://nodejs.org
   - Verify: `node --version`

2. **npm** (comes with Node.js)
   - Verify: `npm --version`

## 🔧 Build Process

The build process creates these files:

### Windows
- `Interactive Step Sequencer-1.0.0-portable.exe` - **No installation needed**
- Just download and double-click to run

### Mac
- `Interactive Step Sequencer-1.0.0-mac.zip` - **No installation needed** 
- Extract and run the `.app` file

### Linux
- `Interactive Step Sequencer-1.0.0.AppImage` - **No installation needed**
- Make executable and run: `chmod +x *.AppImage && ./Interactive*.AppImage`

## 📁 Build Output

All portable files will be created in: `dist-electron/`

Typical build creates:
```
dist-electron/
├── Interactive Step Sequencer-1.0.0-portable.exe     (Windows)
├── Interactive Step Sequencer-1.0.0-mac.zip          (macOS)
├── Interactive Step Sequencer-1.0.0.AppImage         (Linux)
└── latest.yml                                         (metadata)
```

## 🎯 Features in Portable Version

✅ **Full MIDI Output** - Connect hardware synths, interfaces  
✅ **Web Audio Synthesis** - Internal sound generation  
✅ **4x4 Grid Sequencer** - Complete functionality  
✅ **Scale System** - All 13 scales and microtuning  
✅ **MIDI Export** - Export patterns as MIDI files  
✅ **Real-time Controls** - All features work offline  
✅ **No Internet Required** - Completely standalone  

## 🔍 Troubleshooting

### Build Fails
```bash
# Clear cache and retry
rm -rf node_modules package-lock.json
npm install
npm run build
npm run dist-portable
```

### Missing Dependencies
```bash
# Install missing Electron dependencies
npm install --save-dev electron electron-builder concurrently wait-on
```

### MIDI Issues in Built App
- The portable app includes full Web MIDI API support
- Ensure MIDI devices are connected before starting the app
- Check device permissions if MIDI detection fails

### File Size
- Windows executable: ~150-200MB (includes Chromium)
- macOS app: ~150-200MB (includes Chromium) 
- Linux AppImage: ~150-200MB (includes Chromium)

This is normal for Electron apps as they bundle the browser engine.

## 🚀 Distribution

### Share Your App
1. **Upload to cloud storage** (Google Drive, Dropbox, etc.)
2. **Email directly** (if file size permits)
3. **Host on website** for download
4. **USB drive** for offline distribution

### User Instructions
Send this to users:

> **Interactive Step Sequencer - Portable**
> 
> **Windows**: Download the .exe file, double-click to run  
> **Mac**: Download the .zip file, extract, run the .app  
> **Linux**: Download the .AppImage file, make executable, run
> 
> **No installation required!**
> 
> Connect MIDI devices before starting for best experience.

## 🛠️ Advanced Options

### Build for Specific Platform
```bash
# Windows only
npm run build && npx electron-builder --win portable

# Mac only  
npm run build && npx electron-builder --mac zip

# Linux only
npm run build && npx electron-builder --linux AppImage
```

### Custom Build Configuration
Edit `package.json` build section to customize:
- App name and description
- Icon files (place in `build-resources/`)
- File associations
- Auto-updater settings

### Development Mode
```bash
# Test in Electron without building
npm run electron-dev
```

## 🎉 Success!

Your portable Step Sequencer is ready! Users can now:
- Download and run immediately
- No installation process
- Full MIDI and audio functionality
- Works completely offline
- Professional music production capabilities

**Perfect for sharing with producers, performers, and music educators!**