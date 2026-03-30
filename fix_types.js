const fs = require('fs');
const path = require('path');

function getFiles(dir, allFiles = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, allFiles);
        } else if (name.endsWith('.tsx')) {
            allFiles.push(name);
        }
    }
    return allFiles;
}

const files = getFiles('src/components');
let updatedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    let changed = false;
    // Replace position: "middle-right" with position: "middle-right" as const
    if (content.includes('position: "middle-right"')) {
        content = content.replace(/position:\s*"middle-right"/g, 'position: "middle-right" as const');
        changed = true;
    }
    // Replace size: "small" with size: "small" as const
    if (content.includes('size: "small"')) {
        content = content.replace(/size:\s*"small"/g, 'size: "small" as const');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated:', file);
        updatedCount++;
    }
}
console.log('Total files updated:', updatedCount);
