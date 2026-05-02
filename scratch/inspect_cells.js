
const ExcelJS = require('exceljs');
const path = require('path');

async function inspectCell() {
    const filePath = path.join(__dirname, '..', 'public', 'ACT-122B_Template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('ACT-122');
    
    const cellsToInspect = ['H7', 'AZ7', 'H16'];
    console.log('Inspeccionando celdas en la hoja ACT-122:');
    
    cellsToInspect.forEach(addr => {
        const cell = worksheet.getCell(addr);
        console.log(`\nCelda ${addr}:`);
        console.log(`- Valor actual: ${cell.value}`);
        console.log(`- Tipo: ${cell.type}`);
        console.log(`- Protección: ${JSON.stringify(cell.protection)}`);
        console.log(`- Estilo (font): ${JSON.stringify(cell.font)}`);
    });
}

inspectCell().catch(err => console.error(err));
