const { app, BrowserWindow, protocol, net, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Logging setup for production debugging
const logPath = path.join(app.getPath('userData'), 'app-debug.log');
const log = (msg) => {
    const message = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(logPath, message);
};

log('--- Application Starting ---');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const isDev = process.env.NODE_ENV === 'development';

// Registrar el esquema como seguro y con privilegios
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function createWindow() {
    log('Creating window...');
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

    ipcMain.handle('save-project-file', async (event, { filePath, content }) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
            return { success: true };
        } catch (error) {
            log(`Error saving project file: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('send-email', async (event, { to, subject, text, html }) => {
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 465, // Si usas M2A Workspace tal vez es 465 SSL, si falla intenta 587
                secure: true,
                auth: {
                    user: 'admin.pact@gmail.com',
                    pass: 'ckzpmmfxlaxfforg',
                },
            });

            const info = await transporter.sendMail({
                from: '"PACT Platform" <admin.pact@gmail.com>',
                to,
                subject,
                text,
                html,
            });

            log(`Message sent: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            log(`Error sending email: ${error.message}`);
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

    ipcMain.handle('select-pdf-files', async () => {
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Documentos PDF', extensions: ['pdf'] }]
        });
        if (result.canceled) return [];
        return result.filePaths;
    });

    ipcMain.handle('select-project-file', async () => {
        const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [{ name: 'Respaldo del Proyecto (JSON)', extensions: ['json'] }]
        });
        if (result.canceled) return null;
        try {
            const content = fs.readFileSync(result.filePaths[0], 'utf8');
            return {
                success: true,
                data: JSON.parse(content),
                filePath: result.filePaths[0]
            };
        } catch (error) {
            log(`Error reading project file: ${error.message}`);
            return { success: false, error: 'Error al leer el archivo: ' + error.message };
        }
    });

    ipcMain.handle('parse-pdf', async (event, filePath) => {
        try {
            const PDFParser = require("pdf2json");
            const pdfParser = new PDFParser(null, 1);

            return new Promise((resolve, reject) => {
                pdfParser.on("pdfParser_dataError", errData => {
                    log(`PDF Parser Error: ${errData.parserError}`);
                    reject(errData.parserError);
                });
                pdfParser.on("pdfParser_dataReady", pdfData => {
                    const text = pdfParser.getRawTextContent();
                    resolve({ success: true, text });
                });
                pdfParser.loadPDF(filePath);
            });
        } catch (error) {
            log(`Error parsing PDF: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    if (isDev) {
        log('Loading URL http://localhost:3000');
        win.loadURL('http://localhost:3000').catch(err => {
            log(`Failed to load dev URL: ${err.message}`);
        });
        win.webContents.openDevTools();
    } else {
        log('Loading app://./index.html');
        win.loadURL('app://./index.html').catch(err => {
            log(`Failed to load app URL: ${err.message}`);
        });
    }

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        log(`Failed to load: ${errorCode} - ${errorDescription} at ${validatedURL}`);
    });
}

app.whenReady().then(() => {
    log('App is ready');
    protocol.handle('app', (request) => {
        try {
            let relativePath = request.url.replace('app://', '').split('?')[0];

            // Clean up leading paths like ./ or /
            while (relativePath.startsWith('.') || relativePath.startsWith('/')) {
                if (relativePath.startsWith('./')) relativePath = relativePath.substring(2);
                else relativePath = relativePath.substring(1);
            }

            if (relativePath === '') {
                relativePath = 'index.html';
            }

            let filePath = path.join(__dirname, '../out', relativePath);

            // Add .html if it doesn't exist and has no extension
            if (!fs.existsSync(filePath)) {
                if (fs.existsSync(filePath + '.html')) {
                    filePath = filePath + '.html';
                }
            }

            log(`Fetching: ${filePath}`);
            return net.fetch(pathToFileURL(filePath).toString());
        } catch (err) {
            log(`Protocol Error: ${err.message}`);
            return new Response('Error', { status: 500 });
        }
    });

    createWindow();
});

app.on('window-all-closed', () => {
    log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

process.on('uncaughtException', (error) => {
    log(`Uncaught Exception: ${error.message}\n${error.stack}`);
});


