const XLSX = require('xlsx');
const wb = XLSX.readFile('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\ACT-122_Official_Template.xlsx');
const ws = wb.Sheets['ACT-122'];

for (let r = 35; r <= 55; r++) {
    let rowTxt = `Row ${r+1}: `;
    for (let c = 0; c <= 70; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell && cell.v) {
            rowTxt += `[${addr}: ${cell.v}${cell.f ? ' (f:'+cell.f+')' : ''}] `;
        }
    }
    if (rowTxt.length > 10) console.log(rowTxt);
}
