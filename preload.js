const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveConfig: (data) => ipcRenderer.send('save-config', data),
    saveSite: (data) => ipcRenderer.send('save-site', data),
    getConfig: () => ipcRenderer.invoke('get-config'),
    getSites: () => ipcRenderer.invoke('get-site'),
    getTranslate:(language) => ipcRenderer.invoke('get-translate', language),

    callImport: () => ipcRenderer.invoke('import'),
    callExport: () => ipcRenderer.invoke('export')
});
