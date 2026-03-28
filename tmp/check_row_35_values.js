const ExcelJS = require('exceljs');

async function checkRow35() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) return;
  const row = ws.getRow(35);
  
  for (let c = 2; c <= 25; c++) {
    const cell = row.getCell(c);
    let val = cell.value;
    if (cell.type === ExcelJS.ValueType.Formula) val = cell.result !== undefined ? cell.result : '=' + cell.formula;
    console.log(`${ws.getColumn(c).letter}\t${JSON.stringify(val)}`);
  }
}

checkRow35().catch(err => console.error(err));
