const fs = require('fs');
fs.writeFileSync('tmp/startup.log', 'Starting main process...\n');
try {
    require('../electron/main.js');
} catch (e) {
    fs.appendFileSync('tmp/startup.log', 'Error:\n' + (e.stack || e) + '\n');
}

process.on('uncaughtException', (e) => {
    fs.appendFileSync('tmp/startup.log', 'Uncaught:\n' + (e.stack || e) + '\n');
});

process.on('unhandledRejection', (e) => {
    fs.appendFileSync('tmp/startup.log', 'UnhandledRejection:\n' + (e.stack || e) + '\n');
});
