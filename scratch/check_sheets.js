
const ExcelJS = require('exceljs');
const path = require('path');

async function checkSheets() {
    const filePath = path.join(__dirname, '..', 'public', 'ACT-122B_Template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    console.log('Hojas encontradas:');
    workbook.eachSheet((sheet, id) => {
        console.log(`- ${sheet.name}`);
    });
}

checkSheets().catch(err => console.error(err));
