const ExcelJS = require('exceljs');
const path = require('path');

async function analyze() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx');
    const sheet = workbook.getWorksheet('CML Report');
    
    console.log('--- Top Section (Rows 1-65) Yellow Cells ---');
    sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        if (rowNumber > 65) return;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            if (cell.fill && cell.fill.type === 'pattern' && cell.fill.fgColor && cell.fill.fgColor.argb === 'FFFFFF00') {
                const left = sheet.getRow(rowNumber).getCell(colNumber - 1).value;
                const right = sheet.getRow(rowNumber).getCell(colNumber + 1).value;
                const top = sheet.getRow(rowNumber - 1).getCell(colNumber).value;
                console.log(`Cell ${cell.address}: Val='${cell.value}', Left='${left}', Right='${right}', Top='${top}'`);
            }
        });
    });

    console.log('--- Modifications Section (Row 81 sample) ---');
    const sampleRow = sheet.getRow(81);
    sampleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const fill = cell.fill;
        const color = fill && fill.fgColor ? fill.fgColor.argb : 'N/A';
        console.log(`Cell ${cell.address}: Color=${color}, Val='${cell.value}'`);
    });
}

analyze().catch(console.error);
