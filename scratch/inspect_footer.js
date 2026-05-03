const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    for (let r = 35; r <= 55; r++) {
        for (let c = 0; c <= 70; c++) {
            const cellRef = XLSX.utils.encode_cell({r, c});
            const cell = sheet[cellRef];
            if (cell && cell.v) {
                console.log(`${cellRef}: ${cell.v}`);
            }
        }
    }
} catch (err) {
    console.error("Error:", err.message);
}
