const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');
    const sheet = workbook.Sheets['CHO-ACT-YYY'];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let r = 0; r <= 80; r++) {
        let rowContent = [];
        for (let c = 0; c <= 70; c++) {
            const cellRef = XLSX.utils.encode_cell({r, c});
            const cell = sheet[cellRef];
            if (cell && cell.v) {
                rowContent.push(`${cellRef}: ${cell.v}`);
            }
        }
        if (rowContent.length > 0) console.log(rowContent.join(' | '));
    }
} catch (err) {
    console.error("Error:", err.message);
}
