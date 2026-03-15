const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\Notas_con_titulos_AC017630.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(JSON.stringify(data, null, 2));
} catch (err) {
    console.error(err.message);
}
