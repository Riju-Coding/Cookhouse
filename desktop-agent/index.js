const { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences, dialog } = require('electron');
const path = require('path');
const activeWin = require('active-win');
const { uIOhook, UiohookKey } = require('uiohook-napi');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  // Load the Next.js local server
  mainWindow.loadURL('http://localhost:3000/admin');
  
  // Optionally open DevTools
  // mainWindow.webContents.openDevTools();

  // Start trackers
  startActivityTracking();
  startActivityCounters();
  startScreenshotEngine();
}

async function requestPermissions() {
  // 1. Explicit Consent Dialog (All OS)
  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Tracking Consent Required',
    message: 'To use the Cookhouse Desktop Agent, you must consent to activity tracking. This includes active windows, keystroke activity levels, and periodic screenshots for work verification.',
    buttons: ['I Consent', 'Decline and Exit'],
    defaultId: 0,
    cancelId: 1
  });

  if (response !== 0) {
    app.quit();
    return false;
  }

  // 2. Native Screen Recording Permission (macOS only)
  if (process.platform === 'darwin') {
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');
    if (screenStatus !== 'granted') {
      const { response: macResponse } = await dialog.showMessageBox({
        type: 'warning',
        title: 'macOS Permissions Required',
        message: 'Cookhouse Desktop requires Screen Recording permission to take screenshots. Please grant it in System Settings.',
        buttons: ['Continue Anyway', 'Exit']
      });
      if (macResponse !== 0) {
        app.quit();
        return false;
      }
    }
  }
  
  return true;
}

app.whenReady().then(async () => {
  const granted = await requestPermissions();
  if (!granted) return;
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// PC Activity Tracking Loop (Active App)
function startActivityTracking() {
  setInterval(async () => {
    try {
      if (!mainWindow) return;
      
      const windowInfo = await activeWin();
      
      if (windowInfo) {
        // Distinguish browser tabs by parsing title (e.g., "Page Title - Google Chrome")
        const appInfo = {
          title: windowInfo.title,
          ownerName: windowInfo.owner?.name || windowInfo.owner?.path || 'Unknown',
          url: windowInfo.url || null,
        };
        
        mainWindow.webContents.send('active-window-changed', appInfo);
      }
    } catch (err) {
      console.error("Failed to get active window:", err);
    }
  }, 2000); // Check every 2 seconds
}

// Keystroke & Mouse Counters (True Activity Level)
let keystrokeCount = 0;
let mouseClickCount = 0;

function startActivityCounters() {
  uIOhook.on('keydown', () => keystrokeCount++);
  uIOhook.on('mousedown', () => mouseClickCount++);
  uIOhook.start();

  setInterval(() => {
    if (!mainWindow) return;
    mainWindow.webContents.send('activity-level-update', {
      keystrokes: keystrokeCount,
      mouseClicks: mouseClickCount,
      timestamp: new Date().toISOString()
    });
    // Reset counters after sending
    keystrokeCount = 0;
    mouseClickCount = 0;
  }, 10000); // Send activity counts every 10 seconds
}

// Screenshot Engine
function startScreenshotEngine() {
  setInterval(async () => {
    if (!mainWindow) return;
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1280, height: 720 } });
      if (sources && sources.length > 0) {
        // Take the primary screen
        const primaryScreen = sources[0];
        const base64Image = primaryScreen.thumbnail.toDataURL(); // e.g., 'data:image/png;base64,...'
        
        mainWindow.webContents.send('screenshot-captured', {
          image: base64Image,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Screenshot capture failed:", err);
    }
  }, 5 * 60 * 1000); // Take a screenshot every 5 minutes
}
