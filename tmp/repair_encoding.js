const fs = require('fs');
const path = require('path');

const replacements = {
    'Ã³': 'ó', 'Ã¡': 'á', 'Ã©': 'é', 'Ãº': 'ú', 'Ã±': 'ñ', 'Ã­': 'í',
    'Ã“': 'Ó', 'Ã ': 'Á', 'Ã‰': 'É', 'Ãš': 'Ú', 'Ã‘': 'Ñ', 'Ã\u008D': 'Í',
    'Ã\u00A1': 'á', 'Ã\u00A9': 'é', 'Ã\u00AD': 'í', 'Ã\u00B3': 'ó', 'Ã\u00BA': 'ú', 'Ã\u00B1': 'ñ',
    'Ã\u0081': 'Á', 'Ã\u0089': 'É', 'Ã\u008D': 'Í', 'Ã\u0093': 'Ó', 'Ã\u009A': 'Ú', 'Ã\u0091': 'Ñ'
};

const repairFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    for (const [bad, good] of Object.entries(replacements)) {
        if (content.includes(bad)) {
            content = content.split(bad).join(good);
            changed = true;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Repaired: ${filePath}`);
    }
};

const dir = 'src/lib';
fs.readdirSync(dir).forEach(file => {
    if (file.endsWith('.ts')) {
        repairFile(path.join(dir, file));
    }
});
