const ExcelJS = require('exceljs');
const path = require('path');

async function checkTemplate() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\ACT 45 Informe diario.xlsx');
    const sheet = workbook.worksheets[0];
    
    console.log("Sheet name:", sheet.name);
    
    // Dump rows 1 to 20 to find headers
    for (let r = 1; r <= 35; r++) {
        let rowData = [];
        const row = sheet.getRow(r);
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            rowData.push(`${cell.address}:${cell.value}`);
        });
        if (rowData.length > 0) {
            console.log(`Row ${r}:`, rowData.join(' | '));
        }
    }
}

checkTemplate().catch(console.error);
