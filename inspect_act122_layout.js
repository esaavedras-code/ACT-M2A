const XLSX = require('xlsx');
const wb = XLSX.readFile('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\ACT-122_Official_Template.xlsx');
const ws = wb.Sheets['ACT-122'];

const range = XLSX.utils.decode_range(ws['!ref']);
for (let r = 0; r <= 30; r++) {
    let rowTxt = '';
    for (let c = 0; c <= range.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
            rowTxt += `[${XLSX.utils.encode_cell({r,c})}: ${cell.v}] `;
        }
    }
    if (rowTxt) console.log(rowTxt);
}
