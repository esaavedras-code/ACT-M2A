const ExcelJS = require('exceljs');
const path = require('path');

async function inspect() {
    const workbook = new ExcelJS.Workbook();
    const filePath = path.join(__dirname, '..', 'Documentos', 'ACT-122 CHO Form rev 12-2024.xlsx');
    
    console.log('Analizando:', filePath);
    
    await workbook.xlsx.readFile(filePath);
    
    workbook.worksheets.forEach(sheet => {
        console.log('\n--- Hoja:', sheet.name, '---');
        let count = 0;
        sheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                const val = cell.value;
                if (val && (typeof val === 'string' || typeof val === 'object')) {
                    const text = typeof val === 'string' ? val : (val.richText ? val.richText.map(t => t.text).join('') : JSON.stringify(val));
                    if (text.trim().length > 1 && count < 200) {
                        console.log(`Celda ${cell.address}: "${text.trim()}"`);
                        count++;
                    }
                }
            });
        });
    });
}

inspect().catch(err => console.error(err));
