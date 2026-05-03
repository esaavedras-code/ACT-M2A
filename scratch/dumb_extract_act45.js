const ExcelJS = require('exceljs');

async function extract() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\Instrucciones ACT 45 con celdas.xlsx');
    const sheet = workbook.worksheets[0];
    
    for (let r = 1; r <= 45; r++) {
        const row = sheet.getRow(r);
        let cells = [];
        row.eachCell((cell) => {
            if (cell.value) {
                cells.push(String(cell.value).replace(/\s+/g, ' ').trim());
            }
        });
        if (cells.length > 0) {
            console.log(`Row ${r}: ${cells[0]} ... ${cells[cells.length - 1]}`);
        }
    }
}

extract().catch(console.error);
