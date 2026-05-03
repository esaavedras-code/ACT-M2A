const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Instructions con celdas.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log("Mapeo de celdas detectado:");
    for (let r = range.s.r; r <= 80; r++) { // Escaneamos hasta la fila 80
        let rowContent = [];
        for (let c = range.s.c; c <= 60; c++) {
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
