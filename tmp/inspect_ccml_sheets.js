const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath);
    console.log("Sheet Names:", workbook.SheetNames);
    
    // Check first few sheets
    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Sheet: ${name}, Rows: ${data.length}`);
        if (data.length > 0) {
            console.log("Sample row 0:", JSON.stringify(data[0]));
            console.log("Sample row 1:", JSON.stringify(data[1]));
        }
    });

} catch (e) {
    console.error(e);
}
