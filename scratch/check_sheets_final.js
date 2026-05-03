const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Instructions con celdas.xlsx');
    console.log("Hojas reales:", workbook.SheetNames);
} catch (err) {
    console.error("Error:", err.message);
}
