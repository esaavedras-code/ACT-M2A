const XLSX = require('xlsx');
const path = require('path');

async function inspectTemplate() {
    const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', 'CML sin restricciones.xlsx');
    const workbook = XLSX.readFile(filePath);
    const ws = workbook.Sheets['CML Report'] || workbook.Sheets[workbook.SheetNames[0]];

    const inspectSingle = (addr) => {
        const cell = ws[addr];
        console.log(`${addr}: VAL: ${cell ? cell.v : 'E'} | FML: ${cell && cell.f ? cell.f : 'None'}`);
    };

    console.log('--- Range 35 ---');
    'BCDEFGHIJKLMNOPQRSTU'.split('').forEach(c => inspectSingle(c + '35'));

    console.log('\n--- Range 70 ---');
    'BCDEFGHIJKLMNOPQRSTU'.split('').forEach(c => inspectSingle(c + '70'));

    console.log('\n--- T Summary ---');
    '10,11,12,13,14'.split(',').forEach(r => inspectSingle('T' + r));
}

inspectTemplate().catch(console.error);
