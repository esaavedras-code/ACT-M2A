const ExcelJS = require('exceljs');
const path = require('path');

async function checkFormulas() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) {
    console.log('Sheet not found');
    return;
  }

  const cellsToCheck = [];
  // White cells E35:J44
  for (let r = 35; r <= 36; r++) { // checking a couple of rows
    for (let c = 5; c <= 10; c++) { // E to J
      cellsToCheck.push(ws.getRow(r).getCell(c).address);
    }
  }
  // Colored cells K35:P44 (these should be formulas)
  for (let r = 35; r <= 36; r++) {
    for (let c = 11; c <= 16; c++) { // K to P
      cellsToCheck.push(ws.getRow(r).getCell(c).address);
    }
  }
  // State funds white cells Q35:Y44
  for (let r = 35; r <= 36; r++) {
    for (let c = 17; c <= 25; c++) { // Q to Y
      cellsToCheck.push(ws.getRow(r).getCell(c).address);
    }
  }
  // Row 61 (Total)
  for (let c = 5; c <= 25; c++) {
    cellsToCheck.push(ws.getRow(61).getCell(c).address);
  }

  for (const addr of cellsToCheck) {
    const cell = ws.getCell(addr);
    let formulaStr = '';
    if (cell.type === ExcelJS.ValueType.Formula) {
      formulaStr = cell.formula;
    } else if (cell.type === ExcelJS.ValueType.SharedFormula) {
      // For shared formulas, we need to handle it carefully
      formulaStr = cell.sharedFormula || '(shared)';
    }
    console.log(`${addr}\t[${cell.type}]\t${JSON.stringify(cell.value)}\t${formulaStr}`);
  }
}

checkFormulas().catch(err => console.error(err));
