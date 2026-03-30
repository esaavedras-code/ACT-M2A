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

    const lines = content.split('\n');
    const newLines = [];
    let insideAction = false;
    let hasPropInline = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Very basic action block detection: starts with { and has label: export/import
        if (line.includes('{') && /label:\s*["'](?:Exportar|Importar)(?:\s+JSON|\s+Datos)["']/.test(line)) {
            insideAction = true;
            hasPropInline = line.includes('position:');
            newLines.push(line);
            continue;
        }

        if (insideAction) {
            // If we find a redundant property line, skip it
            if (hasPropInline && /^\s*position:\s*['"]middle-right['"]\s*,?\s*$/.test(line)) {
                changed = true;
                continue;
            }
            if (hasPropInline && /^\s*size:\s*['"]small['"]\s*,?\s*$/.test(line)) {
                changed = true;
                continue;
            }
            
            if (line.includes('}')) {
                insideAction = false;
            }
        }
        
        newLines.push(line);
    }

    if (changed) {
        fs.writeFileSync(file, newLines.join('\n'), 'utf8');
        console.log('Fixed duplicates in:', file);
        updatedCount++;
    }
}
console.log('Total files fixed:', updatedCount);
