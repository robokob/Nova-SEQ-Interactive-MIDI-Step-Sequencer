// Electron main process for standalone step sequencer
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Enable live reload for development
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (e) {
    // electron-reload might not be available in production
  }
}

function createWindow() {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Allow local file access for audio and MIDI
      allowRunningInsecureContent: false,
      // Enable Web MIDI API and Web Audio API
      additionalArguments: ['--enable-web-midi', '--autoplay-policy=no-user-gesture-required']
    },
    icon: getAppIcon(),
    title: 'Interactive Step Sequencer',
    show: false, // Don't show until ready
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff' // Prevent white flash
  });

  // Set CSP to allow Web MIDI and Audio
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; media-src \'self\' blob:; connect-src \'self\' blob:;']
      }
    });
  });

  // Load the app
  if (isDev) {
    // Development mode - connect to Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Helper function to get app icon
  function getAppIcon() {
    const iconName = process.platform === 'win32' ? 'icon.ico' : 
                     process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
    const iconPath = path.join(__dirname, '../build-resources', iconName);
    return iconPath;
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    app.quit();
  });

  // Custom menu for music application
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Pattern',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              // Reset sequencer to default state
              if (window.resetSequencer) window.resetSequencer();
            `);
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Transport',
      submenu: [
        {
          label: 'Play/Stop',
          accelerator: 'Space',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              // Trigger spacebar event
              window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
            `);
          }
        },
        {
          label: 'Stop',
          accelerator: 'CmdOrCtrl+.',
          click: () => {
            mainWindow.webContents.executeJavaScript(`
              if (window.stopSequencer) window.stopSequencer();
            `);
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation and handle external links
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationURL) => {
    navigationEvent.preventDefault();
    // Open external links in default browser
    shell.openExternal(navigationURL);
  });

  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});