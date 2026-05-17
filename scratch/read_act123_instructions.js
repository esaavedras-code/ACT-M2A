const ExcelJS = require('exceljs');
const path = require('path');

async function run() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(__dirname, '../Documentos/ACT-123 Instructions con celdas.xlsx'));
    const ws = wb.worksheets[0];
    
    ws.eachRow((row, rowNumber) => {
        if (rowNumber > 30) {
            let line = `Row ${rowNumber}: `;
            row.eachCell((cell, colNumber) => {
                if (cell.value) {
                    line += `[Col ${colNumber}/${cell.address}]: ${cell.value} | `;
                }
            });
            if (line !== `Row ${rowNumber}: `) console.log(line);
        }
    });
}
run();
