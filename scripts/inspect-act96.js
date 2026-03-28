const XLSX = require('xlsx');
const path = require('path');

const files = [
    'ACT-96 Inspeccion.xlsx',
    'ACT-96 Instrucciones.xlsx'
];

files.forEach(file => {
    const filePath = path.join('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos', file);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`--- Content of ${file} ---`);
    data.slice(0, 50).forEach((row, i) => {
        console.log(`Row ${i}:`, row);
    });
});
