const ExcelJS = require('exceljs');
const path = require('path');

async function inspect() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(__dirname, '..', 'public', 'ACT-122B_Template.xlsx'));
    console.log('Sheets found:', wb.worksheets.map(w => w.name));
    
    const ws = wb.worksheets[0];
    if (!ws) {
        console.log('No sheets found');
        return;
    }
    console.log('Using Sheet:', ws.name);
    
    const cells = ['M52', 'BA50', 'BA52', 'BA63', 'C76', 'J14', 'M44', 'M46', 'M48', 'M50'];
    cells.forEach(c => {
        const cell = ws.getCell(c);
        console.log(`${c}: "${cell.value}"`);
    });
}

inspect();
