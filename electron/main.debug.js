const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

process.on('uncaughtException', (err) => {
    fs.writeFileSync(path.join(__dirname, 'crash_ue.log'), err.stack || String(err));
    app.exit(1);
});
process.on('unhandledRejection', (err) => {
    fs.writeFileSync(path.join(__dirname, 'crash_ur.log'), err.stack || String(err));
    app.exit(1);
});

try {
    require('./main.js');
} catch (err) {
    fs.writeFileSync(path.join(__dirname, 'crash_require.log'), err.stack || String(err));
    app.exit(1);
}
