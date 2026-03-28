const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\CML%20%28New%20Contract%20Moficaction%20Log%29%20-%20sin%20restriccion.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Header 1 to get raw rows

    console.log('Sheet Name:', sheetName);
    console.log('Top 20 rows:');
    data.slice(0, 20).forEach((row, i) => {
        console.log(`Row ${i}:`, JSON.stringify(row));
    });
} catch (err) {
    console.error('Error reading file:', err.message);
}
