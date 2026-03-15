const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\Notas_con_titulos_AC017630.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
data.forEach(row => {
    console.log(`[${row.Celda}] ${row['Título de columna']}: ${row.Nota}`);
});
