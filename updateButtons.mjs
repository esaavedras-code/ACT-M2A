import fs from 'fs';
import { globSync } from 'glob';

const files = globSync('src/components/**/*.tsx');
let updatedCount = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');

    const regexExport = /(label:\s*["']Exportar\s+(JSON|Datos)["'][\s\S]*?disabled:\s*loading)[\s\S]*?\}/g;
    const regexImport = /(label:\s*["']Importar\s+(JSON|Datos)["'][\s\S]*?disabled:\s*loading)[\s\S]*?\}/g;
    
    // Some buttons might not have disabled: loading as the last prop before }.
    // Let's use a safer regex: replacing the end of the action object `}`
    
    // Specifically looking for Exportar JSON / Importar JSON action block in FloatingFormActions
    
    const replacer = (match, p1) => {
        if(match.includes('position:')) return match;
        return p1 + ',\n                        position: "middle-right",\n                        size: "small"\n                    }';
    };

    let newContent = content.replace(regexExport, replacer);
    newContent = newContent.replace(regexImport, replacer);

    if (newContent !== content) {
        fs.writeFileSync(file, newContent);
        console.log('Updated:', file);
        updatedCount++;
    }
}
console.log('Total files updated:', updatedCount);
