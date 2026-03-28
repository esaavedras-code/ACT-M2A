const ExcelJS = require('exceljs');

async function checkHeaders() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) return;
  const row32 = ws.getRow(32);
  const row33 = ws.getRow(33);
  const row34 = ws.getRow(34);
  
  const cols = ['V','W','X','Y'];
  for (const cName of cols) {
    const v32 = row32.getCell(cName).value ? row32.getCell(cName).value.toString().replace(/\n/g, ' ') : '';
    const v33 = row33.getCell(cName).value ? row33.getCell(cName).value.toString().replace(/\n/g, ' ') : '';
    const v34 = row34.getCell(cName).value ? row34.getCell(cName).value.toString().replace(/\n/g, ' ') : '';
    console.log(`${cName}\t[32] ${v32} | [33] ${v33} | [34] ${v34}`);
  }
}

checkHeaders().catch(err => console.error(err));
