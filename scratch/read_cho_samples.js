const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Instructions con celdas.xlsx');
    const sheet = workbook.Sheets['CHO-ACT-YYY'];
    const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
    for (let i = 4; i <= 14; i++) {
        if (data[i]) console.log(`${i+1}: ${data[i].join(' | ')}`);
    }
} catch (err) {
    console.error("Error:", err.message);
}
