const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');
    const sheet = workbook.Sheets['SUPP-ACT-123'];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cellRef = XLSX.utils.encode_cell({r, c});
            const cell = sheet[cellRef];
            if (cell && cell.v && (cell.v.toString().includes('Item') || cell.v.toString().includes('002'))) {
                console.log(`Encontrado en ${cellRef}: ${cell.v}`);
            }
        }
    }
} catch (err) {
    console.error("Error:", err.message);
}
