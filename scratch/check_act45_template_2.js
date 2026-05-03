const ExcelJS = require('exceljs');

async function checkTemplate() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\ACT 45 Informe diario.xlsx');
    const sheet = workbook.worksheets[0];
    
    // Dump rows 36 to 120 to find headers
    for (let r = 36; r <= 120; r++) {
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
