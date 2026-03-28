const ExcelJS = require('exceljs');

async function checkHeaders() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) return;
  const row33 = ws.getRow(33);
  const row34 = ws.getRow(34);
  
  for (let c = 5; c <= 25; c++) {
    const v33 = row33.getCell(c).value ? row33.getCell(c).value.toString().replace(/\n/g, ' ') : '';
    const v34 = row34.getCell(c).value ? row34.getCell(c).value.toString().replace(/\n/g, ' ') : '';
    console.log(`${ws.getColumn(c).letter}\t${v33}\t${v34}`);
  }
}

checkHeaders().catch(err => console.error(err));
