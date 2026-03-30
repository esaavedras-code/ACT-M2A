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
    
    // Look for blocks between { and } that have multiple position definitions
    // This is getting hard to do with simple regex.
    // I'll just remove the lines that are exactly:
    //    position: 'middle-right',
    //    size: 'small'
    // without as const, ONLY if they are inside a block that already has 'position: "middle-right" as const'
    
    let changed = false;
    const blocks = content.split('\n');
    let insideActionBlock = false;
    let hasInlineProp = false;
    
    const newLines = [];
    for (let i = 0; i < blocks.length; i++) {
        const line = blocks[i];
        
        if (line.includes('{')) {
            // New candidate for action block if no property already found
            // (Assumes { is the start of an object)
            // But we only care if it's an action block
        }
        
        if (/label:\s*["'](?:Exportar|Importar)(?:\s+JSON|\s+Datos)["']/.test(line)) {
            if (line.includes('position:')) {
                hasInlineProp = true;
            }
        }
        
        // This is still too brittle.
        // Let's just remove the lines if they appear in any file that already has the inline version
    }
    
    // Simplest fix: Just delete the redundant lines if they exist in the file.
    if (content.includes('position: "middle-right" as const')) {
        const initialLen = content.length;
        content = content.replace(/^\s+position:\s*['"]middle-right['"],?\s*$/gm, '');
        content = content.replace(/^\s+size:\s*['"]small['"],?\s*$/gm, '');
        if (content.length < initialLen) {
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed:', file);
        updatedCount++;
    }
}
console.log('Total files fixed:', updatedCount);
