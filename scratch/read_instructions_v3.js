const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Instructions con celdas.xlsx');
    const sheet = workbook.Sheets['Instructions'];
    if (!sheet) {
        console.log("No se encontró la hoja 'Instructions', leyendo la primera hoja...");
        // fallback to first sheet
    }
    const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
    data.slice(0, 30).forEach((row, i) => {
        console.log(`${i+1}: ${row.join(' | ')}`);
    });
} catch (err) {
    console.error("Error:", err.message);
}
