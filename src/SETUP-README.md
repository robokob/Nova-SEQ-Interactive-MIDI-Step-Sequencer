# Step Sequencer - Setup Instructions

## ⚠️ IMPORTANT: UI Not Showing / Styling Issues

If the UI appears as **unstyled text** (no colors, no grid layout), follow these steps **EXACTLY**:

### Quick Fix (Required)

1. **Stop the dev server** - Press `Ctrl+C` in the terminal
2. **Run the setup script**:
   - **Mac/Linux**: `bash setup.sh`
   - **Windows**: `setup.bat`
3. **Start the dev server**: `npm run dev`
4. **Open browser**: http://localhost:5173

### Manual Fix (if script doesn't work)

```bash
# 1. Stop dev server (Ctrl+C)

# 2. Delete cache and dependencies
rm -rf node_modules
rm -rf .vite
rm -rf dist
rm -f package-lock.json

# 3. Fresh install
npm install

# 4. Start dev server
npm run dev
```

### Why This Happens

The project was previously configured for **Tailwind CSS v4 (beta)** which had compatibility issues. It's now using **Tailwind CSS v3 (stable)**. The old cached files from v4 prevent v3 from working correctly.

## Verification

After running the setup, you should see:
- ✅ Colorful 4x4 grid with green/yellow/gray cells
- ✅ Styled buttons and controls
- ✅ Professional layout with panels
- ✅ Proper spacing and typography

If you still see unstyled HTML:
1. Check browser console for errors (F12)
2. Verify `node_modules/tailwindcss` exists
3. Make sure you're on http://localhost:5173 (not 5174 or other port)

## Project Structure

```
/
├── App.tsx                 # Main application
├── main.tsx               # Entry point
├── index.html             # HTML template
├── styles/
│   └── globals.css        # Tailwind + CSS variables
├── components/            # All React components
├── utils/                 # Utility functions
├── tailwind.config.js     # Tailwind configuration
├── postcss.config.js      # PostCSS configuration
├── vite.config.ts         # Vite build configuration
└── package.json           # Dependencies

```

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run electron` - Run in Electron (after building)
- `npm run dist-portable` - Create portable executables

## Features

- 4x4 interactive grid sequencer
- MIDI output support
- WebAudio synthesis
- Scale system (13 scales × 12 roots)
- Step recording with QWERTY keyboard
- Euclidean patterns
- Clock dividers
- Export functionality
- Transport controls
- Velocity control (64-127)

## Browser Requirements

- Modern browser with WebMIDI API support (Chrome, Edge, Opera)
- WebAudio API support
- JavaScript enabled

## MIDI Setup

1. Connect MIDI device to computer
2. Allow MIDI access when browser prompts
3. Select device from MIDI Output panel
4. Enable "Send MIDI Out" toggle

## Troubleshooting

### "No MIDI devices detected"
- Ensure MIDI device is connected before starting browser
- Grant MIDI permissions in browser
- Click "Manual Device Scan" button
- Check browser console for errors

### "Module not found" errors
- Run setup script again
- Verify all files exist in project directory

### Performance issues
- Close other browser tabs
- Reduce BPM
- Disable audio preview if not needed

### Electron build issues
- Run `npm run build` first
- Check build-scripts/ directory exists
- Verify electron-builder is installed

## License

MIT License - See project documentation for details
