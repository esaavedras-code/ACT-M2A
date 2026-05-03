const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Instructions.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
    data.slice(0, 100).forEach((row, i) => {
        const line = row.join(' | ').trim();
        if (line) console.log(`${i}: ${line}`);
    });
} catch (err) {
    console.error("Error:", err.message);
}
