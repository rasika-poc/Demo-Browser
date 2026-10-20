const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('demo', {
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  saveConfigSync: (cfg) => ipcRenderer.sendSync('config:saveSync', cfg),
  exportConfig: (cfg) => ipcRenderer.invoke('config:export', cfg),
  importConfig: () => ipcRenderer.invoke('config:import'),
  onCommand: (cb) => ipcRenderer.on('command', (_e, action) => cb(action)),
});
