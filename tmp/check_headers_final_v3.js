const ExcelJS = require('exceljs');

async function checkHeaders() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) return;
  const row34 = ws.getRow(34);
  
  const cols = ['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y'];
  for (const cName of cols) {
    const v = row34.getCell(cName).value ? row34.getCell(cName).value.toString().replace(/\n/g, ' ') : '';
    console.log(`${cName}\t${v}`);
  }
}

checkHeaders().catch(err => console.error(err));
