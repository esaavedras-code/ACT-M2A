const fs = require('fs');
const cp = require('child_process');

try {
    const result = cp.execSync('npx electron-builder', { env: { ...process.env, CSC_SKIP_SIGNING: 'true' } });
    fs.writeFileSync('electron_log.txt', result);
} catch (e) {
    fs.writeFileSync('electron_log.txt', e.stdout ? e.stdout.toString() : '');
    fs.appendFileSync('electron_log.txt', '\n\n--- ERROR ---\n\n' + (e.stderr ? e.stderr.toString() : e.message));
}
