const XLSX = require('xlsx');

const workbook = XLSX.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-123 Supplementary Contract Form rev 12-2024.xlsx');

const first_sheet_name = workbook.SheetNames[0];
const worksheet = workbook.Sheets[first_sheet_name];

console.log("EXCEL CONTENT START");
console.log(XLSX.utils.sheet_to_json(worksheet));
console.log("EXCEL CONTENT END");
