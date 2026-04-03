const ExcelJS = require('exceljs');
const path = require('path');

async function inspectTemplate() {
    const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', 'CML sin restricciones.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    
    console.log('Sheets:', wb.worksheets.map(ws => ws.name));
    const ws = wb.getWorksheet('CML Report') || wb.worksheets[0];
    console.log('Using Sheet:', ws.name);

    if (!ws) {
        console.log('No worksheet found.');
        return;
    }

    const cellsToInspect = [
        'B16', 'T10', 'T11', 'T12', 'T13', 'T14', 'E15', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'B17', 'B18',
        'H223', 'I223', 'J223', 'K223', 'L223', 'M223', 'N223', 'O223', 'P223'
    ];

    console.log('\n--- Individual Cells ---');
    cellsToInspect.forEach(addr => {
        const cell = ws.getCell(addr);
        if (cell.type === ExcelJS.ValueType.Formula) {
            console.log(`${addr}: FORMULA ${cell.value} (Result: ${cell.result})`);
        } else {
            console.log(`${addr}: VALUE ${cell.value}`);
        }
    });

    console.log('\n--- Range B35:B44 Sample ---');
    for (let r = 35; r <= 44; r++) {
        const cell = ws.getCell(`B${r}`);
        console.log(`${cell.address}: ${cell.value}`);
    }

    const ranges = [
        { name: 'C35:U37', r1: 35, r2: 37, c1: 3, c2: 21 },
        { name: 'B70:U72', r1: 70, r2: 72, c1: 2, c2: 21 },
        { name: 'C225:F229', r1: 225, r2: 229, c1: 3, c2: 6 },
        { name: 'L226:U227', r1: 226, r2: 227, c1: 12, c2: 21 }
    ];

    ranges.forEach(range => {
        console.log(`\nRange ${range.name}:`);
        for (let r = range.r1; r <= range.r2; r++) {
            let rowVals = [];
            for (let c = range.c1; c <= range.c2; c++) {
                const cell = ws.getRow(r).getCell(c);
                if (cell.type === ExcelJS.ValueType.Formula) {
                    rowVals.push(`${cell.address}:FML`);
                } else {
                    rowVals.push(`${cell.address}:${cell.value}`);
                }
            }
            console.log(rowVals.join(' | '));
        }
    });
}

inspectTemplate().catch(console.error);
