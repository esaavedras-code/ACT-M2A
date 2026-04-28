const XLSX = require('xlsx');
const path = require('path');

const filePath = process.argv[2] || 'C:/Users/Enrique Saavedra/Documents/PROGRAMAS AI/Programa ACT/Documentos/DOFAEI.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheets:', workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n--- Content of ${sheetName} ---`);
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Print first 50 rows to understand structure
        data.slice(0, 50).forEach((row, index) => {
            console.log(`Row ${index + 1}:`, row);
        });
    });
} catch (error) {
    console.error('Error reading Excel:', error.message);
}
