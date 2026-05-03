const ExcelJS = require('exceljs');

async function readInstructions() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\Instrucciones ACT 45 con celdas.xlsx');
    const sheet = workbook.worksheets[0];
    
    // Dump all rows that might contain cell mappings
    for (let r = 1; r <= 45; r++) {
        const row = sheet.getRow(r);
        const colA = row.getCell(1).value;
        const colLast = row.getCell(25).value || row.getCell(24).value || row.getCell(26).value; // Try to get the cell address column
        
        if (colA) {
            console.log(`Instruction ${colA}: Cell = ${colLast}`);
        }
    }
}

readInstructions().catch(console.error);
