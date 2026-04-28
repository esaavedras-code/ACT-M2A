const XLSX = require('xlsx');
const filePath = 'C:/Users/Enrique Saavedra/Documents/PROGRAMAS AI/Programa ACT/Documentos/DOFAEI.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets['DOFAEI-pg1'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log('Row 45:', JSON.stringify(data[44])); // 0-indexed
    console.log('Row 46:', JSON.stringify(data[45]));
    console.log('Row 47:', JSON.stringify(data[46]));
} catch (error) {
    console.error('Error:', error.message);
}
