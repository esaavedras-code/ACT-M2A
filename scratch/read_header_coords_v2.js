const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Instructions con celdas.xlsx');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    for (let r = 4; r <= 15; r++) { // Filas 5 a 16
        let rowContent = [];
        for (let c = 0; c <= 60; c++) {
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
