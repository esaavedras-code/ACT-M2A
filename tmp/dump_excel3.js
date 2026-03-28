const ExcelJS = require('exceljs');
const path = require('path');

async function dump() {
    const wb = new ExcelJS.Workbook();
    const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'public', 'New Contract Modification Log amarillo.xlsx');
    await wb.xlsx.readFile(filePath);
    const ws = wb.getWorksheet('CML Report');
    if (!ws) {
        console.log('Sheet CML Report not found');
        return;
    }

    const rowsToDump = [33, 34, 62, 63, 69, 222, 223, 224, 225, 226, 227, 228, 229];
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];

    rowsToDump.forEach(r => {
        let rowStr = `Row ${r}: `;
        cols.forEach(c => {
            const cell = ws.getCell(`${c}${r}`);
            if (cell.value) {
                rowStr += `${c}: [${typeof cell.value === 'object' ? JSON.stringify(cell.value) : cell.value}] `;
            }
        });
        console.log(rowStr);
    });
}

dump().catch(console.error);
