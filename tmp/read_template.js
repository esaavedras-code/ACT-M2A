const ExcelJS = require('exceljs');

async function readTemplate() {
    const templatePath = 'c:\\Users\\Enrique Saavedra\\Documents\\Programa ACT\\public\\New Contract Modification Log amarillo.xlsx';
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);
    const ws = wb.getWorksheet('CML Report');

    const getVal = (addr) => {
        const c = ws.getCell(addr);
        if (!c.value) return "";
        return c.value.toString();
    };

    console.log('--- LABELS B50-B70 ---');
    for (let r = 50; r <= 70; r++) {
       console.log(`${r}: B[${getVal('B'+r)}] E[${getVal('E'+r)}] K[${getVal('K'+r)}]`);
    }
}

readTemplate().catch(console.error);
