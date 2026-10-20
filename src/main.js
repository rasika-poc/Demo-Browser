const { app, BrowserWindow, Menu, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const isMac = process.platform === 'darwin';
const configPath = () => path.join(app.getPath('userData'), 'config.json');
const windowStatePath = () => path.join(app.getPath('userData'), 'window.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Reuse the last window bounds only if they still land on a connected display.
function savedBounds() {
  const s = readJson(windowStatePath());
  if (!s?.bounds) return { state: s, bounds: { width: 1600, height: 960 } };
  const area = screen.getDisplayMatching(s.bounds).workArea;
  const visible =
    s.bounds.x < area.x + area.width && s.bounds.x + s.bounds.width > area.x &&
    s.bounds.y < area.y + area.height && s.bounds.y + s.bounds.height > area.y;
  return { state: s, bounds: visible ? s.bounds : { width: s.bounds.width, height: s.bounds.height } };
}

// Present as a regular Chrome so sites (e.g. Google sign-in) don't reject the embedded panes.
app.userAgentFallback = app.userAgentFallback
  .replace(/ Electron\/\S+/, '')
  .replace(/ demo-browser\/\S+/, '');

let win;
const send = (action) => win?.webContents.send('command', action);

function buildMenu() {
  const item = (label, accelerator, action) => ({ label, accelerator, click: () => send(action) });
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'Sites',
      submenu: [
        item('Add Site', 'CmdOrCtrl+T', 'newPane'),
        item('Remove Focused Site', 'CmdOrCtrl+W', 'closePane'),
      ],
    },
    {
      label: 'View',
      submenu: [
        ...[1, 2, 3, 4, 5, 6].map((n) => item(`Focus Pane ${n}`, `CmdOrCtrl+${n}`, `focus:${n - 1}`)),
        item('Show All Panes', 'CmdOrCtrl+0', 'showAll'),
        item('Next Layout', 'CmdOrCtrl+Shift+L', 'cycleLayout'),
        item('Edit Focused URL', 'CmdOrCtrl+L', 'editUrl'),
        item('Zoom In Focused Pane', 'CmdOrCtrl+=', 'zoomIn'),
        item('Zoom Out Focused Pane', 'CmdOrCtrl+-', 'zoomOut'),
        { type: 'separator' },
        item('Next Scene', 'CmdOrCtrl+Alt+Right', 'nextScene'),
        item('Previous Scene', 'CmdOrCtrl+Alt+Left', 'prevScene'),
        { type: 'separator' },
        item('Toggle Control Panel', 'CmdOrCtrl+K', 'togglePanel'),
        item('Toggle Browser Chrome', 'CmdOrCtrl+Shift+H', 'toggleClean'),
        { type: 'separator' },
        item('Reload Focused Pane', 'CmdOrCtrl+R', 'reloadFocused'),
        item('Reload All Panes', 'CmdOrCtrl+Shift+R', 'reloadAll'),
        { label: 'Reload App UI', accelerator: 'CmdOrCtrl+Alt+R', click: () => win?.reload() },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      role: 'window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [])],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const { state: lastWindow, bounds } = savedBounds();
  win = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0c11',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
    },
  });

  // Guest pages get no preload and no Node access, whatever the markup asks for.
  win.webContents.on('will-attach-webview', (_e, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  if (lastWindow?.maximized) win.maximize();
  if (lastWindow?.fullscreen) win.setFullScreen(true);
  win.on('close', () => {
    const state = { bounds: win.getNormalBounds(), maximized: win.isMaximized(), fullscreen: win.isFullScreen() };
    fs.writeFileSync(windowStatePath(), JSON.stringify(state, null, 2));
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

// Popups (target=_blank, window.open) open in the same pane instead of a new window.
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url }) => {
    contents.loadURL(url);
    return { action: 'deny' };
  });
});

ipcMain.handle('config:load', () => readJson(configPath()));

ipcMain.handle('config:save', (_e, cfg) => {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
});

ipcMain.on('config:saveSync', (e, cfg) => {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2));
  e.returnValue = true;
});

ipcMain.handle('config:export', async (_e, cfg) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: 'demo-scenes.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2));
  return true;
});

ipcMain.handle('config:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePaths[0]) return null;
  return JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isMac) app.quit();
});
