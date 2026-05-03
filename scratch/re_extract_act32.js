const ExcelJS = require('exceljs');

async function extract() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\act-32 instrucciones con celdas.xlsx');
    const sheet = workbook.worksheets[0];
    
    for (let r = 1; r <= 35; r++) {
        const row = sheet.getRow(r);
        let cells = [];
        row.eachCell((cell) => {
            if (cell.value) {
                cells.push(String(cell.value).replace(/\s+/g, ' ').trim());
            }
        });
        if (cells.length > 0) {
            console.log(`Row ${r}: ${cells.join(' | ')}`);
        }
    }
}

extract().catch(console.error);
