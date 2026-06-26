const XLSX = require('xlsx');
const workbook = XLSX.readFile('C:/Users/Enrique Saavedra/Documents/PROGRAMAS AI/Programa ACT/Documentos/Comparacion_PS.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);
console.log("Headers:", Object.keys(data[0] || {}));
data.forEach((row, i) => {
    if(i < 15 || i > data.length - 5) {
        console.log(`Row ${i+1}:`, row);
    }
});
