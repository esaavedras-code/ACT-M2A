const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(worksheet, {header: 1});

data.forEach((row, i) => {
    console.log(`Row ${i}: ${JSON.stringify(row)}`);
});
