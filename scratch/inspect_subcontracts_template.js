const XLSX = require('xlsx');
const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\Desglose de Subcontratos.xlsx';
const workbook = XLSX.readFile(filePath);

console.log("Hojas:", workbook.SheetNames);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
data.slice(0, 50).forEach((row, idx) => {
    console.log(`Fila ${idx + 1}:`, row);
});
