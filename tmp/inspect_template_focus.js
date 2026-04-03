const XLSX = require('xlsx');
const path = require('path');

async function inspectTemplate() {
    const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', 'CML sin restricciones.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = 'CML Report'; 
    const ws = workbook.Sheets[sheetName] || workbook.Sheets[workbook.SheetNames[0]];

    console.log('Using Sheet:', sheetName in workbook.Sheets ? sheetName : workbook.SheetNames[0]);

    const inspectRange = (r1, r2, cStart, cEnd) => {
        for (let r = r1; r <= r2; r++) {
            let row = [];
            for (let c = cStart.charCodeAt(0); c <= cEnd.charCodeAt(0); c++) {
                const addr = String.fromCharCode(c) + r;
                const cell = ws[addr];
                row.push(`${addr}:${cell ? cell.v : 'E'}${cell && cell.f ? '(FML:' + cell.f + ')' : ''}`);
            }
            console.log(row.join(' | '));
        }
    };

    console.log('\n--- B16 ---');
    console.log(`B16: ${ws['B16'] ? ws['B16'].v : 'E'}`);

    console.log('\n--- T10:T17 ---');
    inspectRange(10, 17, 'T', 'T');

    console.log('\n--- E8:E15 ---');
    inspectRange(8, 15, 'E', 'E');

    console.log('\n--- B17:B18 ---');
    inspectRange(17, 18, 'B', 'B');

    console.log('\n--- Ranges (first 3 rows) ---');
    console.log('\nC35:U37:');
    inspectRange(35, 37, 'C', 'U');
    console.log('\nB70:U72:');
    inspectRange(70, 72, 'B', 'U');

    console.log('\n--- Summary Rows ---');
    console.log('\nH223:P223:');
    inspectRange(223, 223, 'H', 'P');
    console.log('\nC225:F229:');
    inspectRange(225, 229, 'C', 'F');
    console.log('\nL226:U227:');
    inspectRange(226, 227, 'L', 'U');
    console.log('\nL234:L240 (Sample of L234:U285):');
    inspectRange(234, 240, 'L', 'L');
}

inspectTemplate().catch(console.error);
