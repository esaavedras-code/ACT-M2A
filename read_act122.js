const XLSX = require('xlsx');

function readSheet(filePath) {
    const workbook = XLSX.readFile(filePath);
    const result = {};
    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        result[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    });
    return result;
}

const formPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-122 CHO Form rev 12-2024.xlsx';
const instPath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-122 CHO Instrucciones.xlsx';

console.log('--- FORM ---');
try {
    const formData = readSheet(formPath);
    console.log(JSON.stringify(formData, null, 2));
} catch (e) {
    console.error('Error reading form:', e.message);
}

console.log('\n--- INSTRUCTIONS ---');
try {
    const instData = readSheet(instPath);
    console.log(JSON.stringify(instData, null, 2));
} catch (e) {
    console.error('Error reading instructions:', e.message);
}
