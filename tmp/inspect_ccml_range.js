const ExcelJS = require('exceljs');
const path = require('path');

async function inspectTemplate() {
    const wb = new ExcelJS.Workbook();
    // Assuming the template is in the public folder as seen in generateCCMLReport.ts
    const templatePath = 'c:/Users/Enrique Saavedra/Documents/Programa ACT/public/New Contract Modification Log amarillo.xlsx';
    await wb.xlsx.readFile(templatePath);
    const ws = wb.getWorksheet('CML Report');
    if (!ws) {
        console.error('Worksheet "CML Report" not found');
        return;
    }

    console.log('Inspecting range B31:U36 (Headers and first data row)');
    for (let r = 31; r <= 36; r++) {
        let rowStr = `Row ${r}: `;
        for (let c = 2; c <= 21; c++) { // B to U
            const cell = ws.getRow(r).getCell(c);
            const val = cell.value ? (typeof cell.value === 'object' ? JSON.stringify(cell.value) : cell.value) : 'EMPTY';
            rowStr += `${ws.getColumn(c).letter}${r}:${val} | `;
        }
        console.log(rowStr);
    }
}

inspectTemplate();
