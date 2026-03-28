
const xlsx = require('xlsx');
const fs = require('fs');
const sheet = xlsx.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\Notas_con_titulos_AC017630.xlsx').Sheets['Notas'];
const json = xlsx.utils.sheet_to_json(sheet, {header: 1});
const filtered = json.filter(row => row[0] === 'CML Report');
fs.writeFileSync('tmp/cml_notes_utf8.json', JSON.stringify(filtered, null, 2), 'utf8');
