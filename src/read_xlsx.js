const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:/Users/Enrique Saavedra/Documents/Programa ACT/Documentos/ACT 45 Informe diario.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log(JSON.stringify(data, null, 2));
