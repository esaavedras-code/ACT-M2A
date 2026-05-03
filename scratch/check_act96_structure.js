const ExcelJS = require('exceljs');

async function checkTemplate() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\act-96 iNSPECCION.xlsx');
    const sheet = workbook.worksheets[0];
    
    // Dump rows 40 to 95
    for (let r = 40; r <= 95; r++) {
        let rowData = [];
        const row = sheet.getRow(r);
        row.eachCell({ includeEmpty: false }, (cell) => {
            rowData.push(`${cell.address}:${cell.value}`);
        });
        if (rowData.length > 0) {
            console.log(`Row ${r}:`, rowData.join(' | '));
        }
    }
}

checkTemplate().catch(console.error);
