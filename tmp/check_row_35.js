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
  console.log('| Col | Address | Type | Value (Text/Num/Formula) | Result |');
  console.log('|---|---|---|---|---|');
  
  for (let c = 2; c <= 26; c++) { // B to Z
    const cell = row.getCell(c);
    let cellValue = cell.value;
    let addr = cell.address;
    let type = cell.type;
    let result = cell.result;

    if (cell.type === ExcelJS.ValueType.Formula) {
      cellValue = '=' + cell.formula;
    } else if (cell.type === ExcelJS.ValueType.SharedFormula) {
      cellValue = '=' + (cell.sharedFormula || '(shared)');
    } else if (cell.type === ExcelJS.ValueType.Null) {
      cellValue = 'NULL';
    }

    console.log(`| ${c} | ${addr} | ${type} | ${JSON.stringify(cellValue)} | ${result} |`);
  }
}

checkFormulas().catch(err => console.error(err));
