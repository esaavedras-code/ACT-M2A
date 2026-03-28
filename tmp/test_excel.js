const fs = require('fs');
const ExcelJS = require('exceljs');
async function run() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\AC017630 EWO 08 (M) New Contract Modification Log.xlsx');
    const ws = wb.worksheets[0];
    
    ws.getCell('D6').value = "AC-TEST";
    ws.getCell('S6').value = new Date("2021-05-01");
    // clear input cells
    for(let r=33; r<=57; r++) { ws.getCell('D'+r).value=null; }
    
    await wb.xlsx.writeFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\tmp\\test_out.xlsx');
}
run();
