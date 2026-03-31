const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveProjectFile: (data) => ipcRenderer.invoke('save-project-file', data),
    saveFileBinary: (data) => ipcRenderer.invoke('save-file-binary', data),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectPdfFiles: () => ipcRenderer.invoke('select-pdf-files'),
    selectProjectFile: () => ipcRenderer.invoke('select-project-file'),
    sendEmail: (data) => ipcRenderer.invoke('send-email', data),
    parsePdf: (filePath) => ipcRenderer.invoke('parse-pdf', filePath),
    parsePdfBase64: (base64Data) => ipcRenderer.invoke('parse-pdf-base64', base64Data),
    readFileBinary: (filePath) => ipcRenderer.invoke('read-file-binary', filePath),
    analyzeDocument: (data) => ipcRenderer.invoke('analyze-document', data)
});
