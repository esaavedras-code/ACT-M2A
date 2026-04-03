const XLSX = require('xlsx');
const path = require('path');

async function inspectTemplate() {
    const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', 'CML sin restricciones.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'CML Report'; // Let's check for this name or the first sheet
    const ws = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];

    console.log('Using Sheet:', sheetName in workbook.Sheets ? sheetName : workbook.SheetNames[0]);

    const cellsToInspect = [
        'B16', 'T10', 'T11', 'T12', 'T13', 'T14', 'E15', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'B17', 'B18',
        'H223', 'I223', 'J223', 'K223', 'L223', 'M223', 'N223', 'O223', 'P223'
    ];

    console.log('\n--- Individual Cells ---');
    cellsToInspect.forEach(addr => {
        const cell = ws[addr];
        if (!cell) {
             console.log(`${addr}: EMPTY`);
             return;
        }
        console.log(`${addr}: ${cell.v} (Formula: ${cell.f || 'None'})`);
    });

    console.log('\n--- Unit Column B35:B44 ---');
    for (let r = 35; r <= 44; r++) {
        const addr = `B${r}`;
        const cell = ws[addr];
        console.log(`${addr}: ${cell ? cell.v : 'EMPTY'}`);
    }

    const ranges = [
        { name: 'C35:U61 Sample', r1: 35, r2: 61, c1: 'C', c2: 'U' },
        { name: 'B70:U109 Sample', r1: 70, r2: 109, c1: 'B', c2: 'U' },
        { name: 'C225:F229', r1: 225, r2: 229, c1: 'C', c2: 'F' },
        { name: 'L226:U227', r1: 226, r2: 227, c1: 'L', c2: 'U' },
        { name: 'L234:U285 Sample', r1: 234, r2: 240, c1: 'L', c2: 'U' } // Just a sample for L234:U285
    ];

    ranges.forEach(range => {
        console.log(`\nRange ${range.name}:`);
        for (let r = range.r1; r <= Math.min(range.r1 + 2, range.r2); r++) {
            let rowVals = [];
            for (let c = range.c1.charCodeAt(0); c <= range.c2.charCodeAt(0); c++) {
                const addr = String.fromCharCode(c) + r;
                const cell = ws[addr];
                rowVals.push(`${addr}:${cell ? cell.v : 'E'} ${cell && cell.f ? '(FML)' : ''}`);
            }
            console.log(rowVals.join(' | '));
        }
    });
}

inspectTemplate().catch(console.error);
