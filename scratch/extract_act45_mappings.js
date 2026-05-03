const ExcelJS = require('exceljs');

async function extractMappings() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\Instrucciones ACT 45 con celdas.xlsx');
    const sheet = workbook.worksheets[0];
    
    for (let r = 1; r <= 45; r++) {
        const row = sheet.getRow(r);
        let firstCell = null;
        let lastCell = null;
        
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const val = String(cell.value).trim();
            if (!firstCell && /^\d+$/.test(val)) {
                firstCell = val;
            }
            if (/^[A-Z]+\d+$/.test(val)) {
                lastCell = val;
            }
        });
        
        if (firstCell && lastCell) {
            console.log(`Item ${firstCell}: ${lastCell}`);
        }
    }
}

extractMappings().catch(console.error);
