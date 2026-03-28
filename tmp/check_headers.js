const ExcelJS = require('exceljs');

async function checkFormulas() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) {
    console.log('Sheet not found');
    return;
  }

  const row = ws.getRow(35);
  const headers = ws.getRow(34); // and row 33 maybe
  const headers2 = ws.getRow(33);
  
  for (let c = 2; c <= 25; c++) {
    const cell = row.getCell(c);
    const h1 = headers2.getCell(c).value;
    const h2 = headers.getCell(c).value;
    let val = cell.value;
    if (cell.type === ExcelJS.ValueType.Formula) val = '=' + cell.formula;
    if (cell.type === ExcelJS.ValueType.SharedFormula) val = '=' + (cell.sharedFormula || '(shared)');
    
    console.log(`Col ${c} (${h1} / ${h2}): ${JSON.stringify(val)}`);
  }
}

checkFormulas().catch(err => console.error(err));
