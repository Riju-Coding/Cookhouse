const { contextBridge, ipcRenderer } = require('electron');

// Expose a bridge to the Next.js window object
contextBridge.exposeInMainWorld('desktopAgent', {
  // Allow React to subscribe to active window changes
  onActiveAppChanged: (callback) => ipcRenderer.on('active-window-changed', (_event, appInfo) => callback(appInfo)),
  
  // Subscribe to keystrokes and mouse clicks
  onActivityLevelUpdate: (callback) => ipcRenderer.on('activity-level-update', (_event, data) => callback(data)),
  
  // Subscribe to screenshot captures
  onScreenshotCaptured: (callback) => ipcRenderer.on('screenshot-captured', (_event, data) => callback(data)),
  
  // Is it running in Electron?
  isDesktop: true
});
