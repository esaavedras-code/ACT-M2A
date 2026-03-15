const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'Users', 'Enrique Saavedra', 'Documents', 'Programa ACT', 'Documentos', '03AC200024 EWO 05 (G) (Contract Modification log).xlsm');

try {
    const workbook = XLSX.readFile(filePath, { sheetRows: 500 });
    const sheet = workbook.Sheets['CML Report'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log("--- PROJECT INFO (R7-R20) ---");
    for(let i=7; i<=20; i++) console.log(`R${i}:`, JSON.stringify(data[i]));

    console.log("--- PROJECT DESCRIPTION (R26-R32) ---");
    for(let i=26; i<=32; i++) console.log(`R${i}:`, JSON.stringify(data[i]));

    console.log("--- PROJECT AGREEMENT (R38-R55) ---");
    for(let i=38; i<=55; i++) console.log(`R${i}:`, JSON.stringify(data[i]));

    console.log("--- MODIFICATIONS (R69-R100) ---");
    for(let i=69; i<=100; i++) console.log(`R${i}:`, JSON.stringify(data[i]));

} catch (e) {
    console.error(e);
}
