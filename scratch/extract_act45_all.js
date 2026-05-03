const ExcelJS = require('exceljs');

async function extractAllMappings() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\Instrucciones ACT 45 con celdas.xlsx');
    const sheet = workbook.worksheets[0];
    
    for (let r = 1; r <= 50; r++) {
        const row = sheet.getRow(r);
        const itemNum = row.getCell(1).value;
        const text = row.getCell(2).value;
        let targetCell = "";
        
        row.eachCell((cell) => {
            const val = String(cell.value).trim();
            if (/^[A-Z]+\d+$/.test(val) || /^([A-Z]+\d+)\s*-\s*([A-Z]+\d+)$/.test(val) || /^[A-Z]+$/.test(val)) {
                targetCell = val;
            }
        });
        
        if (itemNum) {
            console.log(`Item ${itemNum}: ${text} -> ${targetCell}`);
        }
    }
}

extractAllMappings().catch(console.error);
