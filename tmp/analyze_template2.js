const ExcelJS = require('exceljs');

async function analyze() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx');
    const sheet = workbook.getWorksheet('CML Report');
    
    // Print rows 1..65 in full to see context for yellow cells
    console.log('=== ROWS 1-65 (all cells with values or yellow) ===');
    for (let r = 1; r <= 65; r++) {
        const row = sheet.getRow(r);
        let rowData = [];
        for (let c = 1; c <= 26; c++) {
            const cell = row.getCell(c);
            const isYellow = cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb === 'FFFFFF00';
            const v = cell.value;
            if (v !== null || isYellow) {
                const addr = cell.address;
                rowData.push(`${addr}${isYellow ? '[Y]' : ''}: ${JSON.stringify(v)}`);
            }
        }
        if (rowData.length > 0) {
            console.log(`Row ${r}: ${rowData.join(' | ')}`);
        }
    }
    
    // Print sample mod rows
    console.log('\n=== MODIFICATIONS HEADER ROW ===');
    for (let r = 74; r <= 82; r++) {
        const row = sheet.getRow(r);
        let rowData = [];
        for (let c = 1; c <= 22; c++) {
            const cell = row.getCell(c);
            const isYellow = cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb === 'FFFFFF00';
            const v = cell.value;
            if (v !== null || isYellow) {
                rowData.push(`${cell.address}${isYellow ? '[Y]' : ''}: ${JSON.stringify(v)}`);
            }
        }
        if (rowData.length > 0) console.log(`Row ${r}: ${rowData.join(' | ')}`);
    }
}

analyze().catch(console.error);
