const XLSX = require('xlsx');

function dumpSheet(filePath, maxRow = 50, maxCol = 26) {
    console.log(`\n=== DUMPING FILE: ${filePath} ===`);
    try {
        const workbook = XLSX.readFile(filePath);
        console.log("Sheet names:", workbook.SheetNames);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        for (let r = 0; r <= maxRow; r++) {
            let rowContent = [];
            for (let c = 0; c <= maxCol; c++) {
                const cellRef = XLSX.utils.encode_cell({r, c});
                const cell = sheet[cellRef];
                if (cell && cell.v !== undefined) {
                    rowContent.push(`${cellRef}(${cell.v})`);
                }
            }
            if (rowContent.length > 0) {
                console.log(`Row ${r + 1}: ${rowContent.join(' | ')}`);
            }
        }
    } catch (err) {
        console.error("Error reading file:", err.message);
    }
}

// Dump instructions
dumpSheet('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-117B Material On Site Instrucciones.xlsx', 100, 45);

// Dump template
dumpSheet('C:\\Users\\Enrique Saavedra\\Documents\\PROGRAMAS AI\\Programa ACT\\Documentos\\ACT-117B Material On Site Balance Shee.xlsx', 100, 45);
