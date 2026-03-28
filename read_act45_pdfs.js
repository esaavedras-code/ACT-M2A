const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

async function parse(filePath) {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
}

(async () => {
    try {
        const act45Path = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'public', 'ACT-45 Actividades.pdf');
        const instPath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'public', 'ACT-45 Instrucciones.pdf');
        
        console.log('--- ACT-45 Actividades ---');
        const act45Text = await parse(act45Path);
        console.log(act45Text);
        
        console.log('\n--- ACT-45 Instrucciones ---');
        const instText = await parse(instPath);
        console.log(instText);
    } catch (e) {
        console.error('Error:', e);
    }
})();
