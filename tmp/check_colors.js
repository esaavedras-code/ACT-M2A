const ExcelJS = require('exceljs');

async function checkColors() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) {
    console.log('Sheet not found');
    return;
  }

  const row = ws.getRow(35);
  console.log('| Col | Addr | Color ARGB |');
  console.log('|---|---|---|');
  
  for (let c = 2; c <= 25; c++) {
    const cell = row.getCell(c);
    let color = 'NONE';
    if (cell.fill && cell.fill.fgColor) {
      color = cell.fill.fgColor.argb || cell.fill.fgColor.theme || 'UNKNOWN';
    }
    console.log(`| ${c} | ${cell.address} | ${color} |`);
  }
}

checkColors().catch(err => console.error(err));
