const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveProjectFile: (data) => ipcRenderer.invoke('save-project-file', data),
    selectFolder: () => ipcRenderer.invoke('select-folder')
});
