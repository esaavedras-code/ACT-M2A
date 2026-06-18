import ExcelJS from 'exceljs';
import { ACT117C_TEMPLATE_BASE64 } from '../src/lib/act117cTemplate';

async function findRemarks() {
    const workbook = new ExcelJS.Workbook();
    const bufferTemplate = Buffer.from(ACT117C_TEMPLATE_BASE64, 'base64');
    await workbook.xlsx.load(bufferTemplate);
    const backSheet = workbook.getWorksheet(2);
    if (!backSheet) return;

    backSheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            if (cell.value && typeof cell.value === 'string') {
                console.log(`[R${rowNumber} C${colNumber}]: ${cell.value}`);
            }
        });
    });
}
findRemarks();
