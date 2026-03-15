const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['CML Report'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Print first 100 rows
    for (let i = 0; i < 100; i++) {
        if (data[i]) {
            console.log(`ROW ${i}:`, JSON.stringify(data[i]));
        }
    }

} catch (e) {
    console.error(e);
}
