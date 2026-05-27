const XLSX = require('xlsx');
const filePath = 'C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-122 CHO Instrucciones CELDAS EXCEL.xlsx';
const workbook = XLSX.readFile(filePath);

console.log("Hojas del libro:", workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- Contenido de la hoja: ${sheetName} ---`);
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // Imprimir las primeras 50 filas de la hoja para entender su estructura
    rawData.slice(0, 50).forEach((row, idx) => {
        console.log(`Fila ${idx + 1}:`, row);
    });
});
