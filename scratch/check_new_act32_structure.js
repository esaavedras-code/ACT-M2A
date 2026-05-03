const ExcelJS = require('exceljs');

async function checkTemplate() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\PROGRAMAS AI\\\\Programa ACT\\\\Documentos\\\\ACT-32.xlsx');
    const sheet = workbook.worksheets[0];
    
    console.log('--- Row 47 ---');
    const r47 = sheet.getRow(47);
    r47.eachCell({ includeEmpty: true }, (cell) => {
        console.log(`${cell.address}: ${cell.value}`);
    });

    console.log('--- Row 57-59 ---');
    for (let i = 57; i <= 59; i++) {
        const row = sheet.getRow(i);
        row.eachCell({ includeEmpty: true }, (cell) => {
            console.log(`${cell.address}: ${cell.value}`);
        });
    }

    console.log('--- Row 74 ---');
    const r74 = sheet.getRow(74);
    r74.eachCell({ includeEmpty: true }, (cell) => {
        console.log(`${cell.address}: ${cell.value}`);
    });
}

checkTemplate().catch(console.error);
