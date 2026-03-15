const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath, { sheetRows: 200 });
    const sheet = workbook.Sheets['CML Report'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    data.forEach((row, i) => {
        console.log(`R${i}:`, JSON.stringify(row));
    });
} catch (e) {
    console.error(e);
}
