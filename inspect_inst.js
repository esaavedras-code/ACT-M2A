const XLSX = require('xlsx');

const instPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-122 CHO Instrucciones.xlsx';
const workbook = XLSX.readFile(instPath);

workbook.SheetNames.forEach(name => {
    console.log(`--- Sheet: ${name} ---`);
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    data.forEach((row, i) => {
        if (row.length > 0) {
            console.log(`${i}: ${JSON.stringify(row)}`);
        }
    });
});
