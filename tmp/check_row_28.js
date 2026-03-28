const ExcelJS = require('exceljs');

async function checkRow28() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) return;
  const row = ws.getRow(28);
  for (let c = 1; c <= 20; c++) {
    console.log(`${ws.getColumn(c).letter}28: ${JSON.stringify(row.getCell(c).value)}`);
  }
}

checkRow28().catch(err => console.error(err));
