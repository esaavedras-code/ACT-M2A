const fs = require('fs');
const ExcelJS = require('exceljs');
async function run() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\AC017630 EWO 08 (M) New Contract Modification Log.xlsx');
    const ws = wb.getWorksheet(1);
    const out = [];
    ws.eachRow((r, rn) => {
        r.eachCell((c, cn) => {
            if (c.value) out.push(`R${rn}C${cn} [${c._address}]: ${c.value.formula ? 'FUNC ' + c.value.formula : JSON.stringify(c.value)}`);
        });
    });
    fs.writeFileSync('C:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\tmp\\dump.txt', out.join('\n'));
}
run();
