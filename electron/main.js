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

    win.webContents.on('context-menu', (event, params) => {
        const { Menu, MenuItem } = require('electron');
        const menu = new Menu();

        if (params.isEditable) {
            menu.append(new MenuItem({ label: 'Deshacer', role: 'undo' }));
            menu.append(new MenuItem({ label: 'Rehacer', role: 'redo' }));
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({ label: 'Cortar', role: 'cut' }));
            menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
            menu.append(new MenuItem({ label: 'Pegar', role: 'paste' }));
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({ label: 'Seleccionar todo', role: 'selectAll' }));
        } else if (params.selectionText && params.selectionText.trim() !== '') {
            menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({ label: 'Seleccionar todo', role: 'selectAll' }));
        }

        if (menu.items.length > 0) {
            menu.popup({ window: win, x: params.x, y: params.y });
        }
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

    ipcMain.handle('save-file-binary', async (event, { filePath, base64Data }) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
            return { success: true };
        } catch (error) {
            log(`Error saving binary file: ${error.message}`);
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

    ipcMain.handle('read-file-binary', async (event, filePath) => {
        try {
            const content = fs.readFileSync(filePath);
            return { success: true, data: content.toString('base64') };
        } catch (error) {
            log(`Error reading binary file: ${error.message}`);
            return { success: false, error: error.message };
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

    ipcMain.handle('parse-pdf-base64', async (event, base64Data) => {
        try {
            const PDFParser = require("pdf2json");
            const pdfParser = new PDFParser(null, 1);
            
            // Extraer el base64 limpio apartando el MIME si existe
            const base64Clean = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
            const pdfBuffer = Buffer.from(base64Clean, 'base64');

            return new Promise((resolve, reject) => {
                pdfParser.on("pdfParser_dataError", errData => {
                    log(`PDF Parser Base64 Error: ${errData.parserError}`);
                    reject(errData.parserError);
                });
                pdfParser.on("pdfParser_dataReady", pdfData => {
                    const text = pdfParser.getRawTextContent();
                    resolve({ success: true, text });
                });
                pdfParser.parseBuffer(pdfBuffer);
            });
        } catch (error) {
            log(`Error parsing PDF Base64: ${error.message}`);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('analyze-document', async (event, { text, prompt, image }) => {
        try {
            if (!process.env.GROQ_API_KEY) {
                return { success: false, error: 'Configuración incompleta de IA (falta GROQ_API_KEY)' };
            }

            const systemMessage = "Eres un asistente experto en analizar documentos de proyectos de construcción de carreteras y contratos gubernamentales (ej. ACT, FHWA). El usuario te proporcionará texto o una imagen de un documento y una instrucción específica sobre qué información extraer. Responde de forma profesional y clara únicamente con la información solicitada.";
            const messages = [{ role: "system", content: systemMessage }];

            if (image) {
                const imagesArray = Array.isArray(image) ? image : [image];
                const contentArray = [{ type: "text", text: `Instrucción del usuario: "${prompt}"` }];
                imagesArray.forEach((imgBase64) => {
                    contentArray.push({
                        type: "image_url",
                        image_url: { url: imgBase64.startsWith('data:') ? imgBase64 : `data:image/jpeg;base64,${imgBase64}` }
                    });
                });
                messages.push({ role: "user", content: contentArray });
            } else {
                messages.push({ 
                    role: "user", 
                    content: `A continuación el texto del documento para analizar:\n\n---\n${(text || "").substring(0, 45000)}\n---\n\nInstrucción del usuario: "${prompt}"` 
                });
            }

            log(`Enviando a Groq API: ${image ? "Vision AI" : "Text AI"}`);
            
            const response = await net.fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: image ? "llama-3.2-90b-vision-instruct" : "llama-3.3-70b-versatile",
                    temperature: 0.2,
                    messages: messages
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                log(`Groq API Error Status: ${response.status} - ${errText}`);
                return { success: false, error: `Error Groq API: ${response.status}` };
            }

            const groqData = await response.json();
            if (groqData.error) {
                return { success: false, error: groqData.error.message || "Error de Groq API" };
            }

            const aiResult = groqData.choices?.[0]?.message?.content || "No se pudo generar una respuesta.";
            return { success: true, result: aiResult };
        } catch (error) {
            log(`Error in analyzeDocument: ${error.message}`);
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


