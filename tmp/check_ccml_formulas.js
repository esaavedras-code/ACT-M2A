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

  const cells = [
    'E35','F35','G35','H35','I35','J35','K35','L35','M35','N35','O35','P35',
    'Q35','R35','S35','T35','U35','V35','W35','X35','Y35',
    'E61','F61','G61','H61','I61','J61','K61','L61','M61','N61','O61','P61',
    'Q61','R61','S61','T61','U61','V61','W61','X61','Y61'
  ];

  console.log('| Cell | Type | Value | Formula | Result |');
  console.log('|---|---|---|---|---|');
  cells.forEach(addr => {
    const cell = ws.getCell(addr);
    let type = cell.type;
    let value = cell.value;
    let formula = '';
    let result = cell.result;

    if (cell.type === ExcelJS.ValueType.Formula) {
      formula = cell.formula;
      type = 'Formula';
    } else if (cell.type === ExcelJS.ValueType.SharedFormula) {
      formula = cell.sharedFormula;
      type = 'Shared';
    }

    console.log(`| ${addr} | ${type} | ${JSON.stringify(value)} | ${formula} | ${result} |`);
  });
}

checkFormulas().catch(err => console.error(err));
