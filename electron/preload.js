const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveProjectFile: (data) => ipcRenderer.invoke('save-project-file', data),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectPdfFiles: () => ipcRenderer.invoke('select-pdf-files'),
    selectProjectFile: () => ipcRenderer.invoke('select-project-file'),
    sendEmail: (data) => ipcRenderer.invoke('send-email', data),
    parsePdf: (filePath) => ipcRenderer.invoke('parse-pdf', filePath)
});
