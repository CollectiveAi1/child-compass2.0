// Desktop shell for Child Care Compass. Loads the web app from a URL —
// http://localhost:5173 during development (run `npm run dev` at the repo root
// first) or your deployed Vercel URL for a packaged build. Configure via the
// COMPASS_APP_URL environment variable or app-url.json.
const { app, BrowserWindow, shell } = require('electron');
const { join } = require('node:path');

const appUrl = process.env.COMPASS_APP_URL || require('./app-url.json').url;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: '#f7f9fb',
    autoHideMenuBar: true,
    icon: join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  // Keep the shell scoped to the app: external links open in the system browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.loadURL(appUrl).catch(() => {
    void window.loadURL(`data:text/html,<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:%23f7f9fb"><div style="text-align:center;max-width:32rem"><h1>Child Care Compass</h1><p>Could not reach <code>${appUrl}</code>.</p><p>Start the dev server with <code>npm run dev</code>, or point COMPASS_APP_URL (or app-url.json) at your deployed Vercel URL.</p></div></body>`);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
