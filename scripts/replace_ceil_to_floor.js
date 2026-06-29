const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            
            // Regex that matches Math.ceil with some nested parentheses before the division
            // Since we know what we are looking for, let's just do it manually line by line
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('Math.ceil') && (lines[i].includes('1000 * 3600 * 24') || lines[i].includes('1000 * 60 * 60 * 24'))) {
                    lines[i] = lines[i].replace(/Math\.ceil/g, 'Math.floor');
                }
            }
            content = lines.join('\n');

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

processDir(path.join(__dirname, '../src'));
