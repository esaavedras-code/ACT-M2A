const XLSX = require('xlsx');
try {
    const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');
    console.log("Hojas encontradas:", workbook.SheetNames);
} catch (err) {
    console.error("Error:", err.message);
}
