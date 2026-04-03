const XLSX = require('xlsx');
const path = require('path');

async function inspectTemplate() {
    const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', 'CML sin restricciones.xlsx');
    const workbook = XLSX.readFile(filePath);
    const ws = workbook.Sheets['CML Report'] || workbook.Sheets[workbook.SheetNames[0]];

    console.log('--- Rows 223 to 229 ---');
    for (let r = 223; r <= 229; r++) {
        let row = [];
        'BCDEFGHIJKL'.split('').forEach(c => {
            const addr = c + r;
            const cell = ws[addr];
            row.push(`${addr}:${cell ? cell.v : 'E'}`);
        });
        console.log(row.join(' | '));
    }
}
inspectTemplate().catch(console.error);
