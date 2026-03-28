const ExcelJS = require('exceljs');

async function inspectTemplate() {
    const wb = new ExcelJS.Workbook();
    const templatePath = 'c:/Users/Enrique Saavedra/Documents/Programa ACT/public/New Contract Modification Log amarillo.xlsx';
    await wb.xlsx.readFile(templatePath);
    const ws = wb.getWorksheet('CML Report');
    if (!ws) return console.log('Worksheet "CML Report" not found');

    console.log('--- Row 33 (Potential Headers) ---');
    const r33 = ws.getRow(33);
    for (let c = 2; c <= 21; c++) {
        const val = r33.getCell(c).value;
        if (val) console.log(`${ws.getColumn(c).letter}33: ${JSON.stringify(val)}`);
    }

    console.log('--- Row 34 (Potential Headers) ---');
    const r34 = ws.getRow(34);
    for (let c = 2; c <= 21; c++) {
        const val = r34.getCell(c).value;
        if (val) console.log(`${ws.getColumn(c).letter}34: ${JSON.stringify(val)}`);
    }

    console.log('--- Row 35 (First Data Row) ---');
    const r35 = ws.getRow(35);
    for (let c = 2; c <= 21; c++) {
        const val = r35.getCell(c).value;
        if (val) console.log(`${ws.getColumn(c).letter}35: ${JSON.stringify(val)}`);
    }
}

inspectTemplate();
