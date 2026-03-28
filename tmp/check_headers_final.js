const ExcelJS = require('exceljs');

async function checkHeaders() {
  const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('CML Report');
  
  if (!ws) {
    console.log('Sheet not found');
    return;
  }

  for (let c = 2; c <= 25; c++) {
    const h33 = ws.getRow(33).getCell(c).value;
    const h34 = ws.getRow(34).getCell(c).value;
    console.log(`Col ${String.fromCharCode(64 + c)} (${c}): [33] ${h33} | [34] ${h34}`);
  }
}

checkHeaders().catch(err => console.error(err));
