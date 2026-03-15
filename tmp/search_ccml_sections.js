const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath, { sheetRows: 500 });
    const sheet = workbook.Sheets['CML Report'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    const searches = ["Project Number:", "Original Project Funds Information", "Project Modification Documents"];
    
    data.forEach((row, i) => {
        const rowStr = JSON.stringify(row);
        searches.forEach(term => {
            if (rowStr.includes(term)) {
                console.log(`FOUND "${term}" at R${i}:`, rowStr);
            }
        });
    });
} catch (e) {
    console.error(e);
}
