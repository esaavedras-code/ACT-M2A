const XLSX = require('xlsx');
const fs = require('fs');

function dumpFile(path) {
    let output = `\n--- DUMPING FILE: ${path} ---\n`;
    try {
        const workbook = XLSX.readFile(path);
        workbook.SheetNames.forEach(sheetName => {
            output += `\n--- Sheet: ${sheetName} ---\n`;
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            data.forEach((row, i) => {
                output += `Row ${i}: ${JSON.stringify(row)}\n`;
            });
        });
    } catch (e) {
        output += `Error reading ${path}: ${e.message}\n`;
    }
    return output;
}

let finalOutput = "";
finalOutput += dumpFile('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-45 Instrucciones.xlsx');
finalOutput += dumpFile('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\Documentos\\ACT-45 Actividades.xlsx');

fs.writeFileSync('c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\src\\act45_dump.txt', finalOutput);
console.log("Done");
