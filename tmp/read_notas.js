
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const workbook = xlsx.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\Notas_con_titulos_AC017630.xlsx');
const sheetName = workbook.SheetNames[0]; // Assuming it's the first sheet
const sheet = workbook.Sheets[sheetName];
const json = xlsx.utils.sheet_to_json(sheet, {header: 1});

const cleanJson = json.filter(row => row.length > 0 && row[0] === 'CML Report'); // filter by 'CML Report'
console.log(JSON.stringify(cleanJson, null, 2));
