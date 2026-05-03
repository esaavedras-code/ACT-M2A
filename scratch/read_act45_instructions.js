const ExcelJS = require('exceljs');

async function readInstructions() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\Instrucciones ACT 45 con celdas.xlsx');
    const sheet = workbook.worksheets[0];
    
    // Dump all rows that might contain cell mappings
    for (let r = 1; r <= 100; r++) {
        let rowData = [];
        const row = sheet.getRow(r);
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            rowData.push(String(cell.value).replace(/\r?\n|\r/g, " "));
        });
        if (rowData.length > 0) {
            console.log(`Row ${r}:`, rowData.join(' | '));
        }
    }
}

readInstructions().catch(console.error);
