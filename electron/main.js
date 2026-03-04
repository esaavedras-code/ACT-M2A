const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = process.env.NODE_ENV === 'development';

// Registrar el esquema como seguro y con privilegios
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Proyectos ACT (PACT)",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    const { ipcMain, dialog } = require('electron');

    ipcMain.handle('save-project-file', async (event, { filePath, content }) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
            return { success: true };
        } catch (error) {
            console.error("Error saving project file:", error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('select-folder', async () => {
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    if (isDev) {
        win.loadURL('http://localhost:3000');
        win.webContents.openDevTools();
    } else {
        win.loadURL('app://./index.html');
    }
}

app.whenReady().then(() => {
    // Manejar el protocolo 'app://'
    protocol.handle('app', (request) => {
        const url = request.url.replace('app://', '');
        let relativePath = url;

        // Si no hay ruta o es un directorio, buscar index.html
        if (relativePath === '' || relativePath === '/' || relativePath === './') {
            relativePath = 'index.html';
        }

        // Quitar parámetros de búsqueda si existen
        relativePath = relativePath.split('?')[0];

        let filePath = path.join(__dirname, '../out', relativePath);

        // Lógica para rutas estáticas de Next.js (si no tiene extensión, probar con .html)
        if (!fs.existsSync(filePath) && !relativePath.includes('.')) {
            const htmlPath = filePath + '.html';
            if (fs.existsSync(htmlPath)) {
                filePath = htmlPath;
            }
        }

        return net.fetch(pathToFileURL(filePath).toString());
    });

    createWindow();
});

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

